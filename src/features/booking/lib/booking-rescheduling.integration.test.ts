import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

import { getPragueLocalDate, resolvePragueLocalDateTime } from "./booking-local-time";

(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "change-me-owner";
process.env.ADMIN_STAFF_EMAIL ??= "staff@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "change-me-staff";
process.env.EMAIL_DELIVERY_MODE ??= "log";

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

type SeedContext = {
  bookingId: string;
  bookingUpdatedAt: string;
  oldSlotId: string;
  newSlotId: string;
  oldStartAt: string;
  oldEndAt: string;
  newStartAt: string;
  newEndAt: string;
  clientId: string;
  serviceId: string;
  categoryId: string;
  actorUserId: string;
};

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

function addCalendarDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return `${String(value.getUTCFullYear()).padStart(4, "0")}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

function at(localDate: string, time: string) {
  const value = resolvePragueLocalDateTime(localDate, time);
  assert.ok(value);
  return value;
}

async function loadModules() {
  const [{ prisma }, bookingModule, clientModule, publicBookingModule, emailDeliveryModule] = await Promise.all([
    import("@/lib/prisma"),
    import("./booking-rescheduling"),
    import("@/generated/prisma/browser"),
    import("./booking-public"),
    import("@/lib/email/delivery"),
  ]);

  return {
    prisma,
    createBookingReschedulingApi: bookingModule.createBookingReschedulingApi,
    rescheduleBooking: bookingModule.rescheduleBooking,
    BookingRescheduleError: bookingModule.BookingRescheduleError,
    BookingStatus: clientModule.BookingStatus,
    AvailabilitySlotStatus: clientModule.AvailabilitySlotStatus,
    EmailAudience: clientModule.EmailAudience,
    EmailLogType: clientModule.EmailLogType,
    claimEmailLogForImmediateDelivery: emailDeliveryModule.claimEmailLogForImmediateDelivery,
    deliverEmailLog: emailDeliveryModule.deliverEmailLog,
    getPublicBookingCatalog: publicBookingModule.getPublicBookingCatalog,
  };
}

async function findIsolatedRescheduleWindow(
  seedUuid: string,
  durationMinutes: number,
  excludedWindows: Array<{ startsAt: Date; endsAt: Date }> = [],
) {
  const { prisma, BookingStatus } = await loadModules();
  const { getBookingPolicySettings } = await import("@/lib/site-settings");
  const { maxAdvanceDays } = await getBookingPolicySettings();
  const activeStatuses = [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.COMPLETED];
  const daySeed = Number.parseInt(seedUuid.replaceAll("-", "").slice(0, 4), 16);
  const hourSeed = Number.parseInt(seedUuid.replaceAll("-", "").slice(4, 6), 16);
  const minuteSeed = Number.parseInt(seedUuid.replaceAll("-", "").slice(6, 8), 16);
  const hourCandidates = [18, 19, 20, 21].map((hour, index, list) => list[(index + hourSeed) % list.length] ?? hour);
  const minuteCandidates = [0, 15, 30, 45].map(
    (minute, index, list) => list[(index + minuteSeed) % list.length] ?? minute,
  );
  const minimumDayOffset = 14;
  const dayOffsetRange = maxAdvanceDays - minimumDayOffset;

  if (dayOffsetRange < 1) {
    throw new Error("Booking policy neposkytuje dostatecne testovaci okno pro reschedule.");
  }

  for (let dayStep = 0; dayStep < dayOffsetRange; dayStep += 1) {
    const dayOffset = minimumDayOffset + ((daySeed + dayStep) % dayOffsetRange);

    for (const hour of hourCandidates) {
      for (const minute of minuteCandidates) {
        const startsAt = addDays(new Date(), dayOffset);
        startsAt.setUTCHours(hour, minute, 0, 0);
        const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);
        const overlapsExcludedWindow = excludedWindows.some(
          (window) => startsAt < window.endsAt && endsAt > window.startsAt,
        );

        if (overlapsExcludedWindow) {
          continue;
        }

        const [overlappingSlots, overlappingBookings] = await Promise.all([
          prisma.availabilitySlot.count({
            where: {
              startsAt: {
                lt: endsAt,
              },
              endsAt: {
                gt: startsAt,
              },
            },
          }),
          prisma.booking.count({
            where: {
              status: {
                in: activeStatuses,
              },
              scheduledStartsAt: {
                lt: endsAt,
              },
              OR: [
                {
                  blockedUntil: {
                    gt: startsAt,
                  },
                },
                {
                  blockedUntil: null,
                  scheduledEndsAt: {
                    gt: startsAt,
                  },
                },
              ],
            },
          }),
        ]);

        if (overlappingSlots === 0 && overlappingBookings === 0) {
          return startsAt;
        }
      }
    }
  }

  throw new Error("Nepodařilo se najít izolované testovací okno pro reschedule integrační test.");
}

async function createSeed(input: { oldSlotPaddingMinutes?: number } = {}) {
  const { prisma, BookingStatus, AvailabilitySlotStatus } = await loadModules();
  const seedUuid = randomUUID();
  const suffix = seedUuid.slice(0, 8);
  const oldSlotPaddingMinutes = input.oldSlotPaddingMinutes ?? 0;
  const isolatedOldWindowStartAt = await findIsolatedRescheduleWindow(
    seedUuid,
    60 + oldSlotPaddingMinutes * 2,
  );
  const oldStartAt = new Date(
    isolatedOldWindowStartAt.getTime() + oldSlotPaddingMinutes * 60 * 1000,
  );
  const oldEndAt = new Date(oldStartAt.getTime() + 60 * 60 * 1000);
  const isolatedOldWindowEndAt = new Date(
    isolatedOldWindowStartAt.getTime() + (60 + oldSlotPaddingMinutes * 2) * 60 * 1000,
  );
  const newStartAt = await findIsolatedRescheduleWindow(`${seedUuid}-next`, 90, [
    {
      startsAt: isolatedOldWindowStartAt,
      endsAt: isolatedOldWindowEndAt,
    },
  ]);
  const newEndAt = new Date(newStartAt.getTime() + 90 * 60 * 1000);
  const actor = await prisma.adminUser.create({
    data: {
      email: `reschedule-${suffix}@example.com`,
      name: `Reschedule Test ${suffix}`,
      role: "OWNER",
      isActive: true,
    },
    select: {
      id: true,
    },
  });
  const category = await prisma.serviceCategory.create({
    data: {
      name: `Test category ${suffix}`,
      slug: `test-category-${suffix}`,
      isActive: true,
    },
    select: {
      id: true,
    },
  });
  const service = await prisma.service.create({
    data: {
      categoryId: category.id,
      name: `Test service ${suffix}`,
      slug: `test-service-${suffix}`,
      durationMinutes: 60,
      isActive: true,
      isPubliclyBookable: true,
    },
    select: {
      id: true,
    },
  });
  const client = await prisma.client.create({
    data: {
      fullName: `Klientka ${suffix}`,
      email: `client-${suffix}@example.com`,
      phone: "+420777123456",
      isActive: true,
    },
    select: {
      id: true,
    },
  });
  const oldSlot = await prisma.availabilitySlot.create({
    data: {
      startsAt: oldStartAt,
      endsAt: oldEndAt,
      capacity: 1,
      status: AvailabilitySlotStatus.DRAFT,
      serviceRestrictionMode: "ANY",
      internalNote: `Legacy override ${suffix}`,
      createdByUserId: actor.id,
    },
    select: {
      id: true,
    },
  });
  const newSlot = await prisma.availabilitySlot.create({
    data: {
      startsAt: newStartAt,
      endsAt: newEndAt,
      capacity: 1,
      status: AvailabilitySlotStatus.PUBLISHED,
      serviceRestrictionMode: "ANY",
      createdByUserId: actor.id,
    },
    select: {
      id: true,
    },
  });
  const booking = await prisma.booking.create({
    data: {
      clientId: client.id,
      slotId: oldSlot.id,
      serviceId: service.id,
      source: "PHONE",
      isManual: true,
      manualOverride: true,
      status: BookingStatus.CONFIRMED,
      clientNameSnapshot: `Klientka ${suffix}`,
      clientEmailSnapshot: `client-${suffix}@example.com`,
      clientPhoneSnapshot: "+420777123456",
      serviceNameSnapshot: `Test service ${suffix}`,
      serviceDurationMinutes: 60,
      scheduledStartsAt: oldStartAt,
      scheduledEndsAt: oldEndAt,
      confirmedAt: new Date("2026-05-01T08:00:00.000Z"),
      reminder24hQueuedAt: new Date(oldStartAt.getTime() - 24 * 60 * 60 * 1000 + 5 * 60 * 1000),
      reminder24hSentAt: new Date(oldStartAt.getTime() - 24 * 60 * 60 * 1000 + 10 * 60 * 1000),
      createdByUserId: actor.id,
    },
    select: {
      id: true,
      updatedAt: true,
    },
  });

  return {
    bookingId: booking.id,
    bookingUpdatedAt: booking.updatedAt.toISOString(),
    oldSlotId: oldSlot.id,
    newSlotId: newSlot.id,
    oldStartAt: oldStartAt.toISOString(),
    oldEndAt: oldEndAt.toISOString(),
    newStartAt: newStartAt.toISOString(),
    newEndAt: newEndAt.toISOString(),
    clientId: client.id,
    serviceId: service.id,
    categoryId: category.id,
    actorUserId: actor.id,
  } satisfies SeedContext;
}

async function cleanupSeed(seed: SeedContext) {
  const { prisma } = await loadModules();

  await prisma.emailLog.deleteMany({ where: { bookingId: seed.bookingId } });
  await prisma.booking.deleteMany({ where: { id: seed.bookingId } });
  await prisma.availabilitySlot.deleteMany({ where: { createdByUserId: seed.actorUserId } });
  await prisma.client.deleteMany({ where: { id: seed.clientId } });
  await prisma.service.deleteMany({ where: { id: seed.serviceId } });
  await prisma.serviceCategory.deleteMany({ where: { id: seed.categoryId } });
  await prisma.adminUser.deleteMany({ where: { id: seed.actorUserId } });
}

type LunchSeed = SeedContext & { localDate: string; cleanupMinutes: number; blockerClientIds: string[] };

async function findIsolatedLunchDate() {
  const { prisma, BookingStatus } = await loadModules();
  const today = getPragueLocalDate(new Date());

  for (let offset = 14; offset < 75; offset += 1) {
    const localDate = addCalendarDays(today, offset);
    const startsAt = at(localDate, "00:00");
    const endsAt = at(addCalendarDays(localDate, 1), "00:00");
    const [slots, bookings] = await Promise.all([
      prisma.availabilitySlot.count({ where: { startsAt: { lt: endsAt }, endsAt: { gt: startsAt } } }),
      prisma.booking.count({
        where: {
          status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
          scheduledStartsAt: { lt: endsAt },
          OR: [{ blockedUntil: { gt: startsAt } }, { blockedUntil: null, scheduledEndsAt: { gt: startsAt } }],
        },
      }),
    ]);
    if (slots === 0 && bookings === 0) return localDate;
  }

  throw new Error("Nepodařilo se najít izolovaný den pro lunch reschedule test.");
}

async function createLunchSeed(input: { cleanupMinutes?: number; oldStart?: string; oldEnd?: string } = {}): Promise<LunchSeed> {
  const { prisma, BookingStatus, AvailabilitySlotStatus } = await loadModules();
  const suffix = randomUUID().slice(0, 8);
  const localDate = await findIsolatedLunchDate();
  const cleanupMinutes = input.cleanupMinutes ?? 0;
  const oldStart = input.oldStart ?? "11:00";
  const oldEnd = input.oldEnd ?? "12:30";
  const actor = await prisma.adminUser.create({ data: { email: `lunch-reschedule-${suffix}@example.com`, name: `Lunch reschedule ${suffix}`, role: "OWNER", isActive: true }, select: { id: true } });
  const category = await prisma.serviceCategory.create({ data: { name: `Lunch reschedule ${suffix}`, slug: `lunch-reschedule-${suffix}` }, select: { id: true } });
  const service = await prisma.service.create({
    data: { categoryId: category.id, name: `Lunch reschedule ${suffix}`, slug: `lunch-reschedule-service-${suffix}`, durationMinutes: 90, cleanupMinutes, isActive: true, isPubliclyBookable: true },
    select: { id: true },
  });
  const client = await prisma.client.create({ data: { fullName: `Lunch klientka ${suffix}`, email: `lunch-reschedule-client-${suffix}@example.com`, phone: "+420777123456" }, select: { id: true } });
  const slot = await prisma.availabilitySlot.create({
    data: { startsAt: at(localDate, "09:00"), endsAt: at(localDate, "17:00"), capacity: 1, status: AvailabilitySlotStatus.PUBLISHED, publishedAt: new Date(), serviceRestrictionMode: "ANY", createdByUserId: actor.id },
    select: { id: true },
  });
  const booking = await prisma.booking.create({
    data: {
      clientId: client.id, slotId: slot.id, serviceId: service.id, source: "PHONE", isManual: false, manualOverride: false, status: BookingStatus.CONFIRMED,
      clientNameSnapshot: `Lunch klientka ${suffix}`, clientEmailSnapshot: `lunch-reschedule-client-${suffix}@example.com`, clientPhoneSnapshot: "+420777123456", serviceNameSnapshot: `Lunch reschedule ${suffix}`,
      serviceDurationMinutes: 90, cleanupMinutes, cleanupBlockMinutes: cleanupMinutes, scheduledStartsAt: at(localDate, oldStart), scheduledEndsAt: at(localDate, oldEnd), blockedUntil: new Date(at(localDate, oldEnd).getTime() + cleanupMinutes * 60_000), confirmedAt: new Date(), createdByUserId: actor.id,
    },
    select: { id: true, updatedAt: true },
  });
  return {
    bookingId: booking.id, bookingUpdatedAt: booking.updatedAt.toISOString(), oldSlotId: slot.id, newSlotId: slot.id,
    oldStartAt: at(localDate, oldStart).toISOString(), oldEndAt: at(localDate, oldEnd).toISOString(), newStartAt: at(localDate, "12:30").toISOString(), newEndAt: at(localDate, "14:00").toISOString(),
    clientId: client.id, serviceId: service.id, categoryId: category.id, actorUserId: actor.id, localDate, cleanupMinutes, blockerClientIds: [],
  };
}

async function cleanupLunchSeed(seed: LunchSeed) {
  const { prisma } = await loadModules();
  await prisma.emailLog.deleteMany({ where: { bookingId: seed.bookingId } });
  await prisma.booking.deleteMany({ where: { serviceId: seed.serviceId } });
  await prisma.availabilitySlot.deleteMany({ where: { createdByUserId: seed.actorUserId } });
  await prisma.client.deleteMany({ where: { id: seed.clientId } });
  await prisma.client.deleteMany({ where: { id: { in: seed.blockerClientIds } } });
  await prisma.service.deleteMany({ where: { id: seed.serviceId } });
  await prisma.serviceCategory.deleteMany({ where: { id: seed.categoryId } });
  await prisma.adminUser.deleteMany({ where: { id: seed.actorUserId } });
}

async function addLunchBlocker(seed: LunchSeed, startsAt: string, endsAt: string) {
  const { prisma, BookingStatus } = await loadModules();
  const client = await prisma.client.create({ data: { fullName: `Lunch blokace ${randomUUID().slice(0, 8)}`, email: `lunch-blocker-${randomUUID()}@example.com` }, select: { id: true } });
  seed.blockerClientIds.push(client.id);
  await prisma.booking.create({
    data: {
      clientId: client.id, slotId: seed.oldSlotId, serviceId: seed.serviceId, source: "PHONE", isManual: false, manualOverride: false, status: BookingStatus.CONFIRMED,
      clientNameSnapshot: "Lunch blokace", clientEmailSnapshot: client.id + "@example.com", serviceNameSnapshot: "Lunch blokace", serviceDurationMinutes: (at(seed.localDate, endsAt).getTime() - at(seed.localDate, startsAt).getTime()) / 60_000,
      scheduledStartsAt: at(seed.localDate, startsAt), scheduledEndsAt: at(seed.localDate, endsAt), blockedUntil: at(seed.localDate, endsAt), confirmedAt: new Date(),
    },
  });
}

async function expectLunchUnavailable(run: () => Promise<unknown>) {
  const { BookingRescheduleError } = await loadModules();
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof BookingRescheduleError);
    assert.equal(error.code, "SLOT_UNAVAILABLE");
    return true;
  });
}

dbTest("rescheduleBooking při simulaci cíle odečte původní booking a pouze přesune oběd", async () => {
  const seed = await createLunchSeed();
  const { prisma, rescheduleBooking } = await loadModules();
  try {
    const result = await rescheduleBooking({
      bookingId: seed.bookingId, slotId: seed.newSlotId, newStartAt: seed.newStartAt,
      changedByUserId: null, changedByClient: true, notifyClient: false, expectedUpdatedAt: seed.bookingUpdatedAt,
    });
    assert.equal(result.scheduledStartsAt, seed.newStartAt);
    assert.equal(await prisma.bookingRescheduleLog.count({ where: { bookingId: seed.bookingId } }), 1);
  } finally {
    await cleanupLunchSeed(seed);
  }
});

dbTest("stale public reschedule po mezitím vzniklé blokaci odmítne termín a zachová booking bez logu", async () => {
  const seed = await createLunchSeed();
  const { prisma, rescheduleBooking, getPublicBookingCatalog } = await loadModules();
  try {
    const catalog = await getPublicBookingCatalog();
    assert.ok(catalog.slots.some((slot) => slot.id === seed.newSlotId));
    await addLunchBlocker(seed, "11:00", "12:30");
    await expectLunchUnavailable(() => rescheduleBooking({
      bookingId: seed.bookingId, slotId: seed.newSlotId, newStartAt: seed.newStartAt,
      changedByUserId: null, changedByClient: true, notifyClient: false, expectedUpdatedAt: seed.bookingUpdatedAt,
    }));
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: seed.bookingId }, select: { scheduledStartsAt: true, rescheduleCount: true } });
    assert.equal(booking.scheduledStartsAt.toISOString(), seed.oldStartAt);
    assert.equal(booking.rescheduleCount, 0);
    assert.equal(await prisma.bookingRescheduleLog.count({ where: { bookingId: seed.bookingId } }), 0);
  } finally {
    await cleanupLunchSeed(seed);
  }
});

dbTest("rescheduleBooking používá blockedUntil včetně cleanup pro lunch feasibility", async () => {
  const seed = await createLunchSeed({ cleanupMinutes: 15, oldStart: "14:30", oldEnd: "16:00" });
  const { rescheduleBooking } = await loadModules();
  try {
    await addLunchBlocker(seed, "11:45", "13:45");
    await expectLunchUnavailable(() => rescheduleBooking({
      bookingId: seed.bookingId, slotId: seed.newSlotId, newStartAt: at(seed.localDate, "09:30").toISOString(),
      changedByUserId: null, changedByClient: true, notifyClient: false, expectedUpdatedAt: seed.bookingUpdatedAt,
    }));
  } finally {
    await cleanupLunchSeed(seed);
  }
});

dbTest("aktuální OFF policy při submitu dovolí termín, který AUTO odmítá", async () => {
  const seed = await createLunchSeed({ oldStart: "14:30", oldEnd: "16:00" });
  const { prisma, rescheduleBooking } = await loadModules();
  try {
    await addLunchBlocker(seed, "11:00", "12:30");
    await prisma.autoLunchDayOverride.create({ data: { dateKey: seed.localDate, updatedByUserId: seed.actorUserId } });
    const result = await rescheduleBooking({
      bookingId: seed.bookingId, slotId: seed.newSlotId, newStartAt: seed.newStartAt,
      changedByUserId: null, changedByClient: true, notifyClient: false, expectedUpdatedAt: seed.bookingUpdatedAt,
    });
    assert.equal(result.scheduledStartsAt, seed.newStartAt);
  } finally {
    await prisma.autoLunchDayOverride.deleteMany({ where: { dateKey: seed.localDate } });
    await cleanupLunchSeed(seed);
  }
});

dbTest("admin slot mode chrání lunch, explicitní manual override jej může obejít", async () => {
  const seed = await createLunchSeed();
  const { rescheduleBooking } = await loadModules();
  try {
    await addLunchBlocker(seed, "11:00", "12:30");
    await expectLunchUnavailable(() => rescheduleBooking({
      bookingId: seed.bookingId, slotId: seed.newSlotId, newStartAt: seed.newStartAt,
      changedByUserId: seed.actorUserId, notifyClient: false, expectedUpdatedAt: seed.bookingUpdatedAt, allowManualOverride: false,
    }));
    const result = await rescheduleBooking({
      bookingId: seed.bookingId, slotId: seed.newSlotId, newStartAt: seed.newStartAt,
      changedByUserId: seed.actorUserId, notifyClient: false, expectedUpdatedAt: seed.bookingUpdatedAt, allowManualOverride: true,
    });
    assert.equal(result.manualOverride, true);
    assert.equal(result.scheduledStartsAt, seed.newStartAt);
  } finally {
    await cleanupLunchSeed(seed);
  }
});

dbTest("admin manual reschedule ořízne překrývající PUBLISHED slot s přesouvaným bookingem", async () => {
  const seed = await createLunchSeed({ oldStart: "11:00", oldEnd: "12:30" });
  const { prisma, rescheduleBooking, AvailabilitySlotStatus } = await loadModules();
  const requestedStartsAt = at(seed.localDate, "16:30");
  const requestedEndsAt = at(seed.localDate, "18:00");

  try {
    const result = await rescheduleBooking({
      bookingId: seed.bookingId,
      newStartAt: requestedStartsAt.toISOString(),
      changedByUserId: seed.actorUserId,
      notifyClient: false,
      expectedUpdatedAt: seed.bookingUpdatedAt,
      allowManualOverride: true,
    });

    assert.equal(result.manualOverride, true);

    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: seed.bookingId },
      select: {
        slotId: true,
        slot: {
          select: { status: true, startsAt: true, endsAt: true },
        },
      },
    });
    assert.equal(booking.slot.status, AvailabilitySlotStatus.DRAFT);
    assert.equal(booking.slot.startsAt.toISOString(), requestedStartsAt.toISOString());
    assert.equal(booking.slot.endsAt.toISOString(), requestedEndsAt.toISOString());

    const oldSlot = await prisma.availabilitySlot.findUniqueOrThrow({
      where: { id: seed.oldSlotId },
      select: { status: true, startsAt: true, endsAt: true },
    });
    assert.equal(oldSlot.status, AvailabilitySlotStatus.ARCHIVED);
    assert.equal(oldSlot.startsAt.toISOString(), at(seed.localDate, "09:00").toISOString());
    assert.equal(oldSlot.endsAt.toISOString(), at(seed.localDate, "17:00").toISOString());

    const activeSlots = await prisma.availabilitySlot.findMany({
      where: {
        status: {
          in: [AvailabilitySlotStatus.DRAFT, AvailabilitySlotStatus.PUBLISHED],
        },
        startsAt: { lt: requestedEndsAt },
        endsAt: { gt: at(seed.localDate, "09:00") },
      },
      orderBy: { startsAt: "asc" },
      select: { id: true, startsAt: true, endsAt: true, status: true },
    });
    assert.deepEqual(activeSlots.map((slot) => [
      slot.startsAt.toISOString(),
      slot.endsAt.toISOString(),
      slot.status,
    ]), [
      [at(seed.localDate, "09:00").toISOString(), requestedStartsAt.toISOString(), AvailabilitySlotStatus.PUBLISHED],
      [requestedStartsAt.toISOString(), requestedEndsAt.toISOString(), AvailabilitySlotStatus.DRAFT],
    ]);
    assert.equal(activeSlots.filter((slot) => slot.status === AvailabilitySlotStatus.DRAFT).length, 1);
    assert.equal(activeSlots.some((slot) => slot.id === booking.slotId), true);
    for (const [index, slot] of activeSlots.entries()) {
      for (const otherSlot of activeSlots.slice(index + 1)) {
        assert.equal(slot.startsAt < otherSlot.endsAt && slot.endsAt > otherSlot.startsAt, false);
      }
    }
  } finally {
    await cleanupLunchSeed(seed);
  }
});

dbTest("admin manual reschedule protected PUBLISHED slot neořízne a odmítne", async () => {
  const seed = await createLunchSeed({ oldStart: "11:00", oldEnd: "12:30" });
  const { prisma, rescheduleBooking, BookingRescheduleError, AvailabilitySlotStatus } = await loadModules();
  const requestedStartsAt = at(seed.localDate, "16:30");

  try {
    await prisma.availabilitySlot.update({
      where: { id: seed.oldSlotId },
      data: { internalNote: "Protected interval" },
    });

    await assert.rejects(
      rescheduleBooking({
        bookingId: seed.bookingId,
        newStartAt: requestedStartsAt.toISOString(),
        changedByUserId: seed.actorUserId,
        notifyClient: false,
        expectedUpdatedAt: seed.bookingUpdatedAt,
        allowManualOverride: true,
      }),
      (error: unknown) => {
        assert.ok(error instanceof BookingRescheduleError);
        assert.equal(error.code, "CONFLICT");
        assert.equal(error.message, "Nový termín zasahuje do interně blokovaného času.");
        return true;
      },
    );

    const [booking, protectedSlot, draftCount] = await Promise.all([
      prisma.booking.findUniqueOrThrow({
        where: { id: seed.bookingId },
        select: { slotId: true, scheduledStartsAt: true },
      }),
      prisma.availabilitySlot.findUniqueOrThrow({
        where: { id: seed.oldSlotId },
        select: { status: true, startsAt: true, endsAt: true, internalNote: true },
      }),
      prisma.availabilitySlot.count({
        where: {
          status: AvailabilitySlotStatus.DRAFT,
          startsAt: { lt: at(seed.localDate, "18:00") },
          endsAt: { gt: at(seed.localDate, "16:30") },
          createdByUserId: seed.actorUserId,
        },
      }),
    ]);
    assert.equal(booking.slotId, seed.oldSlotId);
    assert.equal(booking.scheduledStartsAt.toISOString(), seed.oldStartAt);
    assert.equal(protectedSlot.status, AvailabilitySlotStatus.PUBLISHED);
    assert.equal(protectedSlot.startsAt.toISOString(), at(seed.localDate, "09:00").toISOString());
    assert.equal(protectedSlot.endsAt.toISOString(), at(seed.localDate, "17:00").toISOString());
    assert.equal(protectedSlot.internalNote, "Protected interval");
    assert.equal(draftCount, 0);
  } finally {
    await cleanupLunchSeed(seed);
  }
});

dbTest("souběžné public reschedule nikdy necommitnou stav bez proveditelného oběda", async () => {
  const seed = await createLunchSeed({ oldStart: "09:00", oldEnd: "10:30" });
  const { prisma, rescheduleBooking, BookingStatus, AvailabilitySlotStatus } = await loadModules();
  try {
    await prisma.availabilitySlot.update({ where: { id: seed.oldSlotId }, data: { status: AvailabilitySlotStatus.ARCHIVED } });
    const targetSlot = await prisma.availabilitySlot.create({
      data: { startsAt: at(seed.localDate, "09:00"), endsAt: at(seed.localDate, "17:00"), capacity: 1, status: AvailabilitySlotStatus.PUBLISHED, publishedAt: new Date(), serviceRestrictionMode: "ANY", createdByUserId: seed.actorUserId },
      select: { id: true },
    });
    const secondClient = await prisma.client.create({ data: { fullName: "Lunch race", email: `lunch-race-${randomUUID()}@example.com` }, select: { id: true } });
    seed.blockerClientIds.push(secondClient.id);
    const secondOldSlot = await prisma.availabilitySlot.create({
      data: { startsAt: at(seed.localDate, "14:30"), endsAt: at(seed.localDate, "16:00"), capacity: 1, status: AvailabilitySlotStatus.ARCHIVED, serviceRestrictionMode: "ANY", createdByUserId: seed.actorUserId },
      select: { id: true },
    });
    const secondBooking = await prisma.booking.create({
      data: {
        clientId: secondClient.id, slotId: secondOldSlot.id, serviceId: seed.serviceId, source: "PHONE", isManual: false, manualOverride: false, status: BookingStatus.CONFIRMED,
        clientNameSnapshot: "Lunch race", clientEmailSnapshot: "lunch-race@example.com", serviceNameSnapshot: "Lunch race", serviceDurationMinutes: 90,
        scheduledStartsAt: at(seed.localDate, "14:30"), scheduledEndsAt: at(seed.localDate, "16:00"), blockedUntil: at(seed.localDate, "16:00"), confirmedAt: new Date(),
      }, select: { id: true, updatedAt: true },
    });
    const results = await Promise.allSettled([
      rescheduleBooking({ bookingId: seed.bookingId, slotId: targetSlot.id, newStartAt: at(seed.localDate, "11:00").toISOString(), changedByUserId: null, changedByClient: true, notifyClient: false, expectedUpdatedAt: seed.bookingUpdatedAt }),
      rescheduleBooking({ bookingId: secondBooking.id, slotId: targetSlot.id, newStartAt: at(seed.localDate, "12:30").toISOString(), changedByUserId: null, changedByClient: true, notifyClient: false, expectedUpdatedAt: secondBooking.updatedAt.toISOString() }),
    ]);
    const fulfilled = results.filter(
      (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof rescheduleBooking>>> => result.status === "fulfilled",
    );
    const rejected = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.ok(rejected[0].reason instanceof Error && "code" in rejected[0].reason);
    assert.equal(rejected[0].reason.code, "SLOT_UNAVAILABLE");
  } finally {
    await cleanupLunchSeed(seed);
  }
});

dbTest("rescheduleBooking updates the existing booking, writes audit history and resets reminders", async () => {
  const seed = await createSeed();
  const { prisma, rescheduleBooking, BookingStatus, AvailabilitySlotStatus, EmailAudience, EmailLogType } = await loadModules();

  try {
    const result = await rescheduleBooking({
      bookingId: seed.bookingId,
      slotId: seed.newSlotId,
      newStartAt: seed.newStartAt,
      reason: "Klientka volala a chtěla pozdější čas.",
      changedByUserId: seed.actorUserId,
      notifyClient: true,
      includeCalendarAttachment: true,
      expectedUpdatedAt: seed.bookingUpdatedAt,
    });

    assert.equal(result.bookingId, seed.bookingId);
    assert.equal(result.rescheduleCount, 1);
    assert.ok(["logged", "queued"].includes(result.notificationStatus));
    assert.equal(result.manualOverride, false);

    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: seed.bookingId },
      select: {
        slotId: true,
        scheduledStartsAt: true,
        scheduledEndsAt: true,
        reminder24hQueuedAt: true,
        reminder24hSentAt: true,
        rescheduleCount: true,
        rescheduledAt: true,
        manualOverride: true,
      },
    });

    assert.equal(booking.slotId, seed.newSlotId);
    assert.equal(booking.scheduledStartsAt.toISOString(), seed.newStartAt);
    assert.equal(
      booking.scheduledEndsAt.toISOString(),
      new Date(new Date(seed.newStartAt).getTime() + 60 * 60 * 1000).toISOString(),
    );
    assert.equal(booking.reminder24hQueuedAt, null);
    assert.equal(booking.reminder24hSentAt, null);
    assert.equal(booking.rescheduleCount, 1);
    assert.equal(booking.manualOverride, false);
    assert.ok(booking.rescheduledAt);

    const rescheduleLog = await prisma.bookingRescheduleLog.findFirstOrThrow({
      where: { bookingId: seed.bookingId },
      orderBy: { createdAt: "desc" },
    });

    assert.equal(rescheduleLog.oldStartAt.toISOString(), seed.oldStartAt);
    assert.equal(rescheduleLog.oldEndAt.toISOString(), seed.oldEndAt);
    assert.equal(rescheduleLog.newStartAt.toISOString(), seed.newStartAt);
    assert.equal(
      rescheduleLog.newEndAt.toISOString(),
      new Date(new Date(seed.newStartAt).getTime() + 60 * 60 * 1000).toISOString(),
    );
    assert.equal(rescheduleLog.changedByUserId, seed.actorUserId);
    assert.equal(rescheduleLog.changedByClient, false);
    assert.equal(rescheduleLog.reason, "Klientka volala a chtěla pozdější čas.");

    const emailLog = await prisma.emailLog.findFirstOrThrow({
      where: {
        bookingId: seed.bookingId,
        type: EmailLogType.BOOKING_RESCHEDULED,
        templateKey: "booking-rescheduled-v1",
      },
      orderBy: { createdAt: "desc" },
      select: {
        type: true,
        audience: true,
        templateKey: true,
        subject: true,
        payload: true,
      },
    });

    assert.equal(emailLog.type, EmailLogType.BOOKING_RESCHEDULED);
    assert.equal(emailLog.audience, EmailAudience.CLIENT);
    assert.equal(emailLog.templateKey, "booking-rescheduled-v1");
    assert.match(emailLog.subject, /Změna termínu rezervace/);
    const payload = emailLog.payload as Record<string, unknown>;
    assert.equal(payload.scheduledStartsAt, seed.newStartAt);
    assert.equal(
      payload.scheduledEndsAt,
      new Date(new Date(seed.newStartAt).getTime() + 60 * 60 * 1000).toISOString(),
    );

    const oldSlotStillExists = await prisma.availabilitySlot.findUnique({
      where: { id: seed.oldSlotId },
      select: {
        id: true,
        status: true,
        bookings: {
          where: { status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] } },
          select: { id: true },
        },
      },
    });

    assert.ok(oldSlotStillExists);
    assert.equal(oldSlotStillExists.status, AvailabilitySlotStatus.ARCHIVED);
    assert.equal(oldSlotStillExists.bookings.length, 0);
  } finally {
    await cleanupSeed(seed);
  }
});

dbTest("selhání klientského EmailLog rollbackne celý reschedule", async () => {
  const seed = await createSeed();
  const { prisma, createBookingReschedulingApi, EmailLogType } = await loadModules();
  const api = createBookingReschedulingApi({
    createBookingRescheduledClientEmailLog: async () => {
      throw new Error("simulated EmailLog failure");
    },
  });

  try {
    await assert.rejects(
      api.rescheduleBooking({
        bookingId: seed.bookingId,
        slotId: seed.newSlotId,
        newStartAt: seed.newStartAt,
        changedByUserId: seed.actorUserId,
        notifyClient: true,
        expectedUpdatedAt: seed.bookingUpdatedAt,
      }),
      /simulated EmailLog failure/,
    );

    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: seed.bookingId },
      select: {
        slotId: true,
        scheduledStartsAt: true,
        rescheduleCount: true,
      },
    });
    const [historyCount, emailCount, tokenCount] = await Promise.all([
      prisma.bookingRescheduleLog.count({ where: { bookingId: seed.bookingId } }),
      prisma.emailLog.count({
        where: {
          bookingId: seed.bookingId,
          type: EmailLogType.BOOKING_RESCHEDULED,
        },
      }),
      prisma.bookingActionToken.count({ where: { bookingId: seed.bookingId } }),
    ]);

    assert.equal(booking.slotId, seed.oldSlotId);
    assert.equal(booking.scheduledStartsAt.toISOString(), seed.oldStartAt);
    assert.equal(booking.rescheduleCount, 0);
    assert.equal(historyCount, 0);
    assert.equal(emailCount, 0);
    assert.equal(tokenCount, 0);
  } finally {
    await cleanupSeed(seed);
  }
});

dbTest("provider failure po commitu nechá úspěšný reschedule a outbox retry", async () => {
  const seed = await createSeed();
  const {
    prisma,
    rescheduleBooking,
    EmailAudience,
    EmailLogType,
    claimEmailLogForImmediateDelivery,
    deliverEmailLog,
  } = await loadModules();

  try {
    const result = await rescheduleBooking({
      bookingId: seed.bookingId,
      slotId: seed.newSlotId,
      newStartAt: seed.newStartAt,
      changedByUserId: seed.actorUserId,
      notifyClient: true,
      expectedUpdatedAt: seed.bookingUpdatedAt,
    });
    assert.ok(result.notificationStatus === "logged" || result.notificationStatus === "queued");

    const emailLog = await prisma.emailLog.findFirstOrThrow({
      where: {
        bookingId: seed.bookingId,
        type: EmailLogType.BOOKING_RESCHEDULED,
        audience: EmailAudience.CLIENT,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: {
        status: "PENDING",
        attemptCount: 0,
        nextAttemptAt: new Date(0),
        processingStartedAt: null,
        processingToken: null,
        provider: null,
        sentAt: null,
        payload: {
          bookingId: seed.bookingId,
          serviceName: `Test service ${seed.bookingId.slice(0, 8)}`,
          clientName: `Klientka ${seed.bookingId.slice(0, 8)}`,
          previousStartsAt: seed.oldStartAt,
          previousEndsAt: seed.oldEndAt,
          scheduledStartsAt: seed.newStartAt,
          scheduledEndsAt: new Date(new Date(seed.newStartAt).getTime() + 60 * 60 * 1000).toISOString(),
          manageReservationUrl: `https://example.com/rezervace/sprava/${seed.bookingId}`,
          cancellationUrl: `https://example.com/rezervace/storno/${seed.bookingId}`,
          includeCalendarAttachment: false,
        },
      },
    });

    const processingToken = await claimEmailLogForImmediateDelivery(emailLog.id);
    assert.ok(processingToken);
    const deliveryResult = await deliverEmailLog(emailLog.id, processingToken, {
      sendEmail: async () => {
        throw new Error("simulated provider failure after commit");
      },
    });
    const [booking, storedEmailLog] = await Promise.all([
      prisma.booking.findUniqueOrThrow({
        where: { id: seed.bookingId },
        select: { scheduledStartsAt: true, scheduledEndsAt: true, rescheduleCount: true },
      }),
      prisma.emailLog.findUniqueOrThrow({ where: { id: emailLog.id }, select: { status: true } }),
    ]);

    assert.equal(deliveryResult.status, "failed");
    assert.equal(storedEmailLog.status, "PENDING");
    assert.equal(booking.scheduledStartsAt.toISOString(), seed.newStartAt);
    assert.equal(booking.scheduledEndsAt.toISOString(), new Date(new Date(seed.newStartAt).getTime() + 60 * 60 * 1000).toISOString());
    assert.equal(booking.rescheduleCount, 1);
  } finally {
    await cleanupSeed(seed);
  }
});

