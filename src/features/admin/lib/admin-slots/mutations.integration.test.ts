import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  AdminRole,
  AvailabilitySlotServiceRestrictionMode,
  AvailabilitySlotStatus,
  BookingSource,
  BookingStatus,
} from "@prisma/client";

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
  actorUserId: string;
  categoryId: string;
  serviceId: string;
  clientId: string;
  bookingId: string;
  bookedSlotId: string;
  dateKey: string;
  weekKey: string;
};

type SeedOptions = {
  splitTrailingAvailableSlot?: boolean;
};

async function loadModules() {
  const [{ prisma }, plannerMutations, plannerQueries, plannerTime] = await Promise.all([
    import("@/lib/prisma"),
    import("./mutations"),
    import("./queries"),
    import("./time"),
  ]);

  return {
    prisma,
    getAdminPlannerWeek: plannerQueries.getAdminPlannerWeek,
    applyAvailabilitySelection: plannerMutations.applyAvailabilitySelection,
    syncPlannerWeekDraft: plannerMutations.syncPlannerWeekDraft,
    copyPlannerWeek: plannerMutations.copyPlannerWeek,
    getCellRangeBounds: plannerTime.getCellRangeBounds,
    getDayBounds: plannerTime.getDayBounds,
    addDays: plannerTime.addDays,
    formatDateKey: plannerTime.formatDateKey,
    resolveWeekStart: plannerTime.resolveWeekStart,
  };
}

dbTest("applyAvailabilitySelection odebere jedinou půlhodinu z volného okna", async () => {
  const seed = await createSeed();
  const { getAdminPlannerWeek, applyAvailabilitySelection } = await loadModules();

  try {
    await applyAvailabilitySelection("owner", {
      weekKey: seed.weekKey,
      dateKey: seed.dateKey,
      startCell: 4,
      endCell: 5,
      mode: "remove",
      actorUserId: seed.actorUserId,
    });

    const week = await getAdminPlannerWeek("owner", seed.weekKey);
    const day = week.days.find((item) => item.dateKey === seed.dateKey);
    assert.ok(day);
    assert.ok(!day.availableIntervals.some((interval) => interval.startCell <= 4 && interval.endCell > 4));
    assert.ok(day.availableIntervals.some((interval) => interval.startCell === 5 && interval.endCell === 6));
  } finally {
    await cleanupSeed(seed);
  }
});

