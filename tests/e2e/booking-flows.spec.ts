import { expect, test, type Locator } from "@playwright/test";
import { BookingSource, BookingStatus, BookingActorType } from "@prisma/client";

import {
  cleanupE2eData,
  createAdminFixture,
  createManagedBookingFixture,
  createPublicBookingFixture,
  createPublicVoucherFixture,
  prisma,
  type E2eFixture,
} from "./helpers/fixtures";

async function clickUntilEnabled(trigger: Locator, target: Locator) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await trigger.click();

    try {
      await expect(target).toBeEnabled({ timeout: 1_000 });
      return;
    } catch {
      await trigger.page().waitForTimeout(250);
    }
  }

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

    const selectedDaySection = page
      .locator("div")
      .filter({ has: page.getByRole("heading", { name: "Sloty pro vybraný den" }) })
      .first();
    const successHeading = page.getByRole("heading", { name: "Rezervace byla úspěšně přesunuta." });
    const confirmButton = page.getByRole("button", { name: "Potvrdit nový termín" });
    const conflictMessage = page
      .getByText(/(nový termín|vybraný (termín|slot)).*(koliduje|není k dispozici)/i)
      .first();
    const selectedDayButtons = selectedDaySection.getByRole("button", { name: /^Vybrat čas / });
    await clickUntilEnabled(
      selectedDayButtons.first(),
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

    await clickUntilEnabled(selectedDayButtons.nth(2), confirmButton);
    await confirmButton.click();
    await expect(successHeading).toBeVisible();

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

  test("owner can log in and confirm a pending booking", async ({ page }) => {
    const fixture = await createManagedBookingFixture(BookingStatus.PENDING);
    const admin = await createAdminFixture(fixture.runId);
    fixtures.push(fixture);

    await page.goto("/admin/prihlaseni");
    await page.getByLabel("E-mail").fill(admin.email);
    await page.getByLabel("Heslo").fill(admin.password);
    await page.getByRole("button", { name: "Přihlásit se" }).click();
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
