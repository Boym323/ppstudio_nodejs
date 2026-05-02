import { expect, test, type Locator, type Page } from "@playwright/test";
import { AdminRole, BookingActorType, BookingSource, BookingStatus } from "@prisma/client";

import {
  cleanupE2eData,
  createAdminFixture,
  createManagedBookingFixture,
  createPublicBookingFixture,
  createPublicVoucherFixture,
  prisma,
  type E2eFixture,
} from "./helpers/fixtures";

async function clickUntilSelected(trigger: Locator, target: Locator) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await trigger.click();

    try {
      await expect(trigger).toHaveAttribute("aria-pressed", "true", { timeout: 1_000 });
      await expect(target).toBeEnabled({ timeout: 1_000 });
      return;
    } catch {
      await trigger.page().waitForTimeout(250);
    }
  }

  await expect(trigger).toHaveAttribute("aria-pressed", "true");
  await expect(target).toBeEnabled();
}

async function clickUntilFocused(trigger: Locator, target: Locator) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await trigger.click();

    try {
      await expect(target).toBeFocused({ timeout: 1_000 });
      return;
    } catch {
      await trigger.page().waitForTimeout(250);
    }
  }

  await expect(target).toBeFocused();
}

async function loginAdmin(page: Page, email: string, password: string) {
  await page.goto("/admin/prihlaseni");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Heslo").fill(password);
  await page.getByRole("button", { name: "Přihlásit se" }).click();
}

function selectedClientCard(page: Page) {
  return page.locator("section").filter({ hasText: "Vybraná klientka" }).first();
}

async function safeClick(page: Page, locator: Locator) {
  await locator.dispatchEvent("click");
  await page.waitForTimeout(100);
}

