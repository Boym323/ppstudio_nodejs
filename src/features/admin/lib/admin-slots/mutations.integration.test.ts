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
    syncPlannerWeekDraft: plannerMutations.syncPlannerWeekDraft,
    copyPlannerDay: plannerMutations.copyPlannerDay,
    copyPlannerWeek: plannerMutations.copyPlannerWeek,
    getCellRangeBounds: plannerTime.getCellRangeBounds,
  };
}

async function createSeed(): Promise<SeedContext> {
  const { prisma, getCellRangeBounds } = await loadModules();
  const suffix = randomUUID().slice(0, 8);
  const dateKey = "2026-07-13";
  const weekKey = dateKey;
  const before = getCellRangeBounds(dateKey, 4, 6);
  const bookedRange = getCellRangeBounds(dateKey, 6, 8);
  const after = getCellRangeBounds(dateKey, 8, 16);

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
        endsAt: after.endsAt,
        capacity: 1,
        status: AvailabilitySlotStatus.PUBLISHED,
        serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
        publishedAt: new Date(),
        createdByUserId: actor.id,
      },
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
  const dateKey = "2026-07-20";
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
    assert.deepEqual(
      dayBeforePublish?.availableIntervals.map((interval) => ({
        startCell: interval.startCell,
        endCell: interval.endCell,
      })),
      [{
        startCell: 16,
        endCell: 19,
      }],
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
    assert.equal(dayAfterPublish?.availableIntervals.length, 0);
    assert.equal(dayAfterPublish?.lockedIntervals.length, 0);
    assert.equal(dayAfterPublish?.bookings.length, 0);
  } finally {
    await prisma.booking.deleteMany({ where: { id: booking.id } });
    await prisma.availabilitySlot.deleteMany({ where: { createdByUserId: actor.id } });
    await prisma.client.deleteMany({ where: { id: client.id } });
    await prisma.service.deleteMany({ where: { id: service.id } });
    await prisma.serviceCategory.deleteMany({ where: { id: category.id } });
    await prisma.adminUser.deleteMany({ where: { id: actor.id } });
  }
});

dbTest("copyPlannerDay preserves local hours over spring DST", async () => {
  const { prisma, copyPlannerDay, getCellRangeBounds } = await loadModules();
  const suffix = randomUUID().slice(0, 8);
  const actor = await prisma.adminUser.create({
    data: {
      email: `copy-day-${suffix}@example.com`,
      name: `Copy Day ${suffix}`,
      role: AdminRole.OWNER,
      isActive: true,
    },
    select: { id: true },
  });
  const source = getCellRangeBounds("2026-03-28", 6, 8);
  const expectedTarget = getCellRangeBounds("2026-03-29", 6, 8);

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

    await copyPlannerDay("owner", {
      weekKey: "2026-03-23",
      sourceDateKey: "2026-03-28",
      targetDateKey: "2026-03-29",
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

    assert.equal(targetSlot.startsAt.toISOString(), "2026-03-29T07:00:00.000Z");
    assert.equal(targetSlot.endsAt.toISOString(), "2026-03-29T08:00:00.000Z");
  } finally {
    await prisma.availabilitySlot.deleteMany({ where: { createdByUserId: actor.id } });
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
