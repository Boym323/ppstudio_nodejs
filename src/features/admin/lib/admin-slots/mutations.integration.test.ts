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
      operationId: randomUUID(),
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

dbTest("změna dostupnosti uloží audit se stavem před a po, autorem a odstraněnými sloty", async () => {
  const seed = await createSeed();
  const { prisma, applyAvailabilitySelection } = await loadModules();

  try {
    const result = await applyAvailabilitySelection("owner", {
      weekKey: seed.weekKey, dateKey: seed.dateKey, startCell: 4, endCell: 5,
      mode: "remove", operationId: randomUUID(), actorUserId: seed.actorUserId, actorRole: AdminRole.OWNER,
    });
    const audit = await prisma.availabilityAuditEvent.findFirstOrThrow({ where: { operationId: result.operationId } });
    assert.equal(audit.actorUserId, seed.actorUserId);
    assert.equal(audit.actorRole, AdminRole.OWNER);
    assert.equal(audit.dateKey, seed.dateKey);
    assert.equal(audit.operation, "REMOVE");
    assert.equal(audit.timeZone, "Europe/Prague");
    assert.ok(Array.isArray((audit.before as { intervals: unknown[] }).intervals));
    assert.ok(Array.isArray((audit.after as { intervals: unknown[] }).intervals));
    assert.ok(Array.isArray(audit.archivedOrRemovedSlots));
  } finally { await cleanupSeed(seed); }
});

dbTest("applyAvailabilitySelection vrátí stejný výsledek při retry se stejným operationId", async () => {
  const seed = await createSeed();
  const { prisma, getAdminPlannerWeek, applyAvailabilitySelection } = await loadModules();

  try {
    const input = {
      weekKey: seed.weekKey,
      dateKey: seed.dateKey,
      startCell: 16,
      endCell: 18,
      actorUserId: seed.actorUserId,
      mode: "add" as const,
      operationId: randomUUID(),
    };
    const first = await applyAvailabilitySelection("owner", input);
    const retry = await applyAvailabilitySelection("owner", input);

    const week = await getAdminPlannerWeek("owner", seed.weekKey);
    const day = week.days.find((item) => item.dateKey === seed.dateKey);
    assert.ok(day);
    assert.deepEqual(retry, first);
    assert.equal(await prisma.availabilityAuditEvent.count({ where: { operationId: input.operationId } }), 1);
    assert.equal(await prisma.availabilityOperation.count({ where: { operationId: input.operationId } }), 1);
    assert.ok(day.availableIntervals.some((interval) => interval.startCell <= 16 && interval.endCell >= 18));
  } finally {
    await cleanupSeed(seed);
  }
});

dbTest("operationId rozlišuje samostatné změny a odmítne jiný interval nebo režim", async () => {
  const seed = await createSeed();
  const { prisma, applyAvailabilitySelection } = await loadModules();
  const firstOperationId = randomUUID();

  try {
    await applyAvailabilitySelection("owner", {
      weekKey: seed.weekKey, dateKey: seed.dateKey, startCell: 16, endCell: 17,
      mode: "add", operationId: firstOperationId, actorUserId: seed.actorUserId,
    });
    const second = await applyAvailabilitySelection("owner", {
      weekKey: seed.weekKey, dateKey: seed.dateKey, startCell: 16, endCell: 17,
      mode: "add", operationId: randomUUID(), actorUserId: seed.actorUserId,
    });

    assert.ok(second.operationId);
    assert.notEqual(second.operationId, firstOperationId);
    assert.equal(await prisma.availabilityAuditEvent.count({ where: { operationId: { in: [firstOperationId, second.operationId] } } }), 2);
    await assert.rejects(
      applyAvailabilitySelection("owner", {
        weekKey: seed.weekKey, dateKey: seed.dateKey, startCell: 17, endCell: 18,
        mode: "add", operationId: firstOperationId, actorUserId: seed.actorUserId,
      }),
      /idempotentní klíč už patří k jiné změně/,
    );
    await assert.rejects(
      applyAvailabilitySelection("owner", {
        weekKey: seed.weekKey, dateKey: seed.dateKey, startCell: 16, endCell: 17,
        mode: "remove", operationId: firstOperationId, actorUserId: seed.actorUserId,
      }),
      /idempotentní klíč už patří k jiné změně/,
    );
  } finally {
    await cleanupSeed(seed);
  }
});

