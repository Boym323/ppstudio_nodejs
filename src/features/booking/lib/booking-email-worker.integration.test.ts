import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  BookingSource,
  BookingStatus,
  EmailLogStatus,
  EmailLogType,
} from "@/generated/prisma/browser";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "change-me-owner";
process.env.ADMIN_STAFF_EMAIL ??= "staff@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "change-me-staff";
process.env.EMAIL_DELIVERY_MODE ??= "log";
process.env.PUSHOVER_ENABLED ??= "false";

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

async function loadModules() {
  const [{ prisma }, bookingModule, workerModule, deliveryModule] = await Promise.all([
    import("@/lib/prisma"),
    import("./booking-public"),
    import("@/lib/email/worker"),
    import("@/lib/email/delivery"),
  ]);

  return {
    prisma,
    createManualBooking: bookingModule.createManualBooking,
    runEmailDeliveryWorkerOnce: workerModule.runEmailDeliveryWorkerOnce,
    runBookingReminderSchedulerOnce: workerModule.runBookingReminderSchedulerOnce,
    claimEmailLogForImmediateDelivery: deliveryModule.claimEmailLogForImmediateDelivery,
    deliverEmailLog: deliveryModule.deliverEmailLog,
  };
}

async function createPendingConfirmationEmailLog(seed: string) {
  const { prisma } = await loadModules();

  return prisma.emailLog.create({
    data: {
      type: EmailLogType.BOOKING_RECEIVED,
      status: EmailLogStatus.PENDING,
      recipientEmail: `delivery-${seed}@example.com`,
      subject: "Rezervace přijata",
      templateKey: "booking-confirmation-v1",
      payload: {
        bookingId: `delivery-${seed}`,
        serviceName: "Testovací služba",
        clientName: "Testovací klientka",
        scheduledStartsAt: "2026-08-17T10:00:00.000Z",
        scheduledEndsAt: "2026-08-17T11:00:00.000Z",
      },
    },
  });
}

function addMinutes(base: Date, minutes: number) {
  return new Date(base.getTime() + minutes * 60 * 1000);
}

async function findIsolatedWorkerWindow(
  prisma: Awaited<ReturnType<typeof loadModules>>["prisma"],
  seed: string,
  durationMinutes: number,
) {
  const daySeed = Number.parseInt(seed.slice(0, 4), 16);
  const hourSeed = Number.parseInt(seed.slice(4, 6), 16);
  const minuteSeed = Number.parseInt(seed.slice(6, 8), 16);
  const hourCandidates = [18, 19, 20, 21].map((hour, index, list) => list[(index + hourSeed) % list.length] ?? hour);
  const minuteCandidates = [0, 15, 30, 45].map(
    (minute, index, list) => list[(index + minuteSeed) % list.length] ?? minute,
  );

  for (let dayStep = 0; dayStep < 45; dayStep += 1) {
    const dayOffset = 14 + ((daySeed + dayStep) % 45);

    for (const hour of hourCandidates) {
      for (const minute of minuteCandidates) {
        const startsAt = new Date();
        startsAt.setUTCSeconds(0, 0);
        startsAt.setUTCDate(startsAt.getUTCDate() + dayOffset);
        startsAt.setUTCHours(hour, minute, 0, 0);
        const endsAt = addMinutes(startsAt, durationMinutes);

        const [overlappingSlots, overlappingBookings] = await Promise.all([
          prisma.availabilitySlot.count({
            where: {
              startsAt: { lt: endsAt },
              endsAt: { gt: startsAt },
            },
          }),
          prisma.booking.count({
            where: {
              status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
              scheduledStartsAt: { lt: endsAt },
              OR: [
                { blockedUntil: { gt: startsAt } },
                { blockedUntil: null, scheduledEndsAt: { gt: startsAt } },
              ],
            },
          }),
        ]);

        if (overlappingSlots === 0 && overlappingBookings === 0) {
          return {
            startsAt,
            endsAt,
            reminderScanAt: addMinutes(startsAt, -(25 * 60 + 30)),
          };
        }
      }
    }
  }

  throw new Error("Nepodařilo se najít izolované okno pro worker integrační test.");
}