dbTest("admin manual override po přesunu obnoví a zkompaktuje opuštěný archivovaný původní slot", async () => {
  const seed = await createSeed({ oldSlotPaddingMinutes: 120 });
  const { prisma, rescheduleBooking, AvailabilitySlotStatus, getPublicBookingCatalog } = await loadModules();
  const oldStartAt = new Date(seed.oldStartAt);
  const oldEndAt = new Date(seed.oldEndAt);
  const leftStartsAt = new Date(oldStartAt.getTime() - 60 * 60 * 1000);
  const rightEndsAt = new Date(oldEndAt.getTime() + 60 * 60 * 1000);

  try {
    await prisma.availabilitySlot.update({
      where: { id: seed.oldSlotId },
      data: {
        status: AvailabilitySlotStatus.ARCHIVED,
        internalNote: null,
      },
    });
    const [leftSlot, rightSlot] = await Promise.all([
      prisma.availabilitySlot.create({
        data: {
          startsAt: leftStartsAt,
          endsAt: oldStartAt,
          capacity: 1,
          status: AvailabilitySlotStatus.PUBLISHED,
          publishedAt: new Date(),
          serviceRestrictionMode: "ANY",
          createdByUserId: seed.actorUserId,
        },
        select: { id: true },
      }),
      prisma.availabilitySlot.create({
        data: {
          startsAt: oldEndAt,
          endsAt: rightEndsAt,
          capacity: 1,
          status: AvailabilitySlotStatus.PUBLISHED,
          publishedAt: new Date(),
          serviceRestrictionMode: "ANY",
          createdByUserId: seed.actorUserId,
        },
        select: { id: true },
      }),
    ]);
    await prisma.booking.update({
      where: { id: seed.bookingId },
      data: {
        cleanupMinutes: 15,
        cleanupBlockMinutes: 15,
      },
    });
    const newStartAt = await findIsolatedRescheduleWindow(randomUUID(), 75, [{
      startsAt: leftStartsAt,
      endsAt: rightEndsAt,
    }]);
    const newEndAt = new Date(newStartAt.getTime() + 60 * 60 * 1000);
    const newBlockedUntil = new Date(newEndAt.getTime() + 15 * 60 * 1000);
    const bookingBeforeReschedule = await prisma.booking.findUniqueOrThrow({
      where: { id: seed.bookingId },
      select: { updatedAt: true },
    });

    const result = await rescheduleBooking({
      bookingId: seed.bookingId,
      newStartAt: newStartAt.toISOString(),
      changedByUserId: seed.actorUserId,
      notifyClient: false,
      expectedUpdatedAt: bookingBeforeReschedule.updatedAt.toISOString(),
      allowManualOverride: true,
    });

    assert.equal(result.manualOverride, true);
    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: seed.bookingId },
      select: {
        slotId: true,
        scheduledStartsAt: true,
        scheduledEndsAt: true,
        blockedUntil: true,
        slot: {
          select: {
            status: true,
            startsAt: true,
            endsAt: true,
          },
        },
      },
    });
    assert.notEqual(booking.slotId, seed.oldSlotId);
    assert.equal(booking.slot.status, AvailabilitySlotStatus.DRAFT);
    assert.equal(booking.scheduledStartsAt.toISOString(), newStartAt.toISOString());
    assert.equal(booking.scheduledEndsAt.toISOString(), newEndAt.toISOString());
    assert.equal(booking.blockedUntil?.toISOString(), newBlockedUntil.toISOString());
    assert.equal(booking.slot.startsAt.toISOString(), newStartAt.toISOString());
    assert.equal(booking.slot.endsAt.toISOString(), newBlockedUntil.toISOString());

    const archivedSourceSlot = await prisma.availabilitySlot.findUniqueOrThrow({
      where: { id: seed.oldSlotId },
      select: { status: true, startsAt: true, endsAt: true },
    });
    assert.equal(archivedSourceSlot.status, AvailabilitySlotStatus.ARCHIVED);
    assert.equal(await prisma.availabilitySlot.count({ where: { id: { in: [leftSlot.id, rightSlot.id] } } }), 0);

    const catalog = await getPublicBookingCatalog({ includeServices: false });
    const restoredCatalogSlot = catalog.slots.find((slot) => (
      slot.startsAt === leftStartsAt.toISOString() && slot.endsAt === rightEndsAt.toISOString()
    ));
    assert.ok(restoredCatalogSlot);
    assert.equal(restoredCatalogSlot.startsAt, leftStartsAt.toISOString());
    assert.equal(restoredCatalogSlot.endsAt, rightEndsAt.toISOString());
    assert.equal(restoredCatalogSlot.bookedIntervals.some((interval) => interval.startsAt < seed.oldEndAt && interval.endsAt > seed.oldStartAt), false);
    assert.equal(catalog.slots.some((slot) => newStartAt >= new Date(slot.startsAt) && newStartAt < new Date(slot.endsAt)), false);
    assert.ok(catalog.scheduleOptimization.bookedIntervals.some((interval) => (
      interval.startsAt === newStartAt.toISOString() && interval.endsAt === newBlockedUntil.toISOString()
    )));

    const bookingBeforeSecondReschedule = await prisma.booking.findUniqueOrThrow({
      where: { id: seed.bookingId },
      select: { updatedAt: true, slotId: true },
    });
    await rescheduleBooking({
      bookingId: seed.bookingId,
      slotId: seed.newSlotId,
      newStartAt: seed.newStartAt,
      changedByUserId: seed.actorUserId,
      notifyClient: false,
      expectedUpdatedAt: bookingBeforeSecondReschedule.updatedAt.toISOString(),
    });

    const [manualOverrideSlot, catalogAfterSecondReschedule] = await Promise.all([
      prisma.availabilitySlot.findUniqueOrThrow({
        where: { id: bookingBeforeSecondReschedule.slotId },
        select: { status: true },
      }),
      getPublicBookingCatalog({ includeServices: false }),
    ]);
    assert.equal(manualOverrideSlot.status, AvailabilitySlotStatus.ARCHIVED);
    assert.ok(catalogAfterSecondReschedule.slots.some((slot) => (
      slot.startsAt === leftStartsAt.toISOString() && slot.endsAt === rightEndsAt.toISOString()
    )));
  } finally {
    await cleanupSeed(seed);
  }
});

