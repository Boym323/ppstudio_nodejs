import { expect, test, type Locator } from "@playwright/test";
import { BookingStatus } from "@prisma/client";

import {
  cleanupE2eData,
  createAdminFixture,
  createManagedBookingFixture,
  createPublicBookingFixture,
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

    const newTermsSection = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Nejbližší dostupné termíny" }) })
      .first();
    const firstAvailableSlot = newTermsSection.getByRole("button").first();

    await clickUntilEnabled(firstAvailableSlot, page.getByRole("button", { name: "Potvrdit nový termín" }));
    await page.getByRole("button", { name: "Potvrdit nový termín" }).click();

    await expect(
      page.getByRole("heading", { name: "Rezervace byla úspěšně přesunuta." }),
    ).toBeVisible({ timeout: 30_000 });

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