async function createConfirmedManualBooking(seed: string, startsAt: Date) {
  const { prisma, createManualBooking } = await loadModules();
  const endsAt = addMinutes(startsAt, 60);
  const phone = `+4207${String(Number.parseInt(seed, 16) % 100_000_000).padStart(8, "0")}`;

  const category = await prisma.serviceCategory.create({
    data: {
      name: `Worker category ${seed}`,
      slug: `worker-category-${seed}`,
      isActive: true,
    },
    select: { id: true },
  });

  const service = await prisma.service.create({
    data: {
      categoryId: category.id,
      name: `Worker service ${seed}`,
      slug: `worker-service-${seed}`,
      durationMinutes: 60,
      priceFromCzk: 1350,
      isActive: true,
      isPubliclyBookable: true,
    },
    select: { id: true },
  });

  let result;

  try {
    result = await createManualBooking({
      serviceId: service.id,
      allowManualOverride: true,
      startsAt: startsAt.toISOString(),
      fullName: `Worker klientka ${seed}`,
      email: `worker-${seed}@example.com`,
      phone,
      source: BookingSource.PHONE,
      status: BookingStatus.CONFIRMED,
      actorUserId: null,
      sendClientEmail: false,
      includeCalendarAttachment: false,
    });
  } catch (error) {
    await prisma.service.deleteMany({ where: { id: service.id } });
    await prisma.serviceCategory.deleteMany({ where: { id: category.id } });
    throw error;
  }

  return {
    bookingId: result.bookingId,
    categoryId: category.id,
    serviceId: service.id,
    slotId: await prisma.booking.findUniqueOrThrow({
      where: { id: result.bookingId },
      select: { slotId: true },
    }).then((booking) => booking.slotId),
    startsAt,
    endsAt,
    email: `worker-${seed}@example.com`,
  };
}

async function cleanupBookingFixture({
  bookingId,
  serviceId,
  categoryId,
  slotId,
  email,
}: {
  bookingId: string;
  serviceId: string;
  categoryId: string;
  slotId: string;
  email: string;
}) {
  const { prisma } = await loadModules();

  await prisma.bookingActionToken.deleteMany({
    where: { bookingId },
  });
  await prisma.emailLog.deleteMany({
    where: { bookingId },
  });
  await prisma.bookingStatusHistory.deleteMany({
    where: { bookingId },
  });
  await prisma.booking.deleteMany({
    where: { id: bookingId },
  });
  await prisma.client.deleteMany({
    where: { email },
  });
  await prisma.availabilitySlot.deleteMany({
    where: {
      id: slotId,
    },
  });
  await prisma.service.deleteMany({
    where: { id: serviceId },
  });
  await prisma.serviceCategory.deleteMany({
    where: { id: categoryId },
  });
}

dbTest("deliverEmailLog po úspěšném Resend delivery provede reconciliation a vrátí sent", async () => {
  const seed = randomUUID();
  const {
    prisma,
    claimEmailLogForImmediateDelivery,
    deliverEmailLog,
  } = await loadModules();
  const emailLog = await createPendingConfirmationEmailLog(seed);
  const processingToken = await claimEmailLogForImmediateDelivery(emailLog.id);
  const reconciledMessageIds: string[] = [];

  assert.ok(processingToken);
  try {
    const result = await deliverEmailLog(emailLog.id, processingToken, {
      sendEmail: async () => ({ provider: "resend", messageId: `resend-${seed}` }),
      reconcileUnmatchedResendWebhookEvents: async (messageId) => {
        reconciledMessageIds.push(messageId);
        return { reconciled: 0, candidates: 0 };
      },
    });
    const stored = await prisma.emailLog.findUniqueOrThrow({ where: { id: emailLog.id } });

    assert.deepEqual(result, { status: "sent" });
    assert.deepEqual(reconciledMessageIds, [`resend-${seed}`]);
    assert.equal(stored.status, EmailLogStatus.SENT);
    assert.equal(stored.providerMessageId, `resend-${seed}`);
  } finally {
    await prisma.emailLog.deleteMany({ where: { id: emailLog.id } });
  }
});