dbTest("admin manual override obnoví jen volnou část překrytého archivovaného původního slotu", async () => {
  const seed = await createLunchSeed({ cleanupMinutes: 30, oldStart: "15:00", oldEnd: "16:30" });
  const { prisma, rescheduleBooking, AvailabilitySlotStatus, getPublicBookingCatalog } = await loadModules();
  const originalStartsAt = at(seed.localDate, "15:00");
  const originalEndsAt = at(seed.localDate, "16:30");
  const newStartsAt = at(seed.localDate, "16:00");
  const newBlockedUntil = at(seed.localDate, "18:00");

  try {
    await prisma.availabilitySlot.update({
      where: { id: seed.oldSlotId },
      data: {
        startsAt: originalStartsAt,
        endsAt: originalEndsAt,
        status: AvailabilitySlotStatus.ARCHIVED,
        publicNote: "Jen pro vybranou službu",
        internalNote: "Obnovit omezení po manual override",
        serviceRestrictionMode: "SELECTED",
        allowedServices: {
          create: {
            serviceId: seed.serviceId,
          },
        },
      },
    });
    const bookingBeforeReschedule = await prisma.booking.findUniqueOrThrow({
      where: { id: seed.bookingId },
      select: { updatedAt: true },
    });

    const result = await rescheduleBooking({
      bookingId: seed.bookingId,
      newStartAt: newStartsAt.toISOString(),
      changedByUserId: seed.actorUserId,
      notifyClient: false,
      expectedUpdatedAt: bookingBeforeReschedule.updatedAt.toISOString(),
      allowManualOverride: true,
    });

    assert.equal(result.manualOverride, true);
    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: seed.bookingId },
      select: {
        blockedUntil: true,
        slot: {
          select: {
            status: true,
            startsAt: true,
            endsAt: true,
          },
        },
      },
    });
    assert.equal(booking.slot.status, AvailabilitySlotStatus.DRAFT);
    assert.equal(booking.slot.startsAt.toISOString(), newStartsAt.toISOString());
    assert.equal(booking.slot.endsAt.toISOString(), newBlockedUntil.toISOString());
    assert.equal(booking.blockedUntil?.toISOString(), newBlockedUntil.toISOString());

    const restoredSlot = await prisma.availabilitySlot.findFirstOrThrow({
      where: {
        status: AvailabilitySlotStatus.PUBLISHED,
        startsAt: originalStartsAt,
        endsAt: newStartsAt,
      },
      select: {
        status: true,
        startsAt: true,
        endsAt: true,
        publicNote: true,
        internalNote: true,
        serviceRestrictionMode: true,
        allowedServices: {
          select: {
            serviceId: true,
          },
        },
      },
    });
    assert.equal(restoredSlot.status, AvailabilitySlotStatus.PUBLISHED);
    assert.equal(restoredSlot.startsAt.toISOString(), originalStartsAt.toISOString());
    assert.equal(restoredSlot.endsAt.toISOString(), newStartsAt.toISOString());
    assert.equal(restoredSlot.publicNote, "Jen pro vybranou službu");
    assert.equal(restoredSlot.internalNote, "Obnovit omezení po manual override");
    assert.equal(restoredSlot.serviceRestrictionMode, "SELECTED");
    assert.deepEqual(restoredSlot.allowedServices, [{ serviceId: seed.serviceId }]);
    assert.equal(await prisma.availabilitySlot.count({
      where: {
        status: AvailabilitySlotStatus.ARCHIVED,
        startsAt: { lt: newBlockedUntil },
        endsAt: { gt: originalStartsAt },
        createdByUserId: seed.actorUserId,
      },
    }), 1);

    const catalog = await getPublicBookingCatalog({ includeServices: false });
    const restoredCatalogSlot = catalog.slots.find((slot) => (
      slot.startsAt === originalStartsAt.toISOString() && slot.endsAt === newStartsAt.toISOString()
    ));
    assert.ok(restoredCatalogSlot);
    assert.equal(restoredCatalogSlot.startsAt, originalStartsAt.toISOString());
    assert.equal(restoredCatalogSlot.endsAt, newStartsAt.toISOString());
    assert.equal(catalog.slots.some((slot) => newStartsAt >= new Date(slot.startsAt) && newStartsAt < new Date(slot.endsAt)), false);
    assert.ok(catalog.scheduleOptimization.bookedIntervals.some((interval) => (
      interval.startsAt === newStartsAt.toISOString() && interval.endsAt === newBlockedUntil.toISOString()
    )));

    const activeSlots = await prisma.availabilitySlot.findMany({
      where: {
        status: {
          in: [AvailabilitySlotStatus.DRAFT, AvailabilitySlotStatus.PUBLISHED],
        },
        startsAt: { lt: newBlockedUntil },
        endsAt: { gt: originalStartsAt },
        createdByUserId: seed.actorUserId,
      },
      select: { id: true, startsAt: true, endsAt: true },
    });
    for (const [index, slot] of activeSlots.entries()) {
      for (const otherSlot of activeSlots.slice(index + 1)) {
        assert.equal(slot.startsAt < otherSlot.endsAt && slot.endsAt > otherSlot.startsAt, false);
      }
    }
  } finally {
    await cleanupLunchSeed(seed);
  }
});

