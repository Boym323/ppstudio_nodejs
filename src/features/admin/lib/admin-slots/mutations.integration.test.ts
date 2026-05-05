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
  const [{ prisma }, plannerMutations, plannerTime] = await Promise.all([
    import("@/lib/prisma"),
    import("./mutations"),
    import("./time"),
  ]);

  return {
    prisma,
    syncPlannerWeekDraft: plannerMutations.syncPlannerWeekDraft,
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
