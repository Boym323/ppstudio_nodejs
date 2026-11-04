import { randomBytes } from "crypto";

import { expect, test, type Page } from "@playwright/test";
import { AdminRole } from "@/generated/prisma/client";

import { cleanupE2eData, createAdminFixture, prisma } from "./helpers/fixtures";

async function loginAdmin(page: Page, email: string, password: string) {
  await page.goto("/admin/prihlaseni");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Heslo").fill(password);
  await page.getByRole("button", { name: "Přihlásit se" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function expectNoPageOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test.describe("seznam klientek", () => {
  let runId = "";
  let clientName = "";
  let admin: { email: string; password: string };

  test.beforeEach(async ({ page }) => {
    runId = `clients-visual-${Date.now()}-${randomBytes(4).toString("hex")}`;
    clientName = `Vizuální klientka ${runId}`;
    admin = await createAdminFixture(runId, AdminRole.OWNER);
    await prisma.client.create({
      data: {
        fullName: clientName,
        email: `${runId}@example.test`,
        phone: "+420777123456",
      },
    });
    await loginAdmin(page, admin.email, admin.password);
  });

  test.afterEach(async () => {
    await cleanupE2eData(runId);
  });

  test("desktop zobrazí tržbu a řazení podle tržby bez přetečení", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/admin/klienti?query=${encodeURIComponent(runId)}&sort=revenue`);

    await expect(page.getByRole("heading", { name: "Seznam klientů" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Tržba" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Řazení" })).toHaveValue("revenue");
    await expect(page.getByRole("link", { name: clientName })).toBeVisible();
    await expectNoPageOverflow(page);
  });

  test("mobilní karta zobrazí tržbu bez vodorovného přetečení", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/admin/klienti?query=${encodeURIComponent(runId)}`);

    await expect(page.getByRole("heading", { name: clientName })).toBeVisible();
    await expect(page.getByRole("article", { name: `Otevřít detail klientky ${clientName}` }).getByText("Tržba")).toBeVisible();
    await expectNoPageOverflow(page);
  });

  test("kontaktní odkazy mobilní karty neotevírají detail klientky", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/admin/klienti?query=${encodeURIComponent(runId)}`);
    const listUrl = page.url();
    const card = page.getByRole("article", { name: `Otevřít detail klientky ${clientName}` });
    const contacts = card.locator('a[href^="mailto:"], a[href^="tel:"]');
    await expect(contacts).toHaveCount(4);

    for (const contact of await contacts.all()) {
      for (const key of ["Enter", " "]) {
        const allowsDefault = await contact.evaluate((element, key) => element.dispatchEvent(
          new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
        ), key);
        expect(allowsDefault).toBe(true);
      }
      // Zamezíme spuštění externí pošty/telefonu, událost ale dál probublá ke kartě.
      await contact.evaluate((element) => element.addEventListener("click", (event) => event.preventDefault(), { once: true }));
      await contact.click();
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
      await expect(page).toHaveURL(listUrl);
      await expect(card).toBeVisible();
    }
  });

  test("mobilní kartu lze stále otevřít kliknutím i klávesnicí", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const listPath = `/admin/klienti?query=${encodeURIComponent(runId)}`;
    for (const activation of ["click", "Enter", "Space"]) {
      await page.goto(listPath);
      const card = page.getByRole("article", { name: `Otevřít detail klientky ${clientName}` });
      const detailHref = await card.getByRole("link", { name: "Detail", exact: true }).getAttribute("href");
      expect(detailHref).toBeTruthy();
      if (activation === "click") await card.getByRole("heading", { name: clientName }).click();
      else await card.press(activation);
      await expect(page).toHaveURL(new URL(detailHref!, page.url()).href);
    }
  });
});