dbTest("admin manual override při splitu zachová metadata archivovaného slotu", async () => {
  const seed = await createLunchSeed({ cleanupMinutes: 30, oldStart: "15:00", oldEnd: "16:30" });
  const { prisma, rescheduleBooking, AvailabilitySlotStatus } = await loadModules();
  const originalStartsAt = at(seed.localDate, "14:00");
  const originalEndsAt = at(seed.localDate, "19:00");
  const newStartsAt = at(seed.localDate, "16:00");
  const newBlockedUntil = at(seed.localDate, "18:00");

  try {
    await prisma.availabilitySlot.update({
      where: { id: seed.oldSlotId },
      data: {
        startsAt: originalStartsAt,
        endsAt: originalEndsAt,
        status: AvailabilitySlotStatus.ARCHIVED,
        capacity: 1,
        publicNote: "Nestandardní veřejná poznámka",
        internalNote: "Nestandardní interní poznámka",
        serviceRestrictionMode: "SELECTED",
        allowedServices: {
          create: {
            serviceId: seed.serviceId,
          },
        },
      },
    });
    const bookingBeforeReschedule = await prisma.booking.findUniqueOrThrow({
      where: { id: seed.bookingId },
      select: { updatedAt: true },
    });

    const result = await rescheduleBooking({
      bookingId: seed.bookingId,
      newStartAt: newStartsAt.toISOString(),
      changedByUserId: seed.actorUserId,
      notifyClient: false,
      expectedUpdatedAt: bookingBeforeReschedule.updatedAt.toISOString(),
      allowManualOverride: true,
    });

    assert.equal(result.manualOverride, true);
    const restoredSlots = await prisma.availabilitySlot.findMany({
      where: {
        status: AvailabilitySlotStatus.PUBLISHED,
        startsAt: { gte: originalStartsAt },
        endsAt: { lte: originalEndsAt },
        createdByUserId: seed.actorUserId,
      },
      orderBy: { startsAt: "asc" },
      select: {
        startsAt: true,
        endsAt: true,
        capacity: true,
        publicNote: true,
        internalNote: true,
        serviceRestrictionMode: true,
        createdByUserId: true,
        allowedServices: {
          select: {
            serviceId: true,
          },
        },
      },
    });

    assert.equal(restoredSlots.length, 2);
    assert.deepEqual(restoredSlots.map((slot) => [
      slot.startsAt.toISOString(),
      slot.endsAt.toISOString(),
    ]), [
      [originalStartsAt.toISOString(), newStartsAt.toISOString()],
      [newBlockedUntil.toISOString(), originalEndsAt.toISOString()],
    ]);
    for (const slot of restoredSlots) {
      assert.equal(slot.capacity, 1);
      assert.equal(slot.publicNote, "Nestandardní veřejná poznámka");
      assert.equal(slot.internalNote, "Nestandardní interní poznámka");
      assert.equal(slot.serviceRestrictionMode, "SELECTED");
      assert.equal(slot.createdByUserId, seed.actorUserId);
      assert.deepEqual(slot.allowedServices, [{ serviceId: seed.serviceId }]);
    }
  } finally {
    await cleanupLunchSeed(seed);
  }
});