dbTest("deliverEmailLog zachová SENT a neaktivuje retry, když reconciliation po Resend delivery selže", async () => {
  const seed = randomUUID();
  const {
    prisma,
    claimEmailLogForImmediateDelivery,
    deliverEmailLog,
  } = await loadModules();
  const emailLog = await createPendingConfirmationEmailLog(seed);
  const processingToken = await claimEmailLogForImmediateDelivery(emailLog.id);
  const originalConsoleError = console.error;
  const logs: unknown[][] = [];

  assert.ok(processingToken);
  console.error = (...args: unknown[]) => logs.push(args);

  try {
    const result = await deliverEmailLog(emailLog.id, processingToken, {
      sendEmail: async () => ({ provider: "resend", messageId: `resend-${seed}` }),
      reconcileUnmatchedResendWebhookEvents: async () => {
        throw new Error("simulated reconciliation failure");
      },
    });
    const stored = await prisma.emailLog.findUniqueOrThrow({ where: { id: emailLog.id } });

    assert.deepEqual(result, { status: "sent" });
    assert.equal(stored.status, EmailLogStatus.SENT);
    assert.equal(stored.processingToken, null);
    assert.equal(stored.errorMessage, null);
    assert.equal(stored.attemptCount, 1);
    assert.deepEqual(logs, [[
      "Resend webhook reconciliation failed after successful delivery",
      {
        emailLogId: emailLog.id,
        providerMessageId: `resend-${seed}`,
        operation: "reconcile-unmatched-resend-webhook-events",
        errorName: "Error",
      },
    ]]);
  } finally {
    console.error = originalConsoleError;
    await prisma.emailLog.deleteMany({ where: { id: emailLog.id } });
  }
});

dbTest("selhání reconciliation neblokuje označení booking reminderu jako odeslaného", async () => {
  const seed = randomUUID().slice(0, 8);
  const {
    prisma,
    claimEmailLogForImmediateDelivery,
    deliverEmailLog,
  } = await loadModules();
  const window = await findIsolatedWorkerWindow(prisma, seed, 60);
  const fixture = await createConfirmedManualBooking(seed, window.startsAt);
  const emailLog = await prisma.emailLog.create({
    data: {
      bookingId: fixture.bookingId,
      type: EmailLogType.BOOKING_REMINDER,
      status: EmailLogStatus.PENDING,
      recipientEmail: fixture.email,
      subject: "Zítra se na vás těšíme v PP Studiu",
      templateKey: "booking-reminder-24h-v1",
      payload: {
        bookingId: fixture.bookingId,
        serviceName: `Worker service ${seed}`,
        clientName: `Worker klientka ${seed}`,
        scheduledStartsAt: fixture.startsAt.toISOString(),
        scheduledEndsAt: fixture.endsAt.toISOString(),
        manageReservationUrl: "https://example.com/rezervace/sprava/test-token",
        cancellationUrl: "https://example.com/rezervace/storno/test-token",
        manualReminderResend: true,
      },
    },
  });
  const processingToken = await claimEmailLogForImmediateDelivery(emailLog.id);

  assert.ok(processingToken);
  try {
    const result = await deliverEmailLog(emailLog.id, processingToken, {
      sendEmail: async () => ({ provider: "resend", messageId: `resend-${seed}` }),
      reconcileUnmatchedResendWebhookEvents: async () => {
        throw new Error("simulated reconciliation failure");
      },
    });
    const [storedEmailLog, booking] = await Promise.all([
      prisma.emailLog.findUniqueOrThrow({ where: { id: emailLog.id } }),
      prisma.booking.findUniqueOrThrow({ where: { id: fixture.bookingId } }),
    ]);

    assert.deepEqual(result, { status: "sent" });
    assert.equal(storedEmailLog.status, EmailLogStatus.SENT);
    assert.ok(booking.reminder24hSentAt);
  } finally {
    await cleanupBookingFixture(fixture);
  }
});

dbTest("selhání sendEmail před SENT zachová retry behavior delivery workeru", async () => {
  const seed = randomUUID();
  const { prisma, claimEmailLogForImmediateDelivery, deliverEmailLog } = await loadModules();
  const emailLog = await createPendingConfirmationEmailLog(seed);
  const processingToken = await claimEmailLogForImmediateDelivery(emailLog.id);

  assert.ok(processingToken);
  try {
    const result = await deliverEmailLog(emailLog.id, processingToken, {
      sendEmail: async () => {
        throw new Error("simulated transport failure");
      },
    });
    const stored = await prisma.emailLog.findUniqueOrThrow({ where: { id: emailLog.id } });

    assert.equal(result.status, "failed");
    assert.equal(result.errorMessage, "simulated transport failure");
    assert.equal(stored.status, EmailLogStatus.PENDING);
    assert.equal(stored.processingToken, null);
    assert.equal(stored.providerMessageId, null);
    assert.equal(stored.errorMessage, "simulated transport failure");
  } finally {
    await prisma.emailLog.deleteMany({ where: { id: emailLog.id } });
  }
});