dbTest("souběžné retry a ztracená odpověď vytvoří jedinou operaci a audit", async () => {
  const seed = await createSeed();
  const { prisma, applyAvailabilitySelection } = await loadModules();
  const operationId = randomUUID();
  const input = {
    weekKey: seed.weekKey, dateKey: seed.dateKey, startCell: 16, endCell: 18,
    mode: "add" as const, operationId, actorUserId: seed.actorUserId,
  };

  try {
    const [first, concurrentRetry] = await Promise.all([
      applyAvailabilitySelection("owner", input),
      applyAvailabilitySelection("owner", input),
    ]);
    const slotsAfterConcurrentRetry = await prisma.availabilitySlot.findMany({
      where: { createdByUserId: seed.actorUserId },
      orderBy: [{ startsAt: "asc" }, { endsAt: "asc" }],
      select: { startsAt: true, endsAt: true, status: true },
    });
    // Simuluje úspěšný zápis, jehož odpověď se klientovi ztratila, a následný retry.
    const retryAfterLostResponse = await applyAvailabilitySelection("owner", input);
    const slotsAfterLostResponseRetry = await prisma.availabilitySlot.findMany({
      where: { createdByUserId: seed.actorUserId },
      orderBy: [{ startsAt: "asc" }, { endsAt: "asc" }],
      select: { startsAt: true, endsAt: true, status: true },
    });

    assert.deepEqual(concurrentRetry, first);
    assert.deepEqual(retryAfterLostResponse, first);
    assert.deepEqual(slotsAfterLostResponseRetry, slotsAfterConcurrentRetry);
    assert.equal(await prisma.availabilityOperation.count({ where: { operationId } }), 1);
    assert.equal(await prisma.availabilityAuditEvent.count({ where: { operationId } }), 1);
  } finally {
    await cleanupSeed(seed);
  }
});

dbTest("undo má vlastní operationId a auditní vazbu na původní operaci", async () => {
  const seed = await createSeed();
  const { prisma, applyAvailabilitySelection } = await loadModules();
  const originalOperationId = randomUUID();
  const undoOperationId = randomUUID();

  try {
    await applyAvailabilitySelection("owner", {
      weekKey: seed.weekKey, dateKey: seed.dateKey, startCell: 16, endCell: 18,
      mode: "add", operationId: originalOperationId, actorUserId: seed.actorUserId,
    });
    const undo = await applyAvailabilitySelection("owner", {
      weekKey: seed.weekKey, dateKey: seed.dateKey, startCell: 16, endCell: 18,
      mode: "remove", operationId: undoOperationId, revertedOperationId: originalOperationId,
      actorUserId: seed.actorUserId,
    });
    const undoAudit = await prisma.availabilityAuditEvent.findFirstOrThrow({ where: { operationId: undoOperationId } });

    assert.notEqual(undo.operationId, originalOperationId);
    assert.equal(undoAudit.operation, "UNDO");
    assert.equal(undoAudit.revertedOperationId, originalOperationId);
    assert.equal(await prisma.availabilityOperation.count({ where: { operationId: { in: [originalOperationId, undoOperationId] } } }), 2);
  } finally {
    await cleanupSeed(seed);
  }
});