dbTest("rescheduleBooking ignores an archived slot left by a cancelled booking", async () => {
  const seed = await createSeed();
  const { prisma, rescheduleBooking, AvailabilitySlotStatus } = await loadModules();

  await prisma.availabilitySlot.create({
    data: {
      startsAt: new Date(new Date(seed.newStartAt).getTime() - 30 * 60 * 1000),
      endsAt: new Date(new Date(seed.newEndAt).getTime() + 30 * 60 * 1000),
      capacity: 1,
      status: AvailabilitySlotStatus.ARCHIVED,
      serviceRestrictionMode: "ANY",
      internalNote: "Historicky slot po zrusene rezervaci",
      createdByUserId: seed.actorUserId,
    },
  });

  try {
    const result = await rescheduleBooking({
      bookingId: seed.bookingId,
      slotId: seed.newSlotId,
      newStartAt: seed.newStartAt,
      changedByUserId: seed.actorUserId,
      notifyClient: false,
      expectedUpdatedAt: seed.bookingUpdatedAt,
    });

    assert.equal(result.bookingId, seed.bookingId);
  } finally {
    await cleanupSeed(seed);
  }
});

dbTest("rescheduleBooking writes client-originated audit flag for self-service changes", async () => {
  const seed = await createSeed();
  const { prisma, rescheduleBooking } = await loadModules();

  try {
    await rescheduleBooking({
      bookingId: seed.bookingId,
      slotId: seed.newSlotId,
      newStartAt: seed.newStartAt,
      changedByUserId: null,
      changedByClient: true,
      notifyClient: false,
      expectedUpdatedAt: seed.bookingUpdatedAt,
    });

    const rescheduleLog = await prisma.bookingRescheduleLog.findFirstOrThrow({
      where: { bookingId: seed.bookingId },
      orderBy: { createdAt: "desc" },
      select: {
        changedByUserId: true,
        changedByClient: true,
      },
    });

    assert.equal(rescheduleLog.changedByUserId, null);
    assert.equal(rescheduleLog.changedByClient, true);
  } finally {
    await cleanupSeed(seed);
  }
});

