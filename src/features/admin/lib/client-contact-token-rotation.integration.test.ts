import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  AvailabilitySlotStatus,
  BookingActionTokenType,
  BookingStatus,
  EmailAudience,
  EmailLogStatus,
  EmailLogType,
} from "@/generated/prisma/browser";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.EMAIL_DELIVERY_MODE = "background";
process.env.EMAIL_TRANSPORT = "smtp";
process.env.SMTP_HOST = "smtp.example.test";
process.env.SMTP_PORT = "2525";
process.env.SMTP_USER = "test-user";
process.env.SMTP_PASSWORD = "test-password";
process.env.SMTP_FROM_EMAIL = "noreply@example.test";

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

dbTest("změna nebo odstranění e-mailu rotuje jen budoucí klientské self-service tokeny atomicky", async () => {
  const [{ prisma }, { hashBookingActionToken }, { rotateClientBookingTokensForEmailChange }] = await Promise.all([
    import("@/lib/prisma"),
    import("@/features/booking/lib/booking-action-tokens"),
    import("./client-contact-token-rotation"),
  ]);
  const suffix = randomUUID().slice(0, 8);
  const now = new Date();
  const oldEmail = `client-contact-old-${suffix}@example.test`;
  const newEmail = `client-contact-new-${suffix}@example.test`;
  const category = await prisma.serviceCategory.create({
    data: { name: `Kontakt ${suffix}`, slug: `client-contact-${suffix}` },
  });
  const service = await prisma.service.create({
    data: {
      categoryId: category.id,
      name: `Kontakt service ${suffix}`,
      slug: `client-contact-service-${suffix}`,
      durationMinutes: 60,
    },
  });
  const client = await prisma.client.create({
    data: { fullName: `Kontakt klientka ${suffix}`, email: oldEmail, phone: "+420777111222" },
  });
  const futureStarts = [addDays(now, 10), addDays(now, 20)];
  const futureBookings = [];
  const bookingIds: string[] = [];
  const slotIds: string[] = [];

  try {
    for (const [index, startsAt] of futureStarts.entries()) {
      const slot = await prisma.availabilitySlot.create({
        data: {
          startsAt,
          endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000),
          status: AvailabilitySlotStatus.PUBLISHED,
          publishedAt: addDays(now, -1),
        },
      });
      slotIds.push(slot.id);
      futureBookings.push(await prisma.booking.create({
        data: {
          clientId: client.id,
          slotId: slot.id,
          serviceId: service.id,
          status: index === 0 ? BookingStatus.PENDING : BookingStatus.CONFIRMED,
          clientNameSnapshot: client.fullName,
          clientEmailSnapshot: oldEmail,
          clientPhoneSnapshot: client.phone,
          serviceNameSnapshot: service.name,
          serviceDurationMinutes: 60,
          scheduledStartsAt: startsAt,
          scheduledEndsAt: new Date(startsAt.getTime() + 60 * 60 * 1000),
        },
      }));
      bookingIds.push(futureBookings[futureBookings.length - 1]!.id);
    }

    const historicalSlot = await prisma.availabilitySlot.create({
      data: {
        startsAt: addDays(now, -10),
        endsAt: new Date(addDays(now, -10).getTime() + 60 * 60 * 1000),
        status: AvailabilitySlotStatus.PUBLISHED,
        publishedAt: addDays(now, -11),
      },
    });
    slotIds.push(historicalSlot.id);
    const historicalBooking = await prisma.booking.create({
      data: {
        clientId: client.id,
        slotId: historicalSlot.id,
        serviceId: service.id,
        status: BookingStatus.COMPLETED,
        clientNameSnapshot: client.fullName,
        clientEmailSnapshot: oldEmail,
        clientPhoneSnapshot: client.phone,
        serviceNameSnapshot: service.name,
        serviceDurationMinutes: 60,
        scheduledStartsAt: addDays(now, -10),
        scheduledEndsAt: new Date(addDays(now, -10).getTime() + 60 * 60 * 1000),
      },
    });
    bookingIds.push(historicalBooking.id);

    const tokenRecords = new Map<string, { manage: string; cancel: string }>();
    for (const booking of [...futureBookings, historicalBooking]) {
      const manage = `manage-${booking.id}`;
      const cancel = `cancel-${booking.id}`;
      await prisma.bookingActionToken.createMany({
        data: [
          {
            bookingId: booking.id,
            type: BookingActionTokenType.RESCHEDULE,
            tokenHash: hashBookingActionToken(manage),
            expiresAt: addDays(now, 30),
          },
          {
            bookingId: booking.id,
            type: BookingActionTokenType.CANCEL,
            tokenHash: hashBookingActionToken(cancel),
            expiresAt: addDays(now, 30),
          },
        ],
      });
      tokenRecords.set(booking.id, { manage, cancel });
    }

    const pendingEmail = await prisma.emailLog.create({
      data: {
        bookingId: futureBookings[0].id,
        clientId: client.id,
        actionTokenId: await prisma.bookingActionToken.findFirstOrThrow({
          where: { bookingId: futureBookings[0].id, type: BookingActionTokenType.RESCHEDULE },
          select: { id: true },
        }).then((token) => token.id),
        type: EmailLogType.BOOKING_CONFIRMED,
        audience: EmailAudience.CLIENT,
        status: EmailLogStatus.PENDING,
        recipientEmail: oldEmail,
        subject: "Test kontakt",
        templateKey: "booking-approved-v1",
        payload: {
          scheduledStartsAt: futureBookings[0].scheduledStartsAt.toISOString(),
          scheduledEndsAt: futureBookings[0].scheduledEndsAt.toISOString(),
          oldField: "zachovat",
          manageReservationUrl: "https://example.com/old-manage",
          cancellationUrl: "https://example.com/old-cancel",
        },
      },
    });
    const currentPendingEmail = await prisma.emailLog.create({
      data: {
        bookingId: futureBookings[0].id,
        clientId: client.id,
        actionTokenId: await prisma.bookingActionToken.findFirstOrThrow({
          where: { bookingId: futureBookings[0].id, type: BookingActionTokenType.RESCHEDULE },
          select: { id: true },
        }).then((token) => token.id),
        type: EmailLogType.BOOKING_RECEIVED,
        audience: EmailAudience.CLIENT,
        status: EmailLogStatus.PENDING,
        recipientEmail: oldEmail,
        subject: "Test aktuální kontakt",
        templateKey: "booking-confirmation-v1",
        payload: {
          bookingId: futureBookings[0].id,
          serviceId: service.id,
          serviceName: service.name,
          clientName: client.fullName,
          scheduledStartsAt: futureBookings[0].scheduledStartsAt.toISOString(),
          scheduledEndsAt: futureBookings[0].scheduledEndsAt.toISOString(),
          preservedField: "zachovat",
          manageReservationUrl: "https://example.com/old-manage",
          cancellationUrl: "https://example.com/old-cancel",
        },
      },
    });

    const activeBookingIds = futureBookings.map((booking) => booking.id);

    await assert.rejects(prisma.$transaction(async (tx) => {
      await tx.client.update({ where: { id: client.id }, data: { email: newEmail } });
      await rotateClientBookingTokensForEmailChange(tx, {
        clientId: client.id,
        bookingIds: activeBookingIds,
        newEmail,
        now,
      });
      throw new Error("rollback contact update");
    }));

    assert.equal((await prisma.client.findUniqueOrThrow({ where: { id: client.id } })).email, oldEmail);
    assert.equal(
      (await prisma.bookingActionToken.findUnique({ where: { tokenHash: hashBookingActionToken(tokenRecords.get(futureBookings[0].id)!.manage) } }))?.revokedAt,
      null,
    );
    assert.equal(
      await prisma.emailLog.count({
        where: {
          bookingId: { in: activeBookingIds },
          status: EmailLogStatus.PENDING,
          recipientEmail: oldEmail,
        },
      }),
      2,
    );

    await prisma.$transaction(async (tx) => {
      await tx.client.update({ where: { id: client.id }, data: { email: newEmail } });
      await rotateClientBookingTokensForEmailChange(tx, {
        clientId: client.id,
        bookingIds: activeBookingIds,
        newEmail,
        now,
      });
    });

    const rotatedTokens = await prisma.bookingActionToken.findMany({
      where: { bookingId: { in: activeBookingIds }, type: { in: [BookingActionTokenType.RESCHEDULE, BookingActionTokenType.CANCEL] } },
      orderBy: { createdAt: "asc" },
      select: { bookingId: true, revokedAt: true },
    });
    assert.equal(rotatedTokens.length, 8);
    assert.equal(rotatedTokens.filter((token) => token.revokedAt === null).length, 4);

    const [updatedEmail, receivedEmail, approvedEmail] = await Promise.all([
      prisma.emailLog.findUniqueOrThrow({ where: { id: pendingEmail.id } }),
      prisma.emailLog.findFirstOrThrow({
        where: { bookingId: futureBookings[0].id, templateKey: "booking-confirmation-v1" },
      }),
      prisma.emailLog.findFirstOrThrow({
        where: { bookingId: futureBookings[1].id, templateKey: "booking-approved-v1" },
      }),
    ]);
    assert.equal(updatedEmail.status, EmailLogStatus.SENT);
    assert.equal(updatedEmail.provider, "system-skip");
    assert.equal(
      await prisma.emailLog.count({
        where: { bookingId: futureBookings[0].id, templateKey: "booking-confirmation-v1" },
      }),
      1,
    );
    assert.equal(receivedEmail.id, currentPendingEmail.id);
    assert.equal(receivedEmail.recipientEmail, newEmail);
    assert.equal(approvedEmail.recipientEmail, newEmail);
    const receivedPayload = receivedEmail.payload as Record<string, unknown>;
    const approvedPayload = approvedEmail.payload as Record<string, unknown>;
    assert.equal(receivedPayload.bookingId, futureBookings[0].id);
    assert.equal(receivedPayload.serviceId, service.id);
    assert.equal(receivedPayload.scheduledStartsAt, futureBookings[0].scheduledStartsAt.toISOString());
    assert.equal(receivedPayload.scheduledEndsAt, futureBookings[0].scheduledEndsAt.toISOString());
    assert.equal(receivedPayload.preservedField, undefined);
    assert.match(String(receivedPayload.manageReservationUrl), /\/rezervace\/sprava\//);
    assert.match(String(receivedPayload.cancellationUrl), /\/rezervace\/storno\//);
    assert.match(String((approvedEmail.payload as Record<string, unknown>).manageReservationUrl), /\/rezervace\/sprava\//);
    assert.equal(approvedPayload.serviceId, service.id);
    assert.equal(approvedPayload.scheduledStartsAt, futureBookings[1].scheduledStartsAt.toISOString());
    assert.equal(approvedPayload.scheduledEndsAt, futureBookings[1].scheduledEndsAt.toISOString());

    const historicalTokens = await prisma.bookingActionToken.findMany({
      where: { bookingId: historicalBooking.id },
      select: { revokedAt: true },
    });
    assert.equal(historicalTokens.length, 2);
    assert.ok(historicalTokens.every((token) => token.revokedAt === null));

    const countBeforeRemoval = await prisma.bookingActionToken.count({ where: { bookingId: { in: activeBookingIds } } });
    await prisma.$transaction(async (tx) => {
      await tx.client.update({ where: { id: client.id }, data: { email: null } });
      await rotateClientBookingTokensForEmailChange(tx, {
        clientId: client.id,
        bookingIds: activeBookingIds,
        newEmail: null,
        now: new Date(now.getTime() + 1),
      });
    });
    assert.equal(await prisma.bookingActionToken.count({ where: { bookingId: { in: activeBookingIds } } }), countBeforeRemoval);
    assert.equal(
      await prisma.bookingActionToken.count({
        where: {
          bookingId: { in: activeBookingIds },
          type: { in: [BookingActionTokenType.RESCHEDULE, BookingActionTokenType.CANCEL] },
          revokedAt: null,
        },
      }),
      0,
    );
    assert.equal(
      await prisma.emailLog.count({
        where: {
          bookingId: { in: activeBookingIds },
          status: EmailLogStatus.PENDING,
          audience: EmailAudience.CLIENT,
        },
      }),
      0,
    );
  } finally {
    await prisma.emailLog.deleteMany({ where: { clientId: client.id } });
    await prisma.bookingActionToken.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await prisma.booking.deleteMany({ where: { clientId: client.id } });
    await prisma.availabilitySlot.deleteMany({ where: { id: { in: slotIds } } });
    await prisma.client.delete({ where: { id: client.id } });
    await prisma.service.delete({ where: { id: service.id } });
    await prisma.serviceCategory.delete({ where: { id: category.id } });
  }
});

dbTest("stale pending clientské booking e-maily se při změně e-mailu nahradí aktuálním logem", async () => {
  const [
    { prisma },
    { hashBookingActionToken },
    { rotateClientBookingTokensForEmailChange },
    { claimEmailLogForImmediateDelivery, deliverEmailLog },
  ] = await Promise.all([
    import("@/lib/prisma"),
    import("@/features/booking/lib/booking-action-tokens"),
    import("./client-contact-token-rotation"),
    import("@/lib/email/delivery"),
  ]);
  const suffix = randomUUID().slice(0, 8);
  const now = new Date();
  const oldEmail = `client-contact-stale-old-${suffix}@example.test`;
  const newEmail = `client-contact-stale-new-${suffix}@example.test`;
  const category = await prisma.serviceCategory.create({
    data: { name: `Stale kontakt ${suffix}`, slug: `stale-contact-${suffix}` },
  });
  const originalService = await prisma.service.create({
    data: {
      categoryId: category.id,
      name: `Původní služba ${suffix}`,
      slug: `stale-original-${suffix}`,
      durationMinutes: 60,
    },
  });
  const sameLengthService = await prisma.service.create({
    data: {
      categoryId: category.id,
      name: `Nová služba 60 ${suffix}`,
      slug: `stale-same-length-${suffix}`,
      durationMinutes: 60,
    },
  });
  const differentLengthService = await prisma.service.create({
    data: {
      categoryId: category.id,
      name: `Nová služba 90 ${suffix}`,
      slug: `stale-different-length-${suffix}`,
      durationMinutes: 90,
    },
  });
  const client = await prisma.client.create({
    data: { fullName: `Stale klientka ${suffix}`, email: oldEmail, phone: "+420777111333" },
  });
  const fixtures = [
    { status: BookingStatus.PENDING, service: originalService, startsAt: addDays(now, 10) },
    { status: BookingStatus.CONFIRMED, service: sameLengthService, startsAt: addDays(now, 20) },
    { status: BookingStatus.CONFIRMED, service: differentLengthService, startsAt: addDays(now, 30) },
  ];
  const bookings: Array<{
    id: string;
    status: BookingStatus;
    serviceId: string;
    serviceNameSnapshot: string;
    scheduledStartsAt: Date;
    scheduledEndsAt: Date;
  }> = [];
  const slotIds: string[] = [];
  const bookingIds: string[] = [];
  const oldTokenIds: string[] = [];
  const staleLogIds: string[] = [];

  try {
    for (const fixture of fixtures) {
      const endsAt = new Date(fixture.startsAt.getTime() + fixture.service.durationMinutes * 60 * 1000);
      const slot = await prisma.availabilitySlot.create({
        data: {
          startsAt: fixture.startsAt,
          endsAt,
          status: AvailabilitySlotStatus.PUBLISHED,
          publishedAt: addDays(now, -1),
        },
      });
      slotIds.push(slot.id);
      const booking = await prisma.booking.create({
        data: {
          clientId: client.id,
          slotId: slot.id,
          serviceId: fixture.service.id,
          status: fixture.status,
          clientNameSnapshot: client.fullName,
          clientEmailSnapshot: oldEmail,
          clientPhoneSnapshot: client.phone,
          serviceNameSnapshot: fixture.service.name,
          serviceDurationMinutes: fixture.service.durationMinutes,
          scheduledStartsAt: fixture.startsAt,
          scheduledEndsAt: endsAt,
        },
      });
      bookings.push(booking);
      bookingIds.push(booking.id);

      const oldManageToken = `stale-manage-${booking.id}`;
      const oldCancelToken = `stale-cancel-${booking.id}`;
      const oldTokens = await prisma.bookingActionToken.createManyAndReturn({
        data: [
          {
            bookingId: booking.id,
            type: BookingActionTokenType.RESCHEDULE,
            tokenHash: hashBookingActionToken(oldManageToken),
            expiresAt: addDays(now, 30),
          },
          {
            bookingId: booking.id,
            type: BookingActionTokenType.CANCEL,
            tokenHash: hashBookingActionToken(oldCancelToken),
            expiresAt: addDays(now, 30),
          },
        ],
        select: { id: true },
      });
      oldTokenIds.push(...oldTokens.map((token) => token.id));

      const staleStartsAt = new Date(fixture.startsAt.getTime() - 60 * 60 * 1000);
      const staleEndsAt = new Date(staleStartsAt.getTime() + 60 * 60 * 1000);
      const staleEmail = await prisma.emailLog.create({
        data: {
          bookingId: booking.id,
          clientId: client.id,
          actionTokenId: oldTokens[0]!.id,
          type: fixture.status === BookingStatus.PENDING
            ? EmailLogType.BOOKING_RECEIVED
            : EmailLogType.BOOKING_CONFIRMED,
          audience: EmailAudience.CLIENT,
          status: EmailLogStatus.PENDING,
          recipientEmail: oldEmail,
          subject: "Zastaralý kontakt",
          templateKey: fixture.status === BookingStatus.PENDING
            ? "booking-confirmation-v1"
            : "booking-approved-v1",
          payload: {
            bookingId: booking.id,
            serviceId: originalService.id,
            serviceName: originalService.name,
            clientName: client.fullName,
            scheduledStartsAt: staleStartsAt.toISOString(),
            scheduledEndsAt: staleEndsAt.toISOString(),
            manageReservationUrl: "https://example.com/old-manage",
            cancellationUrl: "https://example.com/old-cancel",
          },
        },
      });
      staleLogIds.push(staleEmail.id);
    }

    await assert.rejects(prisma.$transaction(async (tx) => {
      await tx.client.update({ where: { id: client.id }, data: { email: newEmail } });
      await rotateClientBookingTokensForEmailChange(tx, {
        clientId: client.id,
        bookingIds,
        newEmail,
        now,
      });
      throw new Error("rollback stale contact update");
    }));
    assert.equal(
      await prisma.emailLog.count({ where: { id: { in: staleLogIds }, status: EmailLogStatus.PENDING } }),
      staleLogIds.length,
    );
    assert.equal(
      await prisma.bookingActionToken.count({ where: { id: { in: oldTokenIds }, revokedAt: null } }),
      oldTokenIds.length,
    );

    await prisma.$transaction(async (tx) => {
      await tx.client.update({ where: { id: client.id }, data: { email: newEmail } });
      await rotateClientBookingTokensForEmailChange(tx, {
        clientId: client.id,
        bookingIds,
        newEmail,
        now,
      });
    });

    const oldLogs = await prisma.emailLog.findMany({
      where: { id: { in: staleLogIds } },
      select: { status: true, provider: true, payload: true },
    });
    assert.ok(oldLogs.every((log) => log.status === EmailLogStatus.SENT && log.provider === "system-skip"));
    assert.ok(oldLogs.every((log) => (
      (log.payload as Record<string, unknown>).manageReservationUrl === "[REDACTED]"
      && (log.payload as Record<string, unknown>).cancellationUrl === "[REDACTED]"
    )));
    assert.equal(
      await prisma.bookingActionToken.count({ where: { id: { in: oldTokenIds }, revokedAt: { not: null } } }),
      oldTokenIds.length,
    );

    const replacementLogs = await prisma.emailLog.findMany({
      where: { bookingId: { in: bookingIds }, status: EmailLogStatus.PENDING, audience: EmailAudience.CLIENT },
      orderBy: { createdAt: "asc" },
    });
    assert.equal(replacementLogs.length, bookings.length);
    for (const log of replacementLogs) {
      const booking = bookings.find((candidate) => candidate.id === log.bookingId);
      assert.ok(booking);
      const payload = log.payload as Record<string, unknown>;
      assert.equal(log.recipientEmail, newEmail);
      assert.equal(payload.bookingId, booking.id);
      assert.equal(payload.serviceId, booking.serviceId);
      assert.equal(payload.scheduledStartsAt, booking.scheduledStartsAt.toISOString());
      assert.equal(payload.scheduledEndsAt, booking.scheduledEndsAt.toISOString());
      assert.match(String(payload.manageReservationUrl), /\/rezervace\/sprava\//);
      assert.match(String(payload.cancellationUrl), /\/rezervace\/storno\//);
      assert.notEqual(payload.manageReservationUrl, "https://example.com/old-manage");
      assert.notEqual(payload.cancellationUrl, "https://example.com/old-cancel");

      const manageToken = String(payload.manageReservationUrl).split("/").pop();
      const cancellationToken = String(payload.cancellationUrl).split("/").pop();
      assert.ok(manageToken);
      assert.ok(cancellationToken);
      const replacementTokens = await prisma.bookingActionToken.findMany({
        where: {
          tokenHash: {
            in: [hashBookingActionToken(manageToken), hashBookingActionToken(cancellationToken)],
          },
        },
        select: { id: true, type: true, revokedAt: true, usedAt: true, expiresAt: true },
      });
      assert.equal(replacementTokens.length, 2);
      assert.ok(replacementTokens.every((token) => (
        token.revokedAt === null
        && token.usedAt === null
        && token.expiresAt > now
      )));
      assert.equal(log.actionTokenId, replacementTokens.find((token) => token.type === BookingActionTokenType.RESCHEDULE)?.id);
    }

    for (const log of replacementLogs) {
      const processingToken = await claimEmailLogForImmediateDelivery(log.id);
      assert.ok(processingToken);
      const result = await deliverEmailLog(log.id, processingToken, {
        sendEmail: async () => ({ provider: "log", messageId: `replacement-${log.id}` }),
      });
      assert.equal(result.status, "sent");
    }
    const deliveredReplacements = await prisma.emailLog.findMany({
      where: { id: { in: replacementLogs.map((log) => log.id) } },
      select: { status: true, provider: true },
    });
    assert.ok(deliveredReplacements.every((log) => log.status === EmailLogStatus.SENT && log.provider === "log"));
  } finally {
    await prisma.emailLog.deleteMany({ where: { clientId: client.id } });
    await prisma.bookingActionToken.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await prisma.booking.deleteMany({ where: { clientId: client.id } });
    await prisma.availabilitySlot.deleteMany({ where: { id: { in: slotIds } } });
    await prisma.client.delete({ where: { id: client.id } });
    await prisma.service.deleteMany({ where: { id: { in: [originalService.id, sameLengthService.id, differentLengthService.id] } } });
    await prisma.serviceCategory.delete({ where: { id: category.id } });
  }
});

dbTest("změna e-mailu zachová lifecycle neodeslaného 24h reminderu", async () => {
  const [
    { prisma },
    { rotateClientBookingTokensForEmailChange },
    { runBookingReminderSchedulerOnce },
    { runSerializableTransaction },
  ] = await Promise.all([
    import("@/lib/prisma"),
    import("./client-contact-token-rotation"),
    import("@/lib/email/worker"),
    import("@/lib/serializable-transaction"),
  ]);
  const suffix = randomUUID().slice(0, 8);
  const now = new Date();
  const category = await prisma.serviceCategory.create({
    data: { name: `Reminder kontakt ${suffix}`, slug: `reminder-contact-${suffix}` },
  });
  const service = await prisma.service.create({
    data: {
      categoryId: category.id,
      name: `Reminder service ${suffix}`,
      slug: `reminder-contact-service-${suffix}`,
      durationMinutes: 60,
    },
  });
  const bookingIds: string[] = [];
  const slotIds: string[] = [];
  const clientIds: string[] = [];

  const createFixture = async (label: string, hoursFromNow: number, sent = false) => {
    const oldEmail = `reminder-${label}-old-${suffix}@example.test`;
    const client = await prisma.client.create({
      data: { fullName: `Reminder ${label} ${suffix}`, email: oldEmail },
    });
    const startsAt = new Date(now.getTime() + hoursFromNow * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
    const slot = await prisma.availabilitySlot.create({
      data: {
        startsAt,
        endsAt,
        status: AvailabilitySlotStatus.PUBLISHED,
        publishedAt: new Date(now.getTime() - 60 * 60 * 1000),
      },
    });
    const queuedAt = new Date(now.getTime() - 60 * 1000);
    const booking = await prisma.booking.create({
      data: {
        clientId: client.id,
        slotId: slot.id,
        serviceId: service.id,
        status: BookingStatus.CONFIRMED,
        clientNameSnapshot: client.fullName,
        clientEmailSnapshot: oldEmail,
        serviceNameSnapshot: service.name,
        serviceDurationMinutes: 60,
        scheduledStartsAt: startsAt,
        scheduledEndsAt: endsAt,
        reminder24hQueuedAt: queuedAt,
        reminder24hSentAt: sent ? queuedAt : null,
      },
    });
    await prisma.emailLog.create({
      data: {
        bookingId: booking.id,
        clientId: client.id,
        type: EmailLogType.BOOKING_REMINDER,
        audience: EmailAudience.CLIENT,
        status: sent ? EmailLogStatus.SENT : EmailLogStatus.PENDING,
        recipientEmail: oldEmail,
        subject: "Zítra se na vás těšíme v PP Studiu",
        templateKey: "booking-reminder-24h-v1",
        payload: {
          bookingId: booking.id,
          serviceId: service.id,
          serviceName: service.name,
          clientName: client.fullName,
          scheduledStartsAt: startsAt.toISOString(),
          scheduledEndsAt: endsAt.toISOString(),
        },
        sentAt: sent ? queuedAt : null,
      },
    });
    bookingIds.push(booking.id);
    slotIds.push(slot.id);
    clientIds.push(client.id);
    return { booking, client, oldEmail, startsAt, endsAt };
  };

  const rotate = async (
    fixture: Awaited<ReturnType<typeof createFixture>>,
    newEmail: string | null,
    transactionNow = now,
  ) => runSerializableTransaction(async (tx) => {
    await tx.client.update({ where: { id: fixture.client.id }, data: { email: newEmail } });
    await tx.booking.update({
      where: { id: fixture.booking.id },
      data: { clientEmailSnapshot: newEmail ?? "" },
    });
    await rotateClientBookingTokensForEmailChange(tx, {
      clientId: fixture.client.id,
      bookingIds: [fixture.booking.id],
      newEmail,
      now: transactionNow,
    });
  });

  try {
    const before = await createFixture("before", 30);
    await rotate(before, `reminder-before-new-${suffix}@example.test`);
    assert.equal((await prisma.booking.findUniqueOrThrow({ where: { id: before.booking.id } })).reminder24hQueuedAt, null);
    assert.equal(
      await prisma.emailLog.count({ where: { bookingId: before.booking.id, type: EmailLogType.BOOKING_REMINDER, status: EmailLogStatus.PENDING } }),
      0,
    );
    await runBookingReminderSchedulerOnce(new Date(now.getTime() + 4 * 60 * 60 * 1000));
    const beforeReminder = await prisma.emailLog.findFirstOrThrow({
      where: { bookingId: before.booking.id, type: EmailLogType.BOOKING_REMINDER, status: EmailLogStatus.PENDING },
    });
    assert.equal(beforeReminder.recipientEmail, `reminder-before-new-${suffix}@example.test`);

    const inside = await createFixture("inside", 25.5);
    const insideEmail = `reminder-inside-new-${suffix}@example.test`;
    await rotate(inside, insideEmail);
    assert.ok((await prisma.booking.findUniqueOrThrow({ where: { id: inside.booking.id } })).reminder24hQueuedAt);
    await runBookingReminderSchedulerOnce(now);
    const insideReminder = await prisma.emailLog.findFirstOrThrow({
      where: { bookingId: inside.booking.id, type: EmailLogType.BOOKING_REMINDER, status: EmailLogStatus.PENDING },
    });
    assert.equal(insideReminder.recipientEmail, insideEmail);

    const after = await createFixture("after", 20);
    const afterEmail = `reminder-after-new-${suffix}@example.test`;
    await rotate(after, afterEmail);
    const afterLogs = await prisma.emailLog.findMany({
      where: { bookingId: after.booking.id, type: EmailLogType.BOOKING_REMINDER },
      orderBy: { createdAt: "asc" },
    });
    assert.equal(afterLogs.length, 1);
    const replacement = afterLogs[0]!;
    assert.equal(replacement.status, EmailLogStatus.PENDING);
    assert.equal(replacement.recipientEmail, afterEmail);
    const replacementPayload = replacement.payload as Record<string, unknown>;
    assert.equal(replacementPayload.bookingId, after.booking.id);
    assert.equal(replacementPayload.serviceId, service.id);
    assert.equal(replacementPayload.scheduledStartsAt, after.startsAt.toISOString());
    assert.equal(replacementPayload.scheduledEndsAt, after.endsAt.toISOString());
    assert.match(String(replacementPayload.manageReservationUrl), /\/rezervace\/sprava\//);
    assert.match(String(replacementPayload.cancellationUrl), /\/rezervace\/storno\//);
    assert.equal((await prisma.booking.findUniqueOrThrow({ where: { id: after.booking.id } })).clientEmailSnapshot, afterEmail);
    assert.ok((await prisma.booking.findUniqueOrThrow({ where: { id: after.booking.id } })).reminder24hQueuedAt);

    const removed = await createFixture("removed", 20);
    await rotate(removed, null);
    const removedBooking = await prisma.booking.findUniqueOrThrow({ where: { id: removed.booking.id } });
    assert.equal(removedBooking.reminder24hQueuedAt, null);
    assert.equal(
      await prisma.emailLog.count({ where: { bookingId: removed.booking.id, status: EmailLogStatus.PENDING, audience: EmailAudience.CLIENT } }),
      0,
    );
    assert.equal(
      await prisma.emailLog.count({ where: { bookingId: removed.booking.id, recipientEmail: "" } }),
      0,
    );

    const alreadySent = await createFixture("sent", 20, true);
    const sentBefore = await prisma.emailLog.count({ where: { bookingId: alreadySent.booking.id, type: EmailLogType.BOOKING_REMINDER } });
    await rotate(alreadySent, `reminder-sent-new-${suffix}@example.test`);
    assert.equal(
      await prisma.emailLog.count({ where: { bookingId: alreadySent.booking.id, type: EmailLogType.BOOKING_REMINDER } }),
      sentBefore,
    );
    assert.ok((await prisma.booking.findUniqueOrThrow({ where: { id: alreadySent.booking.id } })).reminder24hSentAt);

    const rapid = await createFixture("rapid", 20);
    const rapidB = `reminder-rapid-b-${suffix}@example.test`;
    const rapidC = `reminder-rapid-c-${suffix}@example.test`;
    await rotate(rapid, rapidB);
    await rotate(rapid, rapidC);
    await rotate(rapid, rapidC);
    const rapidPending = await prisma.emailLog.findMany({
      where: { bookingId: rapid.booking.id, type: EmailLogType.BOOKING_REMINDER, status: EmailLogStatus.PENDING },
    });
    assert.equal(rapidPending.length, 1);
    assert.equal(rapidPending[0]?.recipientEmail, rapidC);
    assert.equal(
      await prisma.emailLog.count({ where: { bookingId: rapid.booking.id, provider: "system-skip" } }),
      0,
    );

    const rollback = await createFixture("rollback", 30);
    const rollbackEmail = `reminder-rollback-new-${suffix}@example.test`;
    await assert.rejects(prisma.$transaction(async (tx) => {
      await tx.client.update({ where: { id: rollback.client.id }, data: { email: rollbackEmail } });
      await tx.booking.update({ where: { id: rollback.booking.id }, data: { clientEmailSnapshot: rollbackEmail } });
      await rotateClientBookingTokensForEmailChange(tx, {
        clientId: rollback.client.id,
        bookingIds: [rollback.booking.id],
        newEmail: rollbackEmail,
        now,
      });
      throw new Error("rollback reminder rotation");
    }));
    const rollbackBooking = await prisma.booking.findUniqueOrThrow({ where: { id: rollback.booking.id } });
    assert.equal(rollbackBooking.clientEmailSnapshot, rollback.oldEmail);
    assert.ok(rollbackBooking.reminder24hQueuedAt);
    assert.equal(
      await prisma.emailLog.count({ where: { bookingId: rollback.booking.id, status: EmailLogStatus.PENDING } }),
      1,
    );
  } finally {
    await prisma.emailLog.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await prisma.bookingActionToken.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
    await prisma.availabilitySlot.deleteMany({ where: { id: { in: slotIds } } });
    await prisma.client.deleteMany({ where: { id: { in: clientIds } } });
    await prisma.service.delete({ where: { id: service.id } });
    await prisma.serviceCategory.delete({ where: { id: category.id } });
  }
});
