import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  AdminRole,
  AvailabilitySlotServiceRestrictionMode,
  AvailabilitySlotStatus,
  BookingActorType,
  BookingSource,
  BookingStatus,
} from "@prisma/client";

import {
  cleanupE2eData,
  createAdminFixture,
  createFragmentedCancellationFixture,
  createManagedBookingFixture,
  createPublicBookingFixture,
  createPublicVoucherFixture,
  prisma,
  type E2eFixture,
} from "./helpers/fixtures";

async function selectSlotById(
  page: Page,
  slotButtonLabel: string,
  expectedSlotId: string,
  actionButton: Locator,
) {
  const exactSlotButton = page.getByRole("button", { name: slotButtonLabel });
  const slotDateLabelMatch = slotButtonLabel.match(/ dne (.+)$/);
  const slotDateLabel = slotDateLabelMatch?.[1];

  if ((await exactSlotButton.count()) === 0 && slotDateLabel) {
    const dateButton = page.getByRole("button", { name: `Vybrat den ${slotDateLabel}` });

    if ((await dateButton.count()) > 0) {
      await dateButton.click();
      await expect(exactSlotButton.first()).toBeVisible();
    }
  }

  const selectors = [
    exactSlotButton,
    page.getByRole("button", { name: /^Vybrat čas / }),
  ];

  for (const candidates of selectors) {
    const count = await candidates.count();

    for (let index = 0; index < count; index += 1) {
      const candidate = candidates.nth(index);
      await candidate.click();
      await page.waitForTimeout(100);

      const selectedSlotId = await page.locator('input[name="slotId"]').inputValue();
      if (selectedSlotId === expectedSlotId && (await actionButton.isEnabled())) {
        return;
      }
    }
  }

  throw new Error(
    `Nepodařilo se vybrat očekávaný slot ${expectedSlotId} pro tlačítko \"${slotButtonLabel}\".`,
  );
}

async function submitRescheduleUntilSuccess(
  page: Page,
  confirmButton: Locator,
  successHeading: Locator,
  conflictMessage: Locator,
  attemptedSlotIds: Set<string>,
) {
  const slotButtons = page.getByRole("button", { name: /^Vybrat čas / });
  const buttonCount = await slotButtons.count();

  for (let index = 0; index < buttonCount; index += 1) {
    const candidate = slotButtons.nth(index);
    await candidate.click();
    await page.waitForTimeout(100);

    if ((await successHeading.count()) > 0) {
      return;
    }

    const slotInput = page.locator('input[name="slotId"]');
    if ((await slotInput.count()) === 0) {
      continue;
    }

    let slotId: string;
    try {
      slotId = await slotInput.first().inputValue({ timeout: 1_000 });
    } catch {
      continue;
    }

    if (attemptedSlotIds.has(slotId) || !(await confirmButton.isEnabled())) {
      continue;
    }

    attemptedSlotIds.add(slotId);
    await confirmButton.click();

    try {
      await expect(successHeading).toBeVisible({ timeout: 2_000 });
      return;
    } catch {
      if ((await conflictMessage.count()) > 0) {
        continue;
      }
    }
  }
}

async function expectSelectedRescheduleSlot(
  page: Page,
  expected: {
    slotId: string;
    startsAt: string;
  },
) {
  await expect.poll(async () => ({
    slotId: await page.locator('input[name="slotId"]').inputValue(),
    startsAt: await page.locator('input[name="newStartAt"]').inputValue(),
  })).toEqual(expected);
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

async function installMetaPixelSpy(page: Page) {
  await page.addInitScript(() => {
    window.__metaPixelCalls = [];
  });
}

async function getMetaPixelEventNames(page: Page) {
  return page.evaluate(() => {
    const calls = (window as Window & { __metaPixelCalls?: unknown[][] }).__metaPixelCalls ?? [];

    return calls.map((call) => `${String(call[0])}:${String(call[1])}`);
  });
}

async function expectMetaPixelEvent(page: Page, eventName: string) {
  await expect
    .poll(async () => getMetaPixelEventNames(page))
    .toContain(eventName);
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

function addMinutes(value: Date, minutes: number) {
  return new Date(value.getTime() + minutes * 60 * 1000);
}

function formatPragueTime(value: Date) {
  return new Intl.DateTimeFormat("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Prague",
  }).format(value);
}

function formatPragueDateKey(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Prague",
  }).formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error(`Could not format Prague date key for ${value.toISOString()}`);
  }

  return `${year}-${month}-${day}`;
}