dbTest("applyAvailabilitySelection upraví volné fragmenty dlouhého slotu kolem rezervace", async () => {
  const cases = [
    { startCell: 4, endCell: 5, expected: [[5, 6], [8, 16]] },
    { startCell: 8, endCell: 9, expected: [[4, 6], [9, 16]] },
  ];

  for (const testCase of cases) {
    const seed = await createSeed();
    const { prisma, applyAvailabilitySelection } = await loadModules();

    try {
      const fullRange = await loadModules().then(({ getCellRangeBounds }) => getCellRangeBounds(seed.dateKey, 4, 16));
      await prisma.availabilitySlot.update({
        where: { id: seed.bookedSlotId },
        data: {
          status: AvailabilitySlotStatus.ARCHIVED,
          startsAt: fullRange.startsAt,
          endsAt: fullRange.endsAt,
        },
      });
      await prisma.availabilitySlot.deleteMany({
        where: { createdByUserId: seed.actorUserId, id: { not: seed.bookedSlotId } },
      });

      await applyAvailabilitySelection("owner", {
        weekKey: seed.weekKey,
        dateKey: seed.dateKey,
        startCell: testCase.startCell,
        endCell: testCase.endCell,
        mode: "remove",
        operationId: randomUUID(),
        actorUserId: seed.actorUserId,
      });

      const week = await (await loadModules()).getAdminPlannerWeek("owner", seed.weekKey);
      const day = week.days.find((item) => item.dateKey === seed.dateKey);
      assert.deepEqual(
        day?.availableIntervals.map((interval) => [interval.startCell, interval.endCell]),
        testCase.expected,
      );
      assert.ok(
        !day?.cells.inactive.slice(4, 16).some(Boolean),
        "archivovaný původní slot nesmí překrýt nové volné fragmenty v planneru",
      );

      const [booking, historicalSlot] = await Promise.all([
        prisma.booking.findUniqueOrThrow({ where: { id: seed.bookingId }, select: { slotId: true, status: true } }),
        prisma.availabilitySlot.findUniqueOrThrow({ where: { id: seed.bookedSlotId }, select: { status: true } }),
      ]);
      assert.equal(booking.slotId, seed.bookedSlotId);
      assert.equal(booking.status, BookingStatus.CONFIRMED);
      assert.equal(historicalSlot.status, AvailabilitySlotStatus.ARCHIVED);
    } finally {
      await cleanupSeed(seed);
    }
  }
});

dbTest("applyAvailabilitySelection odmítne zásah do rezervovaného intervalu a den mimo týden", async () => {
  const seed = await createSeed();
  const { applyAvailabilitySelection } = await loadModules();

  try {
    await assert.rejects(
      applyAvailabilitySelection("owner", {
        weekKey: seed.weekKey,
        dateKey: seed.dateKey,
        startCell: 6,
        endCell: 7,
        mode: "remove",
        operationId: randomUUID(),
        actorUserId: seed.actorUserId,
      }),
      /zasahuje do rezervace nebo omezeného intervalu/,
    );
    await assert.rejects(
      applyAvailabilitySelection("owner", {
        weekKey: seed.weekKey,
        dateKey: "2026-01-01",
        startCell: 4,
        endCell: 5,
        mode: "add",
        operationId: randomUUID(),
        actorUserId: seed.actorUserId,
      }),
      /nepatří do platného týdne/,
    );
  } finally {
    await cleanupSeed(seed);
  }
});