test.describe("booking flows", () => {
  let fixtures: E2eFixture[] = [];

  test.afterEach(async () => {
    await Promise.all(fixtures.map((fixture) => cleanupE2eData(fixture.runId)));
    fixtures = [];
  });

  test("public visitor can create a pending booking", async ({ page }) => {
    const fixture = await createPublicBookingFixture();
    fixtures.push(fixture);

    await page.goto(`/rezervace?service=${fixture.serviceSlug}`);
    await expect(page.getByText(fixture.serviceName).first()).toBeVisible();
    await clickUntilFocused(
      page.getByRole("button", { name: /^Vybrat termín / }).first(),
      page.getByLabel("Jméno a příjmení"),
    );
    await page.getByLabel("Jméno a příjmení").fill(fixture.clientName);
    await page.getByRole("textbox", { name: /E-mail Sem pošleme potvrzení/ }).fill(fixture.clientEmail);
    await page.getByRole("textbox", { name: /Telefon Hodí se/ }).fill("+420 777 000 000");
    await page.getByRole("button", { name: "Zobrazit souhrn" }).click();
    await page.getByRole("button", { name: "Odeslat rezervaci" }).first().click();

    await expect(page.getByRole("heading", { name: "Rezervace přijata" })).toBeVisible();
    await expect(page.getByText("Čeká na finální potvrzení")).toBeVisible();
    await expect(page.getByText(fixture.serviceName)).toBeVisible();
    await expect(page.getByRole("link", { name: "Změnit termín" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Zrušit rezervaci" })).toHaveCount(0);

    const booking = await prisma.booking.findFirstOrThrow({
      where: {
        clientEmailSnapshot: fixture.clientEmail,
      },
      include: {
        actionTokens: true,
      },
    });

    expect(booking.status).toBe(BookingStatus.PENDING);
    expect(booking.actionTokens.map((token) => token.type).sort()).toEqual([
      "APPROVE",
      "CANCEL",
      "REJECT",
      "RESCHEDULE",
    ]);
  });

  test("public visitor can verify a voucher code safely", async ({ page }) => {
    const fixture = await createPublicVoucherFixture();
    fixtures.push(fixture);

    await page.goto(`/vouchery/overeni?code=${fixture.voucherCode}`);

    await expect(page.getByRole("heading", { name: "Ověření dárkového poukazu" })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByLabel("Kód voucheru")).toHaveValue(fixture.voucherCode ?? "");
    await expect(page.getByText("Voucher je platný")).toBeVisible();
    await expect(page.getByText("Hodnotový poukaz")).toBeVisible();
    await expect(page.getByText(/1\s*500\s*Kč/)).toBeVisible();
    await expect(page.getByText(fixture.voucherCode ?? "")).toBeVisible();
    await expect(page.getByText("secret.example.test")).toHaveCount(0);
    await expect(page.getByText("E2E tajná poznámka")).toHaveCount(0);
  });

  test("client can cancel a booking through a public token", async ({ page }) => {
    const fixture = await createManagedBookingFixture();
    fixtures.push(fixture);

    await page.goto(`/rezervace/storno/${fixture.cancelToken}`);
    await expect(page.getByRole("heading", { name: "Opravdu chcete zrušit rezervaci?" })).toBeVisible();
    await page.getByRole("button", { name: "Potvrdit storno" }).click();

    await expect(page.getByRole("heading", { name: new RegExp(`Hotovo, ${fixture.clientName}`) })).toBeVisible();

    const booking = await prisma.booking.findUniqueOrThrow({
      where: {
        id: fixture.bookingId,
      },
      include: {
        statusHistory: true,
      },
    });

    expect(booking.status).toBe(BookingStatus.CANCELLED);
    expect(booking.cancelledAt).toBeTruthy();
    expect(booking.statusHistory.some((item) => item.status === BookingStatus.CANCELLED)).toBe(true);
  });

  test("client can reschedule a booking through a public token", async ({ page }) => {
    test.setTimeout(60_000);

    const fixture = await createManagedBookingFixture();
    fixtures.push(fixture);

    await page.goto(`/rezervace/sprava/${fixture.manageToken}`);
    await expect(page.getByRole("heading", { name: "Změna termínu rezervace" })).toBeVisible();

    const managedBooking = await prisma.booking.findUniqueOrThrow({
      where: {
        id: fixture.bookingId,
      },
      select: {
        serviceId: true,
        serviceDurationMinutes: true,
        servicePriceFromCzk: true,
      },
    });

    const successHeading = page.getByRole("heading", { name: "Rezervace byla úspěšně přesunuta." });
    const confirmButton = page.getByRole("button", { name: "Potvrdit nový termín" });
    const conflictMessage = page
      .getByText(/(nový termín|vybraný (termín|slot)).*(koliduje|není k dispozici)/i)
      .first();
    await clickUntilSelected(
      page.getByRole("button", { name: fixture.slotLabels.rescheduleConflictButtonLabel }).first(),
      confirmButton,
    );
    const selectedSlotId = await page.locator('input[name="slotId"]').inputValue();
    const selectedStartIso = await page.locator('input[name="newStartAt"]').inputValue();
    const selectedStart = new Date(selectedStartIso);
    const selectedEnd = new Date(selectedStart.getTime() + managedBooking.serviceDurationMinutes * 60 * 1000);

    const conflictClient = await prisma.client.create({
      data: {
        fullName: `E2E Runtime Kolize ${fixture.runId}`,
        email: `${fixture.runId}-runtime-conflict@example.test`,
        phone: "+420777000002",
        lastBookedAt: selectedStart,
      },
    });

    await prisma.booking.create({
      data: {
        clientId: conflictClient.id,
        slotId: selectedSlotId,
        serviceId: managedBooking.serviceId,
        source: BookingSource.WEB,
        status: BookingStatus.CONFIRMED,
        clientNameSnapshot: conflictClient.fullName,
        clientEmailSnapshot: conflictClient.email ?? `${fixture.runId}-runtime-conflict@example.test`,
        clientPhoneSnapshot: conflictClient.phone,
        serviceNameSnapshot: fixture.serviceName,
        serviceDurationMinutes: managedBooking.serviceDurationMinutes,
        servicePriceFromCzk: managedBooking.servicePriceFromCzk,
        scheduledStartsAt: selectedStart,
        scheduledEndsAt: selectedEnd,
        confirmedAt: new Date(),
        statusHistory: {
          create: {
            status: BookingStatus.CONFIRMED,
            actorType: BookingActorType.SYSTEM,
            note: "E2E runtime conflict booking",
          },
        },
      },
    });

    await confirmButton.click();
    await expect(conflictMessage).toBeVisible();

    await clickUntilSelected(
      page.getByRole("button", { name: fixture.slotLabels.rescheduleSuccessButtonLabel }).first(),
      confirmButton,
    );
    await expect(page.locator('input[name="newStartAt"]')).toHaveValue(fixture.slotLabels.rescheduleSuccessStartAt);
    await expect(page.locator('input[name="newStartAt"]')).not.toHaveValue(selectedStartIso);
    await confirmButton.click();
    try {
      await expect(successHeading).toBeVisible({ timeout: 30_000 });
    } catch (error) {
      const formError = (await page.locator("text=Změnu termínu se teď nepodařilo uložit. Zkuste to prosím znovu.").count()) > 0
        ? "Změnu termínu se teď nepodařilo uložit. Zkuste to prosím znovu."
        : (await page.locator("text=Vyberte prosím nový termín a potvrďte změnu.").count()) > 0
          ? "Vyberte prosím nový termín a potvrďte změnu."
          : (await conflictMessage.count()) > 0
            ? await conflictMessage.first().innerText()
            : "Neznámý stav formuláře bez success headingu.";
      throw new Error(`Reschedule success heading se neukázal. Poslední stav formuláře: ${formError}`, {
        cause: error,
      });
    }

    const booking = await prisma.booking.findUniqueOrThrow({
      where: {
        id: fixture.bookingId,
      },
      include: {
        rescheduleLogs: true,
      },
    });

    expect(booking.rescheduleCount).toBe(1);
    expect(booking.rescheduledAt).toBeTruthy();
    expect(booking.rescheduleLogs.some((item) => item.changedByClient)).toBe(true);
  });

  test("owner can open manual booking from client detail and create a booking for the prefilled client", async ({ page }) => {
    const fixture = await createManagedBookingFixture();
    const admin = await createAdminFixture(fixture.runId, AdminRole.OWNER);
    fixtures.push(fixture);

    await loginAdmin(page, admin.email, admin.password);
    await expect(page).toHaveURL(/\/admin/);

    await page.goto(`/admin/klienti/${fixture.clientId!}`);
    const createBookingLink = page.getByRole("link", { name: "Vytvořit rezervaci" }).first();
    await expect(createBookingLink).toHaveAttribute(
      "href",
      `/admin/rezervace?create=1&clientId=${fixture.clientId!}`,
    );

    await createBookingLink.click();
    await expect(page).toHaveURL(
      new RegExp(`/admin/rezervace\\?create=1&clientId=${fixture.clientId!}`),
    );
    await expect(page.getByRole("heading", { name: "Vytvořit rezervaci v administraci" })).toBeVisible();
    await expect(page.getByText("Vybraná klientka")).toBeVisible();
    await expect(selectedClientCard(page).getByText(fixture.clientName)).toBeVisible();
    await expect(selectedClientCard(page).getByText(fixture.clientEmail)).toBeVisible();

    await page.getByLabel("Služba").selectOption({ label: fixture.serviceName });
    await safeClick(page, page.getByRole("button", { name: fixture.slotLabels.rescheduleConflictButtonLabel }).first());
    await expect(page.locator('input[name="startsAt"]')).toHaveValue(fixture.slotLabels.rescheduleStartAt);
    await page.getByRole("button", { name: "Vytvořit rezervaci" }).last().click();
    await expect.poll(async () => prisma.booking.count({
      where: {
        clientId: fixture.clientId!,
        source: BookingSource.PHONE,
        scheduledStartsAt: new Date(fixture.slotLabels.rescheduleStartAt),
      },
    })).toBe(1);

    const booking = await prisma.booking.findFirstOrThrow({
      where: {
        clientId: fixture.clientId!,
        source: BookingSource.PHONE,
        scheduledStartsAt: new Date(fixture.slotLabels.rescheduleStartAt),
      },
    });

    expect(booking.status).toBe(BookingStatus.CONFIRMED);
  });

  test("salon sees manual booking action on client detail and gets the same prefilled flow", async ({ page }) => {
    const fixture = await createManagedBookingFixture();
    const admin = await createAdminFixture(fixture.runId, AdminRole.SALON);
    fixtures.push(fixture);

    await loginAdmin(page, admin.email, admin.password);

    await page.goto(`/admin/provoz/klienti/${fixture.clientId!}`);
    const createBookingLink = page.getByRole("link", { name: "Vytvořit rezervaci" }).first();
    await expect(createBookingLink).toHaveAttribute(
      "href",
      `/admin/provoz/rezervace?create=1&clientId=${fixture.clientId!}`,
    );

    await createBookingLink.click();
    await expect(page).toHaveURL(
      new RegExp(`/admin/provoz/rezervace\\?create=1&clientId=${fixture.clientId!}`),
    );
    await expect(page.getByRole("heading", { name: "Vytvořit rezervaci v administraci" })).toBeVisible();
    await expect(page.getByText("Vybraná klientka")).toBeVisible();
    await expect(selectedClientCard(page).getByText(fixture.clientName)).toBeVisible();
  });

  test("manual booking drawer stays usable without or with invalid clientId prefill", async ({ page }) => {
    const fixture = await createManagedBookingFixture();
    const admin = await createAdminFixture(fixture.runId, AdminRole.OWNER);
    fixtures.push(fixture);

    await loginAdmin(page, admin.email, admin.password);
    await expect(page).toHaveURL(/\/admin/);

    await page.goto("/admin/rezervace");
    await expect(page.getByRole("heading", { name: "Vytvořit rezervaci v administraci" })).toHaveCount(0);
    await page.getByRole("button", { name: "Přidat rezervaci" }).click();
    await expect(page.getByRole("heading", { name: "Vytvořit rezervaci v administraci" })).toBeVisible();
    await expect(page.getByText("Vybraná klientka")).toHaveCount(0);
    await page.getByRole("button", { name: "Zrušit" }).click();

    await page.goto("/admin/rezervace?create=1&clientId=missing-client");
    await expect(page.getByRole("heading", { name: "Vytvořit rezervaci v administraci" })).toBeVisible();
    await expect(page.getByText("Klientku se nepodařilo předvyplnit.")).toBeVisible();
    await expect(page.getByText("Vybraná klientka")).toHaveCount(0);
  });

  test("manual booking prefill warns when the selected client is inactive", async ({ page }) => {
    const fixture = await createManagedBookingFixture();
    const admin = await createAdminFixture(fixture.runId, AdminRole.OWNER);
    fixtures.push(fixture);

    await prisma.client.update({
      where: {
        id: fixture.clientId!,
      },
      data: {
        isActive: false,
      },
    });

    await loginAdmin(page, admin.email, admin.password);
    await expect(page).toHaveURL(/\/admin/);

    await page.goto(`/admin/rezervace?create=1&clientId=${fixture.clientId!}`);
    await expect(page.getByText("Klientka je neaktivní.")).toBeVisible();
    await expect(selectedClientCard(page).getByText(fixture.clientName)).toBeVisible();
  });

  test("manual booking keeps overlap validation active for prefilled clients", async ({ page }) => {
    const fixture = await createManagedBookingFixture();
    const admin = await createAdminFixture(fixture.runId, AdminRole.OWNER);
    fixtures.push(fixture);

    await loginAdmin(page, admin.email, admin.password);
    await expect(page).toHaveURL(/\/admin/);

    await page.goto(`/admin/rezervace?create=1&clientId=${fixture.clientId!}`);
    await page.getByLabel("Služba").selectOption({ label: fixture.serviceName });
    await safeClick(page, page.getByRole("button", { name: "Ruční zadání" }));
    await expect(page.getByLabel("Datum")).toBeVisible();
    await page.getByLabel("Datum").fill(fixture.slotLabels.primaryDateKey);
    await page.getByLabel("Čas od").fill(fixture.slotLabels.primaryTime);
    await page.getByRole("button", { name: "Vytvořit rezervaci" }).last().click();

    await expect(
      page.getByText(/(koliduje|není k dispozici|obsazen)/i).first(),
    ).toBeVisible();
  });

  test("guest cannot access admin manual booking flow", async ({ page }) => {
    await page.goto("/admin/rezervace?create=1&clientId=missing-client");
    await expect(page).toHaveURL(/\/admin\/prihlaseni/);
  });

  test("owner can log in and confirm a pending booking", async ({ page }) => {
    const fixture = await createManagedBookingFixture(BookingStatus.PENDING);
    const admin = await createAdminFixture(fixture.runId);
    fixtures.push(fixture);

    await loginAdmin(page, admin.email, admin.password);
    await expect(page).toHaveURL(/\/admin/);

    await page.goto(`/admin/rezervace/${fixture.bookingId}`);
    await page.getByRole("radio", { name: /Potvrdit/ }).click();
    await page.getByLabel("Volitelný důvod").fill("E2E potvrzení");
    await page.getByRole("button", { name: "Potvrdit rezervaci" }).click();

    await expect(page.getByText("Změna byla uložená a propsala se i do historie rezervace.")).toBeVisible();

    const booking = await prisma.booking.findUniqueOrThrow({
      where: {
        id: fixture.bookingId,
      },
    });

    expect(booking.status).toBe(BookingStatus.CONFIRMED);
    expect(booking.confirmedAt).toBeTruthy();
  });
});