function buildPublicSlotButtonLabel(startsAt: Date) {
  return `Vybrat termín ${formatPragueDateKey(startsAt)} ${formatPragueTime(startsAt)}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function roundUpToHalfHour(value: Date) {
  const copy = new Date(value);
  copy.setUTCSeconds(0, 0);
  const minutes = copy.getUTCMinutes();

  if (minutes === 0 || minutes === 30) {
    return copy;
  }

  if (minutes < 30) {
    copy.setUTCMinutes(30, 0, 0);
    return copy;
  }

  copy.setUTCHours(copy.getUTCHours() + 1, 0, 0, 0);
  return copy;
}

test.describe("booking flows", () => {
  let fixtures: E2eFixture[] = [];

  test.afterEach(async () => {
    await Promise.all(fixtures.map((fixture) => cleanupE2eData(fixture.runId)));
    fixtures = [];
  });

  test("public booking cancellation compacts fragmented availability in planner", async ({ page }) => {
    const fixture = await createFragmentedCancellationFixture();
    fixtures.push(fixture);

    await loginAdmin(page, fixture.adminEmail, fixture.adminPassword);
    await expect(page).toHaveURL(/\/admin/);

    await page.goto(`/admin/volne-terminy?week=${fixture.planner.weekKey}&day=${fixture.planner.dayKey}`);
    await expect(page.getByRole("heading", { name: "Volné termíny" })).toBeVisible();
    await expect(page.getByText(fixture.planner.beforeCancellationWindows[0], { exact: true })).toBeVisible();
    await expect(page.getByText(fixture.planner.beforeCancellationWindows[1], { exact: true })).toBeVisible();

    await page.goto(`/rezervace/storno/${fixture.cancelToken}`);
    await expect(page.getByRole("heading", { name: "Opravdu chcete zrušit rezervaci?" })).toBeVisible();
    await page.getByRole("button", { name: "Potvrdit storno" }).click();
    await expect(page.getByText("Rezervace zrušena")).toBeVisible();

    await page.goto(`/admin/volne-terminy?week=${fixture.planner.weekKey}&day=${fixture.planner.dayKey}`);
    await expect(page.getByRole("heading", { name: "Volné termíny" })).toBeVisible();
    await expect(page.getByText(fixture.planner.afterCancellationWindow, { exact: true })).toBeVisible();
    await expect(page.getByText(fixture.planner.beforeCancellationWindows[0], { exact: true })).toHaveCount(0);
    await expect(page.getByText(fixture.planner.beforeCancellationWindows[1], { exact: true })).toHaveCount(0);
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
    await page.getByRole("textbox", { name: "E-mail" }).fill(fixture.clientEmail);
    await page.getByRole("textbox", { name: "Telefon" }).fill("+420 777 000 000");
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

  test("public booking availability respects cleanup block while keeping client-visible service end", async ({ page }) => {
    const runId = `e2e-cleanup-${Date.now().toString(36)}`;
    const fixture: E2eFixture = {
      runId,
      serviceName: "",
      serviceSlug: "",
      categoryName: "",
      clientName: "",
      clientEmail: "",
      slotLabels: {
        primaryDateKey: "",
        primaryTime: "",
        rescheduleDateKey: "",
        rescheduleTime: "",
        rescheduleConflictButtonLabel: "",
        rescheduleConflictSlotId: "",
        rescheduleSuccessButtonLabel: "",
        rescheduleSuccessSlotId: "",
        rescheduleSuccessStartAt: "",
        primaryStartAt: "",
        rescheduleStartAt: "",
      },
    };
    fixtures.push(fixture);

    const categoryName = `E2E cleanup category ${runId}`;
    const serviceName = `E2E cleanup service ${runId}`;
    const serviceSlug = slugify(serviceName);
    const serviceDurationMinutes = 60;
    const servicePriceFromCzk = 900;

    const category = await prisma.serviceCategory.create({
      data: {
        name: categoryName,
        slug: slugify(categoryName),
        publicName: categoryName,
        description: "Dočasná E2E kategorie pro cleanup scénář.",
        sortOrder: -10_000,
        pricingSortOrder: -10_000,
        isActive: true,
      },
    });

    const service = await prisma.service.create({
      data: {
        categoryId: category.id,
        name: serviceName,
        publicName: serviceName,
        slug: serviceSlug,
        shortDescription: "Dočasná E2E služba pro cleanup scénář.",
        publicIntro: "Dočasná E2E služba pro cleanup scénář.",
        description: "Dočasná E2E služba pro cleanup scénář.",
        seoDescription: "Dočasná E2E služba pro cleanup scénář.",
        durationMinutes: serviceDurationMinutes,
        cleanupMinutes: 10,
        priceFromCzk: servicePriceFromCzk,
        sortOrder: -10_000,
        isActive: true,
        isPubliclyBookable: true,
      },
    });

    fixture.serviceName = serviceName;
    fixture.serviceSlug = serviceSlug;
    fixture.categoryName = categoryName;

    const siteSettings = await prisma.siteSettings.findUnique({
      where: { id: "site-settings" },
      select: {
        bookingMinAdvanceHours: true,
        bookingMaxAdvanceDays: true,
      },
    });
    const minAdvanceHours = siteSettings?.bookingMinAdvanceHours ?? 2;
    const maxAdvanceDays = siteSettings?.bookingMaxAdvanceDays ?? 90;
    const slotDurationMinutes = 4 * 60;
    const minSafeStart = roundUpToHalfHour(addMinutes(new Date(), (minAdvanceHours + 10) * 60));
    const maxSafeStart = roundUpToHalfHour(addMinutes(
      new Date(),
      maxAdvanceDays * 24 * 60 - slotDurationMinutes,
    ));
    const blockedBookingStart = minSafeStart > maxSafeStart ? maxSafeStart : minSafeStart;
    const blockedBookingEnd = addMinutes(blockedBookingStart, serviceDurationMinutes);
    const blockedUntil = addMinutes(blockedBookingEnd, 15);
    const releasedStart = blockedUntil;
    const releasedServiceEnd = addMinutes(releasedStart, serviceDurationMinutes);

    const slot = await prisma.availabilitySlot.create({
      data: {
        startsAt: blockedBookingStart,
        endsAt: addMinutes(blockedBookingStart, 4 * 60),
        capacity: 1,
        status: AvailabilitySlotStatus.PUBLISHED,
        serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.SELECTED,
        publishedAt: new Date(),
        publicNote: `E2E cleanup ${runId}`,
        allowedServices: {
          create: {
            serviceId: service.id,
          },
        },
      },
    });

    const client = await prisma.client.create({
      data: {
        fullName: `E2E Cleanup Client ${runId}`,
        email: `${runId}-cleanup-client@example.test`,
        phone: "+420777000003",
        lastBookedAt: blockedBookingStart,
      },
    });

    await prisma.booking.create({
      data: {
        clientId: client.id,
        slotId: slot.id,
        serviceId: service.id,
        source: BookingSource.WEB,
        status: BookingStatus.CONFIRMED,
        clientNameSnapshot: client.fullName,
        clientEmailSnapshot: client.email ?? `${runId}-cleanup-client@example.test`,
        clientPhoneSnapshot: client.phone,
        serviceNameSnapshot: service.name,
        serviceDurationMinutes,
        servicePriceFromCzk,
        cleanupMinutes: 10,
        cleanupBlockMinutes: 15,
        scheduledStartsAt: blockedBookingStart,
        scheduledEndsAt: blockedBookingEnd,
        blockedUntil,
        confirmedAt: new Date(),
        statusHistory: {
          create: {
            status: BookingStatus.CONFIRMED,
            actorType: BookingActorType.SYSTEM,
            note: "E2E cleanup block booking",
          },
        },
      },
    });

    await page.goto(`/rezervace?service=${serviceSlug}`);
    await expect(page.getByText(serviceName).first()).toBeVisible();

    const blockedStartButton = page
      .getByRole("button", { name: buildPublicSlotButtonLabel(blockedBookingEnd) });
    const blockedStartCount = await blockedStartButton.count();
    if (blockedStartCount > 0) {
      await expect(blockedStartButton.first()).toBeDisabled();
    }

    const releasedStartButton = page
      .getByRole("button", { name: buildPublicSlotButtonLabel(releasedStart) })
      .first();
    await expect(releasedStartButton).toBeVisible();
    await expect(releasedStartButton).toBeEnabled();
    await clickUntilFocused(releasedStartButton, page.getByLabel("Jméno a příjmení"));

    await expect(page.getByText(`Konec ${formatPragueTime(releasedServiceEnd)}`)).toBeVisible();
    await expect(page.getByText(new RegExp(`${serviceDurationMinutes}\\s*min`)).first()).toBeVisible();
    await expect(page.getByText("Úklid po službě")).toHaveCount(0);
    await expect(page.getByText("Interně blokováno do")).toHaveCount(0);
  });

  test("public booking allows the last client-visible start in a slot even when cleanup overflows past slot end", async ({ page }) => {
    const runId = `e2e-cleanup-overflow-${Date.now().toString(36)}`;
    const fixture: E2eFixture = {
      runId,
      serviceName: "",
      serviceSlug: "",
      categoryName: "",
      clientName: "",
      clientEmail: "",
      slotLabels: {
        primaryDateKey: "",
        primaryTime: "",
        rescheduleDateKey: "",
        rescheduleTime: "",
        rescheduleConflictButtonLabel: "",
        rescheduleConflictSlotId: "",
        rescheduleSuccessButtonLabel: "",
        rescheduleSuccessSlotId: "",
        rescheduleSuccessStartAt: "",
        primaryStartAt: "",
        rescheduleStartAt: "",
      },
    };
    fixtures.push(fixture);

    const categoryName = `E2E cleanup overflow category ${runId}`;
    const serviceName = `E2E cleanup overflow service ${runId}`;
    const serviceSlug = slugify(serviceName);
    const serviceDurationMinutes = 60;
    const servicePriceFromCzk = 900;

    const category = await prisma.serviceCategory.create({
      data: {
        name: categoryName,
        slug: slugify(categoryName),
        publicName: categoryName,
        description: "Dočasná E2E kategorie pro cleanup overflow scénář.",
        sortOrder: -10_000,
        pricingSortOrder: -10_000,
        isActive: true,
      },
    });

    const service = await prisma.service.create({
      data: {
        categoryId: category.id,
        name: serviceName,
        publicName: serviceName,
        slug: serviceSlug,
        shortDescription: "Dočasná E2E služba pro cleanup overflow scénář.",
        publicIntro: "Dočasná E2E služba pro cleanup overflow scénář.",
        description: "Dočasná E2E služba pro cleanup overflow scénář.",
        seoDescription: "Dočasná E2E služba pro cleanup overflow scénář.",
        durationMinutes: serviceDurationMinutes,
        cleanupMinutes: 10,
        priceFromCzk: servicePriceFromCzk,
        sortOrder: -10_000,
        isActive: true,
        isPubliclyBookable: true,
      },
    });

    fixture.serviceName = serviceName;
    fixture.serviceSlug = serviceSlug;
    fixture.categoryName = categoryName;

    const siteSettings = await prisma.siteSettings.findUnique({
      where: { id: "site-settings" },
      select: {
        bookingMinAdvanceHours: true,
        bookingMaxAdvanceDays: true,
      },
    });
    const minAdvanceHours = siteSettings?.bookingMinAdvanceHours ?? 2;
    const maxAdvanceDays = siteSettings?.bookingMaxAdvanceDays ?? 90;
    const slotDurationMinutes = 60;
    const minSafeStart = roundUpToHalfHour(addMinutes(new Date(), (minAdvanceHours + 10) * 60));
    const maxSafeStart = roundUpToHalfHour(addMinutes(
      new Date(),
      maxAdvanceDays * 24 * 60 - slotDurationMinutes,
    ));
    const slotStart = minSafeStart > maxSafeStart ? maxSafeStart : minSafeStart;
    const slotEnd = addMinutes(slotStart, slotDurationMinutes);

    await prisma.availabilitySlot.create({
      data: {
        startsAt: slotStart,
        endsAt: slotEnd,
        capacity: 1,
        status: AvailabilitySlotStatus.PUBLISHED,
        serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.SELECTED,
        publishedAt: new Date(),
        publicNote: `E2E cleanup overflow primary ${runId}`,
        allowedServices: {
          create: {
            serviceId: service.id,
          },
        },
      },
    });

    await page.goto(`/rezervace?service=${serviceSlug}`);
    await expect(page.getByText(serviceName).first()).toBeVisible();

    const slotStartButton = page
      .getByRole("button", { name: buildPublicSlotButtonLabel(slotStart) })
      .first();
    await expect(slotStartButton).toBeVisible();
    await expect(slotStartButton).toBeEnabled();
    await clickUntilFocused(slotStartButton, page.getByLabel("Jméno a příjmení"));

    await expect(page.getByText(`Konec ${formatPragueTime(slotEnd)}`)).toBeVisible();
    await expect(page.getByText(new RegExp(`${serviceDurationMinutes}\\s*min`)).first()).toBeVisible();
    await expect(page.getByText("Úklid po službě")).toHaveCount(0);
    await expect(page.getByText("Interně blokováno do")).toHaveCount(0);
  });

  test("valid service slug preselects the service and keeps marketing params intact", async ({ page }) => {
    const fixture = await createPublicBookingFixture();
    fixtures.push(fixture);

    const service = await prisma.service.findFirstOrThrow({
      where: {
        slug: fixture.serviceSlug,
      },
      select: {
        id: true,
      },
    });

    await page.goto(
      `/rezervace?service=${fixture.serviceSlug}&utm_source=instagram&utm_medium=social&mtm_campaign=jaro-2026`,
    );

    await expect(page.locator('input[name="serviceId"]')).toHaveValue(service.id);
    await expect(page.getByText(fixture.serviceName).first()).toBeVisible();

    const currentUrl = new URL(page.url());
    expect(currentUrl.searchParams.get("service")).toBe(fixture.serviceSlug);
    expect(currentUrl.searchParams.get("utm_source")).toBe("instagram");
    expect(currentUrl.searchParams.get("utm_medium")).toBe("social");
    expect(currentUrl.searchParams.get("mtm_campaign")).toBe("jaro-2026");
  });

  test("unknown service slug is ignored safely", async ({ page }) => {
    const fixture = await createPublicBookingFixture();
    fixtures.push(fixture);

    await page.goto("/rezervace?service=neznamy-slug");

    await expect(page.locator('input[name="serviceId"]')).toHaveValue("");
    await page.locator('button[aria-pressed]').filter({ hasText: fixture.categoryName }).first().click();
    await expect(page.getByText(fixture.serviceName).first()).toBeVisible();
  });

  test("inactive or non-public service slug is not preselected", async ({ page }) => {
    const inactiveFixture = await createPublicBookingFixture();
    const fallbackFixture = await createPublicBookingFixture();
    fixtures.push(inactiveFixture, fallbackFixture);

    const targetService = await prisma.service.findFirstOrThrow({
      where: {
        slug: inactiveFixture.serviceSlug,
      },
      select: {
        id: true,
      },
    });

    await prisma.service.update({
      where: {
        id: targetService.id,
      },
      data: {
        isActive: false,
      },
    });

    await page.goto(`/rezervace?service=${inactiveFixture.serviceSlug}`);
    await expect(page.locator('input[name="serviceId"]')).toHaveValue("");
    await page.locator('button[aria-pressed]').filter({ hasText: fallbackFixture.categoryName }).first().click();
    await expect(page.getByText(fallbackFixture.serviceName).first()).toBeVisible();

    await prisma.service.update({
      where: {
        id: targetService.id,
      },
      data: {
        isActive: true,
        isPubliclyBookable: false,
      },
    });

    await page.goto(`/rezervace?service=${inactiveFixture.serviceSlug}`);
    await expect(page.locator('input[name="serviceId"]')).toHaveValue("");
    await page.locator('button[aria-pressed]').filter({ hasText: fallbackFixture.categoryName }).first().click();
    await expect(page.getByText(fallbackFixture.serviceName).first()).toBeVisible();
  });

  test("service detail links to booking with the service slug", async ({ page }) => {
    const fixture = await createPublicBookingFixture();
    fixtures.push(fixture);

    await page.goto(`/sluzby/${fixture.serviceSlug}`);

    await expect(page.getByRole("link", { name: "Rezervovat službu" })).toHaveAttribute(
      "href",
      `/rezervace?service=${fixture.serviceSlug}`,
    );
  });

  test("service detail CTA opens booking with preselected service and immediate slot selection", async ({ page }) => {
    const fixture = await createPublicBookingFixture();
    fixtures.push(fixture);

    const service = await prisma.service.findFirstOrThrow({
      where: {
        slug: fixture.serviceSlug,
      },
      select: {
        id: true,
      },
    });

    await page.goto(`/sluzby/${fixture.serviceSlug}`);
    await page.getByRole("link", { name: "Rezervovat službu" }).click();

    await expect(page).toHaveURL(new RegExp(`/rezervace\\?service=${fixture.serviceSlug}$`));
    await expect(page.locator('input[name="serviceId"]')).toHaveValue(service.id);
    await expect(page.getByText(fixture.serviceName).first()).toBeVisible();

    const firstSlotButton = page.getByRole("button", { name: /^Vybrat termín / }).first();
    await expect(firstSlotButton).toBeVisible();
    await clickUntilFocused(firstSlotButton, page.getByLabel("Jméno a příjmení"));
  });

  test("service detail CTA drives the Meta Pixel funnel through booking success", async ({ page }) => {
    const fixture = await createPublicBookingFixture();
    fixtures.push(fixture);

    await installMetaPixelSpy(page);
    await page.route("**/fbevents.js", async (route) => {
      await route.fulfill({
        contentType: "application/javascript",
        body: "// Meta Pixel is stubbed for Playwright smoke coverage.",
      });
    });

    await page.goto(`/sluzby/${fixture.serviceSlug}`);
    await expect(page.getByRole("heading", { name: fixture.serviceName })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-meta-pixel-view-content", fixture.serviceSlug, {
      timeout: 30_000,
    });
    await expectMetaPixelEvent(page, "track:ViewContent");

    await page.getByRole("link", { name: "Rezervovat službu" }).click();
    await expect(page).toHaveURL(new RegExp(`/rezervace\\?service=${fixture.serviceSlug}$`));
    await expectMetaPixelEvent(page, "track:InitiateCheckout");
    await expectMetaPixelEvent(page, "track:AddToCart");

    await clickUntilFocused(
      page.getByRole("button", { name: /^Vybrat termín / }).first(),
      page.getByLabel("Jméno a příjmení"),
    );
    await expectMetaPixelEvent(page, "trackCustom:BookingDateSelected");
    await expectMetaPixelEvent(page, "trackCustom:BookingTimeSelected");
    await expectMetaPixelEvent(page, "trackCustom:BookingContactStarted");

    await page.getByLabel("Jméno a příjmení").fill(fixture.clientName);
    await page.getByRole("textbox", { name: "E-mail" }).fill(fixture.clientEmail);
    await page.getByRole("textbox", { name: "Telefon" }).fill("+420 777 000 000");
    await page.getByRole("button", { name: "Zobrazit souhrn" }).click();
    await page.getByRole("button", { name: "Odeslat rezervaci" }).first().click();

    await expect(page.getByRole("heading", { name: "Rezervace přijata" })).toBeVisible();
    await expectMetaPixelEvent(page, "track:Lead");
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
    await selectSlotById(
      page,
      fixture.slotLabels.rescheduleConflictButtonLabel,
      fixture.slotLabels.rescheduleConflictSlotId,
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

    const runtimeConflictBooking = await prisma.booking.create({
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
    await prisma.booking.update({
      where: {
        id: runtimeConflictBooking.id,
      },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });

    await selectSlotById(
      page,
      fixture.slotLabels.rescheduleSuccessButtonLabel,
      fixture.slotLabels.rescheduleSuccessSlotId,
      confirmButton,
    );
    await expectSelectedRescheduleSlot(page, {
      slotId: fixture.slotLabels.rescheduleSuccessSlotId,
      startsAt: fixture.slotLabels.rescheduleSuccessStartAt,
    });
    expect(fixture.slotLabels.rescheduleSuccessStartAt).not.toBe(selectedStartIso);
    expect(fixture.slotLabels.rescheduleSuccessSlotId).not.toBe(selectedSlotId);
    await confirmButton.click();
    const attemptedSlotIds = new Set([selectedSlotId, fixture.slotLabels.rescheduleSuccessSlotId]);
    try {
      await expect(successHeading).toBeVisible({ timeout: 30_000 });
    } catch {
      await submitRescheduleUntilSuccess(
        page,
        confirmButton,
        successHeading,
        conflictMessage,
        attemptedSlotIds,
      );
    }

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
    const createButton = page.getByRole("button", { name: "Vytvořit rezervaci" }).last();
    await selectSlotById(
      page,
      fixture.slotLabels.rescheduleConflictButtonLabel,
      fixture.slotLabels.rescheduleConflictSlotId,
      createButton,
    );
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
      page.getByText(/(koliduje|není k dispozici|obsazen|rezervovaný)/i).first(),
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
    const bookingActions = page.locator("#booking-actions");
    await bookingActions.getByRole("button", { name: "Potvrdit rezervaci" }).first().click();
    await bookingActions.getByLabel("Volitelný důvod").fill("E2E potvrzení");
    await bookingActions.locator("button[type='submit']").click();

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