dbTest("runBookingReminderSchedulerOnce logs 24h reminder for confirmed booking in reminder window", async () => {
  const seed = randomUUID().slice(0, 8);
  const { prisma, runBookingReminderSchedulerOnce } = await loadModules();
  const window = await findIsolatedWorkerWindow(prisma, seed, 60);
  const fixture = await createConfirmedManualBooking(seed, window.startsAt);

  try {
    const result = await runBookingReminderSchedulerOnce(window.reminderScanAt);

    assert.equal(result.foundBookings, 1);
    assert.equal(result.enqueued, 1);
    assert.equal(result.failed, 0);

    const [booking, emailLog] = await Promise.all([
      prisma.booking.findUniqueOrThrow({
        where: { id: fixture.bookingId },
        select: {
          reminder24hQueuedAt: true,
          reminder24hSentAt: true,
        },
      }),
      prisma.emailLog.findFirstOrThrow({
        where: {
          bookingId: fixture.bookingId,
          type: EmailLogType.BOOKING_REMINDER,
        },
        select: {
          status: true,
          payload: true,
        },
      }),
    ]);

    const payload = emailLog.payload as Record<string, unknown>;

    assert.equal(emailLog.status, EmailLogStatus.SENT);
    assert.ok(booking.reminder24hQueuedAt);
    assert.ok(booking.reminder24hSentAt);
    assert.equal(payload.serviceName, `Worker service ${seed}`);
    assert.equal(payload.scheduledStartsAt, fixture.startsAt.toISOString());
    assert.equal(payload.scheduledEndsAt, fixture.endsAt.toISOString());
    assert.match(String(payload.manageReservationUrl), /\/rezervace\/sprava\//);
    assert.match(String(payload.cancellationUrl), /\/rezervace\/storno\//);
  } finally {
    await cleanupBookingFixture(fixture);
  }
});

dbTest("runEmailDeliveryWorkerOnce delivers queued reminder email and marks booking reminder as sent", async () => {
  const seed = randomUUID().slice(0, 8);
  const { prisma, runEmailDeliveryWorkerOnce } = await loadModules();
  const window = await findIsolatedWorkerWindow(prisma, seed, 60);
  const fixture = await createConfirmedManualBooking(seed, window.startsAt);

  try {
    await prisma.emailLog.create({
      data: {
        bookingId: fixture.bookingId,
        type: EmailLogType.BOOKING_REMINDER,
        status: EmailLogStatus.PENDING,
        recipientEmail: fixture.email,
        subject: "Zítra se na vás těšíme v PP Studiu",
        templateKey: "booking-reminder-24h-v1",
        payload: {
          bookingId: fixture.bookingId,
          serviceName: `Worker service ${seed}`,
          clientName: `Worker klientka ${seed}`,
          scheduledStartsAt: fixture.startsAt.toISOString(),
          scheduledEndsAt: fixture.endsAt.toISOString(),
          manageReservationUrl: "https://example.com/rezervace/sprava/test-token",
          cancellationUrl: "https://example.com/rezervace/storno/test-token",
          manualReminderResend: true,
        },
      },
    });

    const processed = await runEmailDeliveryWorkerOnce();

    assert.equal(processed, 1);

    const [booking, emailLog] = await Promise.all([
      prisma.booking.findUniqueOrThrow({
        where: { id: fixture.bookingId },
        select: {
          reminder24hQueuedAt: true,
          reminder24hSentAt: true,
        },
      }),
      prisma.emailLog.findFirstOrThrow({
        where: {
          bookingId: fixture.bookingId,
          type: EmailLogType.BOOKING_REMINDER,
        },
        select: {
          status: true,
          provider: true,
          sentAt: true,
          errorMessage: true,
        },
      }),
    ]);

    assert.equal(emailLog.status, EmailLogStatus.SENT);
    assert.equal(emailLog.provider, "log");
    assert.ok(emailLog.sentAt);
    assert.equal(emailLog.errorMessage, null);
    assert.ok(booking.reminder24hQueuedAt);
    assert.ok(booking.reminder24hSentAt);
  } finally {
    await cleanupBookingFixture(fixture);
  }
});