dbTest("rescheduleBooking rejects a conflicting active interval", async () => {
  const seed = await createSeed();
  const { prisma, rescheduleBooking, BookingRescheduleError, BookingStatus } = await loadModules();
  const conflictClient = await prisma.client.create({
    data: {
      fullName: `Kolize ${randomUUID().slice(0, 8)}`,
      email: `conflict-${randomUUID().slice(0, 8)}@example.com`,
      isActive: true,
    },
    select: { id: true },
  });
  const conflictingBooking = await prisma.booking.create({
    data: {
      clientId: conflictClient.id,
      slotId: seed.newSlotId,
      serviceId: seed.serviceId,
      source: "PHONE",
      isManual: false,
      manualOverride: false,
      status: BookingStatus.CONFIRMED,
      clientNameSnapshot: "Kolizní klientka",
      clientEmailSnapshot: `conflict-booking-${randomUUID().slice(0, 8)}@example.com`,
      serviceNameSnapshot: "Kolizní služba",
      serviceDurationMinutes: 60,
      scheduledStartsAt: new Date(seed.newStartAt),
      scheduledEndsAt: new Date(new Date(seed.newStartAt).getTime() + 60 * 60 * 1000),
    },
    select: { id: true },
  });

  try {
    await assert.rejects(
      () =>
        rescheduleBooking({
          bookingId: seed.bookingId,
          slotId: seed.newSlotId,
          newStartAt: seed.newStartAt,
          changedByUserId: seed.actorUserId,
          notifyClient: false,
          expectedUpdatedAt: seed.bookingUpdatedAt,
        }),
      (error: unknown) => {
        assert.ok(error instanceof BookingRescheduleError);
        assert.match(error.message, /koliduje/i);
        return true;
      },
    );

    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: seed.bookingId },
      select: {
        slotId: true,
        rescheduleCount: true,
      },
    });

    assert.equal(booking.slotId, seed.oldSlotId);
    assert.equal(booking.rescheduleCount, 0);
  } finally {
    await prisma.emailLog.deleteMany({ where: { bookingId: conflictingBooking.id } });
    await prisma.booking.deleteMany({ where: { id: conflictingBooking.id } });
    await prisma.client.deleteMany({ where: { id: conflictClient.id } });
    await cleanupSeed(seed);
  }
});

dbTest("rescheduleBooking rejects closed booking states", async () => {
  const seed = await createSeed();
  const { prisma, rescheduleBooking, BookingRescheduleError, BookingStatus } = await loadModules();

  await prisma.booking.update({
    where: { id: seed.bookingId },
    data: {
      status: BookingStatus.CANCELLED,
      cancelledAt: new Date("2026-05-02T08:00:00.000Z"),
    },
  });

  try {
    await assert.rejects(
      () =>
        rescheduleBooking({
          bookingId: seed.bookingId,
          slotId: seed.newSlotId,
          newStartAt: seed.newStartAt,
          changedByUserId: seed.actorUserId,
          notifyClient: false,
        }),
      (error: unknown) => {
        assert.ok(error instanceof BookingRescheduleError);
        assert.match(error.message, /není možné přesunout/i);
        return true;
      },
    );
  } finally {
    await cleanupSeed(seed);
  }
});
