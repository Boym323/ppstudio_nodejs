import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

process.env.NODE_ENV = "test";
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

async function loadModules() {
  const [{ prisma }, bookingModule, clientModule] = await Promise.all([
    import("@/lib/prisma"),
    import("./booking-rescheduling"),
    import("@prisma/client"),
  ]);

  return {
    prisma,
    rescheduleBooking: bookingModule.rescheduleBooking,
    BookingRescheduleError: bookingModule.BookingRescheduleError,
    BookingStatus: clientModule.BookingStatus,
    AvailabilitySlotStatus: clientModule.AvailabilitySlotStatus,
    EmailLogType: clientModule.EmailLogType,
  };
}

async function createSeed() {
  const { prisma, BookingStatus, AvailabilitySlotStatus } = await loadModules();
  const suffix = randomUUID().slice(0, 8);
  const offsetDays = Math.floor(Math.random() * 90);
  const oldStartAt = new Date(Date.UTC(2026, 4, 10 + offsetDays, 8, 0, 0));
  const oldEndAt = new Date(Date.UTC(2026, 4, 10 + offsetDays, 9, 0, 0));
  const newStartAt = new Date(Date.UTC(2026, 4, 11 + offsetDays, 10, 0, 0));
  const newEndAt = new Date(Date.UTC(2026, 4, 11 + offsetDays, 11, 30, 0));
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

dbTest("rescheduleBooking updates the existing booking, writes audit history and resets reminders", async () => {
  const seed = await createSeed();
  const { prisma, rescheduleBooking, EmailLogType } = await loadModules();

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
      },
      orderBy: { createdAt: "desc" },
      select: {
        type: true,
        templateKey: true,
        subject: true,
        payload: true,
      },
    });

    assert.equal(emailLog.type, EmailLogType.BOOKING_RESCHEDULED);
    assert.equal(emailLog.templateKey, "booking-rescheduled-v1");
    assert.match(emailLog.subject, /Změna termínu rezervace/);

    const oldSlotStillExists = await prisma.availabilitySlot.findUnique({
      where: { id: seed.oldSlotId },
      select: { id: true },
    });

    assert.equal(oldSlotStillExists, null);
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
