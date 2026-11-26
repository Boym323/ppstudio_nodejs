import { expect, test, type Request } from "@playwright/test";

import { cleanupE2eData, createPublicBookingFixture, prisma, type E2eFixture } from "./helpers/fixtures";

const STORAGE_KEY = "ppstudio:booking-draft:v1";

test.describe("obnova rozpracované rezervace v prohlížeči", () => {
  let fixture: E2eFixture | null = null;

  test.afterEach(async () => {
    if (fixture) await cleanupE2eData(fixture.runId);
    fixture = null;
  });

  test("desktop hydruje stejný počáteční počet doporučení jako server", async ({ page }) => {
    fixture = await createPublicBookingFixture();
    await page.setViewportSize({ width: 1280, height: 900 });
    const hydrationErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && /hydration|did not match/i.test(message.text())) {
        hydrationErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => {
      if (/hydration|did not match/i.test(error.message)) hydrationErrors.push(error.message);
    });

    await page.goto(`/rezervace?service=${fixture.serviceSlug}`);
    const suggestedSection = page.getByRole("heading", { name: "Doporučené termíny" }).locator("xpath=ancestor::section[1]");
    await expect(suggestedSection.getByRole("button")).toHaveCount(6);
    expect(hydrationErrors).toEqual([]);
  });

  test("obnoví skutečný formulář včetně ověřeného termínu po reloadu", async ({ page }) => {
    fixture = await createPublicBookingFixture();

    await page.goto(`/rezervace?service=${fixture.serviceSlug}`);
    const form = page.locator("form[aria-busy]");
    await expect(form).toHaveAttribute("aria-busy", "false");

    const firstSlot = page.getByRole("button", { name: /^Vybrat termín / }).first();
    await expect(firstSlot).toBeEnabled();
    await firstSlot.click();
    await expect(page.locator('input[name="slotId"]')).not.toHaveValue("");
    const originalSlotId = await page.locator('input[name="slotId"]').inputValue();

    await page.getByLabel("Jméno a příjmení").fill(fixture.clientName);
    await page.getByRole("textbox", { name: "E-mail" }).fill(fixture.clientEmail);
    await page.getByRole("textbox", { name: "Telefon" }).fill("+420 777 000 000");

    // Ukládání konceptu je React effect; počkáme na jeho skutečný zápis.
    await expect.poll(() => page.evaluate((key) => {
      const value = window.sessionStorage.getItem(key);
      return value ? (JSON.parse(value) as { fullName?: string }).fullName : null;
    }, STORAGE_KEY)).toBe(fixture.clientName);

    await page.reload();
    await expect(page.getByText("Rozpracované údaje jsme obnovili.", { exact: false })).toBeVisible();
    await expect(form).toHaveAttribute("aria-busy", "false");
    expect(await form.evaluate((element) => Boolean(
      element.compareDocumentPosition(document.querySelector('[role="status"]')!)
        & Node.DOCUMENT_POSITION_FOLLOWING,
    ))).toBe(true);
    await expect(form).not.toHaveAttribute("inert", "");
    await expect(page.getByLabel("Jméno a příjmení")).toHaveValue(fixture.clientName);
    await expect(page.getByRole("textbox", { name: "E-mail" })).toHaveValue(fixture.clientEmail);
    await expect(page.getByRole("textbox", { name: "Telefon" })).toHaveValue("+420 777 000 000");
    await expect(page.locator('input[name="slotId"]')).toHaveValue(originalSlotId);
  });

  test("timeout odblokuje formulář a opožděný úspěch nepřepíše editované kontakty", async ({ page }) => {
    fixture = await createPublicBookingFixture();
    const service = await prisma.service.findUniqueOrThrow({
      where: { slug: fixture.serviceSlug },
      select: { id: true },
    });

    const draft = {
      version: 1,
      savedAt: Date.now(),
      entryServiceSlug: fixture.serviceSlug,
      serviceId: service.id,
      timeOptionKey: "neovereny-termin",
      fullName: fixture.clientName,
      email: fixture.clientEmail,
      phone: "+420 777 000 000",
    };
    await page.addInitScript(({ key, value }) => {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    }, { key: STORAGE_KEY, value: draft });

    let intercepted = 0;
    let releaseAction!: () => void;
    const release = new Promise<void>((resolve) => { releaseAction = resolve; });
    const isBookingAction = (request: Request) =>
      request.method() === "POST"
      && new URL(request.url()).pathname === "/rezervace"
      && Boolean(request.headers()["next-action"]);

    await page.route("**/rezervace**", async (route) => {
      if (isBookingAction(route.request())) {
        intercepted += 1;
        await release;
      }
      await route.continue();
    });

    try {
      await page.goto(`/rezervace?service=${fixture.serviceSlug}`);
      const form = page.locator("form[aria-busy]");
      await expect(form).toHaveAttribute("aria-busy", "true");
      expect(await form.evaluate((element) => Boolean(
        element.compareDocumentPosition(document.querySelector('[role="status"]')!)
          & Node.DOCUMENT_POSITION_FOLLOWING,
      ))).toBe(true);
      await expect.poll(() => intercepted).toBe(1);

      // Katalog stále neodpovídá, ale po 5 sekundách musí být UI interaktivní.
      await expect(form).toHaveAttribute("aria-busy", "false", { timeout: 12_000 });
      await expect(form).not.toHaveAttribute("inert", "");
      await expect(page.getByText("Kontaktní údaje jsme obnovili", { exact: false })).toBeVisible();
      await expect(page.getByLabel("Jméno a příjmení")).toHaveValue(fixture.clientName);
      await expect(page.getByRole("textbox", { name: "E-mail" })).toHaveValue(fixture.clientEmail);
      await expect(page.locator('input[name="slotId"]')).toHaveValue("");

      const updatedName = `${fixture.clientName} upraveno`;
      const updatedEmail = `nova-${fixture.runId}@example.test`;
      await page.getByLabel("Jméno a příjmení").fill(updatedName);
      await page.getByRole("textbox", { name: "E-mail" }).fill(updatedEmail);

      // Teprve teď doručíme původní odpověď. React ji musí ignorovat.
      const lateResponse = page.waitForResponse((response) => isBookingAction(response.request()));
      releaseAction();
      await lateResponse;
      await expect(page.getByLabel("Jméno a příjmení")).toHaveValue(updatedName);
      await expect(page.getByRole("textbox", { name: "E-mail" })).toHaveValue(updatedEmail);
      await expect(page.locator('input[name="slotId"]')).toHaveValue("");
      await expect(page.getByText("Kontaktní údaje jsme obnovili", { exact: false })).toBeVisible();
    } finally {
      releaseAction();
    }
  });
});