dbTest("undo přes opačnou serverovou operaci odmítne rezervaci vytvořenou po původní změně", async () => {
  const seed = await createSeed();
  const { prisma, applyAvailabilitySelection, getAdminPlannerWeek, getCellRangeBounds } = await loadModules();
  let concurrentBookingId: string | null = null;

  try {
    await getAdminPlannerWeek("owner", seed.weekKey);
    const range = getCellRangeBounds(seed.dateKey, 8, 10);
    const [slot, service, client] = await Promise.all([
      prisma.availabilitySlot.findFirstOrThrow({
        where: { createdByUserId: seed.actorUserId, startsAt: range.startsAt, endsAt: { gte: range.endsAt } },
        select: { id: true },
      }),
      prisma.service.findUniqueOrThrow({ where: { id: seed.serviceId }, select: { name: true, durationMinutes: true } }),
      prisma.client.findUniqueOrThrow({ where: { id: seed.clientId }, select: { fullName: true, email: true, phone: true } }),
    ]);
    const booking = await prisma.booking.create({
      data: {
        clientId: seed.clientId,
        slotId: slot.id,
        serviceId: seed.serviceId,
        source: BookingSource.PHONE,
        isManual: true,
        status: BookingStatus.CONFIRMED,
        clientNameSnapshot: client.fullName,
        clientEmailSnapshot: client.email ?? "planner-client@example.com",
        clientPhoneSnapshot: client.phone,
        serviceNameSnapshot: service.name,
        serviceDurationMinutes: service.durationMinutes,
        scheduledStartsAt: range.startsAt,
        scheduledEndsAt: range.endsAt,
        confirmedAt: new Date(),
        createdByUserId: seed.actorUserId,
      },
      select: { id: true },
    });
    concurrentBookingId = booking.id;

    await assert.rejects(
      applyAvailabilitySelection("owner", {
        weekKey: seed.weekKey,
        dateKey: seed.dateKey,
        startCell: 8,
        endCell: 9,
        mode: "remove",
        operationId: randomUUID(),
        actorUserId: seed.actorUserId,
      }),
      /zasahuje do rezervace nebo omezeného intervalu/,
    );
  } finally {
    if (concurrentBookingId) {
      await prisma.booking.delete({ where: { id: concurrentBookingId } });
    }
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

  await prisma.availabilityAuditEvent.deleteMany({ where: { actorUserId: seed.actorUserId } });
  await prisma.booking.deleteMany({ where: { id: seed.bookingId } });
  await prisma.availabilitySlot.deleteMany({ where: { createdByUserId: seed.actorUserId } });
  await prisma.client.deleteMany({ where: { id: seed.clientId } });
  await prisma.service.deleteMany({ where: { id: seed.serviceId } });
  await prisma.serviceCategory.deleteMany({ where: { id: seed.categoryId } });
  await prisma.adminUser.deleteMany({ where: { id: seed.actorUserId } });
}

dbTest("applyAvailabilitySelection dovolí čtvrthodinový začátek přímo po úklidu", async () => {
  const seed = await createSeed();
  const { prisma, applyAvailabilitySelection, getCellRangeBounds } = await loadModules();

  try {
    const originalBooking = await prisma.booking.findUniqueOrThrow({
      where: { id: seed.bookingId },
      select: { scheduledEndsAt: true },
    });
    const cleanupEnd = new Date(originalBooking.scheduledEndsAt.getTime() + 15 * 60 * 1000);
    const trailingAvailability = getCellRangeBounds(seed.dateKey, 8, 16);

    await prisma.booking.update({
      where: { id: seed.bookingId },
      data: { cleanupMinutes: 15, cleanupBlockMinutes: 15, blockedUntil: cleanupEnd },
    });
    await prisma.availabilitySlot.deleteMany({
      where: {
        createdByUserId: seed.actorUserId,
        startsAt: trailingAvailability.startsAt,
        endsAt: trailingAvailability.endsAt,
      },
    });

    await applyAvailabilitySelection("owner", {
      weekKey: seed.weekKey,
      dateKey: seed.dateKey,
      startCell: 8.5,
      endCell: 10.5,
      mode: "add",
      operationId: randomUUID(),
      actorUserId: seed.actorUserId,
    });

    const addedSlot = await prisma.availabilitySlot.findFirstOrThrow({
      where: { createdByUserId: seed.actorUserId, startsAt: cleanupEnd },
      select: { startsAt: true, endsAt: true },
    });
    assert.equal(addedSlot.startsAt.getTime(), cleanupEnd.getTime());
    assert.equal(addedSlot.endsAt.getTime() - addedSlot.startsAt.getTime(), 60 * 60 * 1000);

    await applyAvailabilitySelection("owner", {
      weekKey: seed.weekKey,
      dateKey: seed.dateKey,
      startCell: 8.5,
      endCell: 10.5,
      mode: "remove",
      operationId: randomUUID(),
      actorUserId: seed.actorUserId,
    });
    assert.equal(await prisma.availabilitySlot.count({ where: { createdByUserId: seed.actorUserId, startsAt: cleanupEnd } }), 0);
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

dbTest("getAdminPlannerWeek ponechá zbytek slotu po rezervaci bez úklidu jako volný", async () => {
  const seed = await createSeed();
  const { prisma, getAdminPlannerWeek, getCellRangeBounds } = await loadModules();

  try {
    const afterRange = getCellRangeBounds(seed.dateKey, 8, 16);
    const extendedEnd = getCellRangeBounds(seed.dateKey, 10, 10).endsAt;
    await prisma.availabilitySlot.deleteMany({
      where: {
        createdByUserId: seed.actorUserId,
        startsAt: afterRange.startsAt,
        endsAt: afterRange.endsAt,
      },
    });
    await prisma.availabilitySlot.update({
      where: { id: seed.bookedSlotId },
      data: { endsAt: extendedEnd },
    });

    const week = await getAdminPlannerWeek("owner", seed.weekKey);
    const day = week.days.find((item) => item.dateKey === seed.dateKey);

    assert.ok(day);
    assert.ok(
      day.availableBlocks.some((block) => block.startMinutes === 240 && block.endMinutes === 300),
      "čas po skončení rezervace má zůstat volný",
    );
    assert.ok(
      !day.lockedBlocks.some((block) => block.startMinutes === 240 && block.endMinutes === 300),
      "čas po skončení rezervace nesmí být jen kvůli slotu chráněný",
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