async function findIsolatedPlannerDateKey() {
  const { prisma, addDays, formatDateKey, getDayBounds, resolveWeekStart } = await loadModules();
  const searchStart = addDays(resolveWeekStart(), 21);

  for (let offset = 0; offset < 120; offset += 1) {
    const candidate = addDays(searchStart, offset);
    const dateKey = formatDateKey(candidate);
    const { startsAt, endsAt } = getDayBounds(dateKey);
    const [slotCount, bookingCount] = await Promise.all([
      prisma.availabilitySlot.count({
        where: {
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
      }),
      prisma.booking.count({
        where: {
          scheduledStartsAt: { lt: endsAt },
          OR: [
            {
              blockedUntil: { gt: startsAt },
            },
            {
              blockedUntil: null,
              scheduledEndsAt: { gt: startsAt },
            },
          ],
        },
      }),
    ]);

    if (slotCount === 0 && bookingCount === 0) {
      return dateKey;
    }
  }

  throw new Error("Nepodařilo se najít izolovaný planner den pro integrační test.");
}

async function createSeed(options: SeedOptions = {}): Promise<SeedContext> {
  const { prisma, getCellRangeBounds } = await loadModules();
  const suffix = randomUUID().slice(0, 8);
  const dateKey = await findIsolatedPlannerDateKey();
  const weekKey = dateKey;
  const before = getCellRangeBounds(dateKey, 4, 6);
  const bookedRange = getCellRangeBounds(dateKey, 6, 8);
  const after = getCellRangeBounds(dateKey, 8, 16);
  const trailingSplit = getCellRangeBounds(dateKey, 9, 10);

  const actor = await prisma.adminUser.create({
    data: {
      email: `planner-${suffix}@example.com`,
      name: `Planner Test ${suffix}`,
      role: AdminRole.OWNER,
      isActive: true,
    },
    select: {
      id: true,
    },
  });
  const category = await prisma.serviceCategory.create({
    data: {
      name: `Planner category ${suffix}`,
      slug: `planner-category-${suffix}`,
      isActive: true,
    },
    select: {
      id: true,
    },
  });
  const service = await prisma.service.create({
    data: {
      categoryId: category.id,
      name: `Planner service ${suffix}`,
      slug: `planner-service-${suffix}`,
      durationMinutes: 60,
      isActive: true,
      isPubliclyBookable: true,
    },
    select: {
      id: true,
      name: true,
      durationMinutes: true,
    },
  });
  const client = await prisma.client.create({
    data: {
      fullName: `Planner klientka ${suffix}`,
      email: `planner-client-${suffix}@example.com`,
      phone: "+420777123456",
      isActive: true,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
    },
  });

  await prisma.availabilitySlot.createMany({
    data: [
      {
        startsAt: before.startsAt,
        endsAt: before.endsAt,
        capacity: 1,
        status: AvailabilitySlotStatus.PUBLISHED,
        serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
        publishedAt: new Date(),
        createdByUserId: actor.id,
      },
      {
        startsAt: bookedRange.startsAt,
        endsAt: bookedRange.endsAt,
        capacity: 1,
        status: AvailabilitySlotStatus.PUBLISHED,
        serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
        publishedAt: new Date(),
        createdByUserId: actor.id,
      },
      {
        startsAt: after.startsAt,
        endsAt: options.splitTrailingAvailableSlot ? trailingSplit.startsAt : after.endsAt,
        capacity: 1,
        status: AvailabilitySlotStatus.PUBLISHED,
        serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
        publishedAt: new Date(),
        createdByUserId: actor.id,
      },
      ...(options.splitTrailingAvailableSlot ? [{
        startsAt: trailingSplit.startsAt,
        endsAt: trailingSplit.endsAt,
        capacity: 1,
        status: AvailabilitySlotStatus.PUBLISHED,
        serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
        publishedAt: new Date(),
        createdByUserId: actor.id,
      }] : []),
    ],
  });

  const bookedSlot = await prisma.availabilitySlot.findFirstOrThrow({
    where: {
      createdByUserId: actor.id,
      startsAt: bookedRange.startsAt,
      endsAt: bookedRange.endsAt,
    },
    select: {
      id: true,
    },
  });
  const booking = await prisma.booking.create({
    data: {
      clientId: client.id,
      slotId: bookedSlot.id,
      serviceId: service.id,
      source: BookingSource.PHONE,
      isManual: true,
      status: BookingStatus.CONFIRMED,
      clientNameSnapshot: client.fullName,
      clientEmailSnapshot: client.email ?? `planner-client-${suffix}@example.com`,
      clientPhoneSnapshot: client.phone,
      serviceNameSnapshot: service.name,
      serviceDurationMinutes: service.durationMinutes,
      scheduledStartsAt: bookedRange.startsAt,
      scheduledEndsAt: bookedRange.endsAt,
      confirmedAt: new Date(),
      createdByUserId: actor.id,
    },
    select: {
      id: true,
    },
  });

  return {
    actorUserId: actor.id,
    categoryId: category.id,
    serviceId: service.id,
    clientId: client.id,
    bookingId: booking.id,
    bookedSlotId: bookedSlot.id,
    dateKey,
    weekKey,
  };
}

async function cleanupSeed(seed: SeedContext) {
  const { prisma } = await loadModules();

  await prisma.booking.deleteMany({ where: { id: seed.bookingId } });
  await prisma.availabilitySlot.deleteMany({ where: { createdByUserId: seed.actorUserId } });
  await prisma.client.deleteMany({ where: { id: seed.clientId } });
  await prisma.service.deleteMany({ where: { id: seed.serviceId } });
  await prisma.serviceCategory.deleteMany({ where: { id: seed.categoryId } });
  await prisma.adminUser.deleteMany({ where: { id: seed.actorUserId } });
}

dbTest("syncPlannerWeekDraft preserves booked intervals while replacing editable availability around them", async () => {
  const seed = await createSeed();
  const { prisma, syncPlannerWeekDraft, getCellRangeBounds } = await loadModules();

  try {
    await syncPlannerWeekDraft("owner", {
      weekKey: seed.weekKey,
      actorUserId: seed.actorUserId,
      days: [
        {
          dateKey: seed.dateKey,
          intervals: [
            {
              startCell: 4,
              endCell: 16,
            },
          ],
        },
      ],
    });

    const expectedBefore = getCellRangeBounds(seed.dateKey, 4, 6);
    const expectedBooked = getCellRangeBounds(seed.dateKey, 6, 8);
    const expectedAfter = getCellRangeBounds(seed.dateKey, 8, 16);
    const slots = await prisma.availabilitySlot.findMany({
      where: {
        createdByUserId: seed.actorUserId,
      },
      orderBy: {
        startsAt: "asc",
      },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        bookings: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    assert.deepEqual(
      slots.map((slot) => ({
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        bookingCount: slot.bookings.length,
      })),
      [
        {
          startsAt: expectedBefore.startsAt.toISOString(),
          endsAt: expectedBefore.endsAt.toISOString(),
          bookingCount: 0,
        },
        {
          startsAt: expectedBooked.startsAt.toISOString(),
          endsAt: expectedBooked.endsAt.toISOString(),
          bookingCount: 1,
        },
        {
          startsAt: expectedAfter.startsAt.toISOString(),
          endsAt: expectedAfter.endsAt.toISOString(),
          bookingCount: 0,
        },
      ],
    );
    assert.equal(slots[1]?.id, seed.bookedSlotId);

    const booking = await prisma.booking.findUniqueOrThrow({
      where: {
        id: seed.bookingId,
      },
      select: {
        slotId: true,
        status: true,
      },
    });

    assert.equal(booking.slotId, seed.bookedSlotId);
    assert.equal(booking.status, BookingStatus.CONFIRMED);
  } finally {
    await cleanupSeed(seed);
  }
});

dbTest("getAdminPlannerWeek exposes service time and cleanup overlay metadata for booked cells", async () => {
  const seed = await createSeed();
  const { prisma, getAdminPlannerWeek } = await loadModules();

  try {
    const originalBooking = await prisma.booking.findUniqueOrThrow({
      where: { id: seed.bookingId },
      select: {
        scheduledEndsAt: true,
      },
    });
    const blockedUntil = new Date(originalBooking.scheduledEndsAt.getTime() + 15 * 60 * 1000);

    await prisma.booking.update({
      where: { id: seed.bookingId },
      data: {
        cleanupMinutes: 10,
        cleanupBlockMinutes: 15,
        blockedUntil,
      },
    });

    const week = await getAdminPlannerWeek("owner", seed.weekKey);
    const day = week.days.find((item) => item.dateKey === seed.dateKey);

    assert.ok(day);
    assert.equal(day.bookings.length, 1);

    const booking = day.bookings[0];
    assert.equal(booking.label, "09:00 - 10:00");
    assert.equal(booking.blockedLabel, "09:00 - 10:15");
    assert.equal(booking.cleanupBlockedUntilLabel, "10:15");
    assert.equal(booking.hasCleanupBlock, true);
    assert.equal(booking.startCell, 6);
    assert.equal(booking.endCell, 9);

    assert.equal(day.cells.booked[6], true);
    assert.equal(day.cells.booked[7], true);
    assert.equal(day.cells.booked[8], true);
    assert.equal(day.cells.bookedCleanup[6], false);
    assert.equal(day.cells.bookedCleanup[7], false);
    assert.equal(day.cells.bookedCleanup[8], true);
    assert.ok(
      day.availableBlocks.some((block) => block.startMinutes <= 255 && block.endMinutes >= 270),
      "15min volno po úklidu má zůstat ve vizuálních blocích",
    );
  } finally {
    await cleanupSeed(seed);
  }
});

dbTest("getAdminPlannerWeek removes adjacent free window when cleanup overflows into the next slot", async () => {
  const seed = await createSeed();
  const { prisma, getAdminPlannerWeek } = await loadModules();

  try {
    const originalBooking = await prisma.booking.findUniqueOrThrow({
      where: { id: seed.bookingId },
      select: {
        scheduledEndsAt: true,
      },
    });
    const blockedUntil = new Date(originalBooking.scheduledEndsAt.getTime() + 30 * 60 * 1000);

    await prisma.booking.update({
      where: { id: seed.bookingId },
      data: {
        cleanupMinutes: 10,
        cleanupBlockMinutes: 30,
        blockedUntil,
      },
    });

    const week = await getAdminPlannerWeek("owner", seed.weekKey);
    const day = week.days.find((item) => item.dateKey === seed.dateKey);

    assert.ok(day);
    assert.deepEqual(
      day.availableIntervals.map((interval) => ({
        startCell: interval.startCell,
        endCell: interval.endCell,
      })),
      [
        {
          startCell: 4,
          endCell: 6,
        },
        {
          startCell: 9,
          endCell: 16,
        },
      ],
    );
    assert.ok(
      day.lockedIntervals.some((interval) => interval.startCell === 8 && interval.endCell === 9),
    );
  } finally {
    await cleanupSeed(seed);
  }
});

dbTest("getAdminPlannerWeek merges adjacent editable slots into one free window", async () => {
  const seed = await createSeed({ splitTrailingAvailableSlot: true });
  const { getAdminPlannerWeek } = await loadModules();

  try {
    const week = await getAdminPlannerWeek("owner", seed.weekKey);
    const day = week.days.find((item) => item.dateKey === seed.dateKey);

    assert.ok(day);
    assert.deepEqual(
      day.availableIntervals.map((interval) => ({
        startCell: interval.startCell,
        endCell: interval.endCell,
        label: interval.label,
      })),
      [
        {
          startCell: 4,
          endCell: 6,
          label: "08:00 - 09:00",
        },
        {
          startCell: 8,
          endCell: 10,
          label: "10:00 - 11:00",
        },
      ],
    );
  } finally {
    await cleanupSeed(seed);
  }
});

dbTest("syncPlannerWeekDraft preserves slots that still have a cancelled booking relation", async () => {
  const { prisma, getAdminPlannerWeek, syncPlannerWeekDraft, getCellRangeBounds } = await loadModules();
  const suffix = randomUUID().slice(0, 8);
  const actor = await prisma.adminUser.create({
    data: {
      email: `planner-cancelled-${suffix}@example.com`,
      name: `Planner Cancelled ${suffix}`,
      role: AdminRole.OWNER,
      isActive: true,
    },
    select: { id: true },
  });
  const category = await prisma.serviceCategory.create({
    data: {
      name: `Planner cancelled category ${suffix}`,
      slug: `planner-cancelled-category-${suffix}`,
      isActive: true,
    },
    select: { id: true },
  });
  const service = await prisma.service.create({
    data: {
      categoryId: category.id,
      name: `Planner cancelled service ${suffix}`,
      slug: `planner-cancelled-service-${suffix}`,
      durationMinutes: 60,
      isActive: true,
      isPubliclyBookable: true,
    },
    select: {
      id: true,
      name: true,
      durationMinutes: true,
    },
  });
  const client = await prisma.client.create({
    data: {
      fullName: `Planner zrusena ${suffix}`,
      email: `planner-cancelled-client-${suffix}@example.com`,
      phone: "+420777123456",
      isActive: true,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
    },
  });
  const dateKey = await findIsolatedPlannerDateKey();
  const weekKey = dateKey;
  const slotRange = getCellRangeBounds(dateKey, 16, 19);
  const slot = await prisma.availabilitySlot.create({
    data: {
      startsAt: slotRange.startsAt,
      endsAt: slotRange.endsAt,
      capacity: 1,
      status: AvailabilitySlotStatus.PUBLISHED,
      serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
      publishedAt: new Date(),
      createdByUserId: actor.id,
    },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
    },
  });
  const booking = await prisma.booking.create({
    data: {
      clientId: client.id,
      slotId: slot.id,
      serviceId: service.id,
      source: BookingSource.PHONE,
      isManual: true,
      status: BookingStatus.CANCELLED,
      clientNameSnapshot: client.fullName,
      clientEmailSnapshot: client.email ?? `planner-cancelled-client-${suffix}@example.com`,
      clientPhoneSnapshot: client.phone,
      serviceNameSnapshot: service.name,
      serviceDurationMinutes: service.durationMinutes,
      scheduledStartsAt: slotRange.startsAt,
      scheduledEndsAt: slotRange.endsAt,
      cancelledAt: new Date(),
      createdByUserId: actor.id,
    },
    select: { id: true },
  });

  try {
    const weekBeforePublish = await getAdminPlannerWeek("owner", weekKey);
    const dayBeforePublish = weekBeforePublish.days.find((day) => day.dateKey === dateKey);

    assert.ok(dayBeforePublish);
    assert.ok(
      dayBeforePublish?.availableIntervals.some(
        (interval) => interval.startCell === 16 && interval.endCell === 19,
      ),
    );
    assert.equal(dayBeforePublish?.lockedIntervals.length, 0);

    await syncPlannerWeekDraft("owner", {
      weekKey,
      actorUserId: actor.id,
      days: [
        {
          dateKey,
          intervals: [],
        },
      ],
    });

    const slots = await prisma.availabilitySlot.findMany({
      where: {
        createdByUserId: actor.id,
      },
      orderBy: {
        startsAt: "asc",
      },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        bookings: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    assert.deepEqual(
      slots.map((currentSlot) => ({
        id: currentSlot.id,
        status: currentSlot.bookings.length > 0 ? "historical" : "replacement",
        startsAt: currentSlot.startsAt.toISOString(),
        endsAt: currentSlot.endsAt.toISOString(),
        bookingStatuses: currentSlot.bookings.map((currentBooking) => currentBooking.status),
      })),
      [
        {
          id: slot.id,
          status: "historical",
          startsAt: slot.startsAt.toISOString(),
          endsAt: slot.endsAt.toISOString(),
          bookingStatuses: [BookingStatus.CANCELLED],
        },
      ],
    );

    const storedBooking = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
      select: {
        slotId: true,
        status: true,
      },
    });

    assert.equal(storedBooking.slotId, slot.id);
    assert.equal(storedBooking.status, BookingStatus.CANCELLED);

    const archivedSlot = await prisma.availabilitySlot.findUniqueOrThrow({
      where: { id: slot.id },
      select: {
        status: true,
      },
    });

    assert.equal(archivedSlot.status, AvailabilitySlotStatus.ARCHIVED);

    const weekAfterPublish = await getAdminPlannerWeek("owner", weekKey);
    const dayAfterPublish = weekAfterPublish.days.find((day) => day.dateKey === dateKey);

    assert.ok(dayAfterPublish);
    assert.ok(
      !dayAfterPublish?.availableIntervals.some(
        (interval) => interval.startCell === 16 && interval.endCell === 19,
      ),
    );
    assert.ok(!dayAfterPublish?.bookings.some((currentBooking) => currentBooking.id === booking.id));
  } finally {
    await prisma.booking.deleteMany({ where: { id: booking.id } });
    await prisma.availabilitySlot.deleteMany({ where: { createdByUserId: actor.id } });
    await prisma.client.deleteMany({ where: { id: client.id } });
    await prisma.service.deleteMany({ where: { id: service.id } });
    await prisma.serviceCategory.deleteMany({ where: { id: category.id } });
    await prisma.adminUser.deleteMany({ where: { id: actor.id } });
  }
});

dbTest("copyPlannerWeek preserves local hours over autumn DST", async () => {
  const { prisma, copyPlannerWeek, getCellRangeBounds } = await loadModules();
  const suffix = randomUUID().slice(0, 8);
  const actor = await prisma.adminUser.create({
    data: {
      email: `copy-week-${suffix}@example.com`,
      name: `Copy Week ${suffix}`,
      role: AdminRole.OWNER,
      isActive: true,
    },
    select: { id: true },
  });
  const source = getCellRangeBounds("2026-10-23", 6, 8);
  const expectedTarget = getCellRangeBounds("2026-10-30", 6, 8);

  try {
    await prisma.availabilitySlot.create({
      data: {
        startsAt: source.startsAt,
        endsAt: source.endsAt,
        capacity: 1,
        status: AvailabilitySlotStatus.PUBLISHED,
        serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
        publishedAt: new Date(),
        createdByUserId: actor.id,
      },
    });

    await copyPlannerWeek("owner", {
      sourceWeekKey: "2026-10-19",
      targetWeekKey: "2026-10-26",
      actorUserId: actor.id,
    });

    const targetSlot = await prisma.availabilitySlot.findFirstOrThrow({
      where: {
        createdByUserId: actor.id,
        startsAt: expectedTarget.startsAt,
        endsAt: expectedTarget.endsAt,
      },
      select: {
        startsAt: true,
        endsAt: true,
      },
    });

    assert.equal(targetSlot.startsAt.toISOString(), "2026-10-30T08:00:00.000Z");
    assert.equal(targetSlot.endsAt.toISOString(), "2026-10-30T09:00:00.000Z");
  } finally {
    await prisma.availabilitySlot.deleteMany({ where: { createdByUserId: actor.id } });
    await prisma.adminUser.deleteMany({ where: { id: actor.id } });
  }
});
