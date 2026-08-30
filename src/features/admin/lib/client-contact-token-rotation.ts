import {
  BookingActionTokenType,
  BookingStatus,
  EmailAudience,
  EmailLogStatus,
  EmailLogType,
  Prisma,
} from "@/generated/prisma/client";

import { env } from "@/config/env";
import { issueBookingClientActionTokens } from "@/features/booking/lib/booking-action-tokens";
import { normalizeClientEmail } from "@/features/booking/lib/booking-public";
import {
  enqueueBookingReminder24hForBooking,
  evaluateBookingReminderDelivery,
  getBookingReminder24hEnqueueWindowPosition,
} from "@/features/booking/lib/booking-reminders";
import {
  buildCanonicalClientBookingEmailPayload,
  evaluateBookingEmailPreflight,
} from "@/lib/email/booking-preflight";
import { scrubSensitiveEmailPayload } from "@/lib/email/payload-security";
import { hasActiveClientDeliveryLease } from "@/lib/email/booking-delivery-fence";

async function systemSkipPendingClientEmailLog(
  tx: Prisma.TransactionClient,
  emailLog: { id: string; payload: Prisma.JsonValue | null },
  reason: string,
  now: Date,
) {
  await tx.emailLog.update({
    where: { id: emailLog.id },
    data: {
      status: EmailLogStatus.SENT,
      provider: "system-skip",
      sentAt: now,
      processingStartedAt: null,
      processingToken: null,
      nextAttemptAt: now,
      errorMessage: reason,
      payload: scrubSensitiveEmailPayload(emailLog.payload),
    },
  });
}

export function hasClientEmailChanged(currentEmail: string | null, nextEmail: string | null) {
  const normalizedCurrentEmail = currentEmail ? normalizeClientEmail(currentEmail) : "";
  const normalizedNextEmail = nextEmail ? normalizeClientEmail(nextEmail) : "";

  return normalizedCurrentEmail !== normalizedNextEmail;
}

export function getBookingIdsWithChangedEmailSnapshot(
  bookings: ReadonlyArray<{ id: string; clientEmailSnapshot: string }>,
  nextEmail: string | null,
) {
  return bookings
    .filter((booking) => hasClientEmailChanged(booking.clientEmailSnapshot, nextEmail))
    .map((booking) => booking.id);
}

export async function rotateClientBookingTokensForEmailChange(
  tx: Prisma.TransactionClient,
  input: {
    clientId: string;
    bookingIds: string[];
    newEmail: string | null;
    now: Date;
  },
) {
  if (input.bookingIds.length === 0) {
    return;
  }

  let activeBookings = await tx.booking.findMany({
    where: {
      clientId: input.clientId,
      id: {
        in: input.bookingIds,
      },
      status: {
        in: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
      },
      scheduledStartsAt: {
        gte: input.now,
      },
    },
    select: {
      id: true,
      status: true,
      serviceId: true,
      serviceNameSnapshot: true,
      clientNameSnapshot: true,
      scheduledStartsAt: true,
      scheduledEndsAt: true,
      intendedVoucherCodeSnapshot: true,
      clientEmailSnapshot: true,
      communicationGeneration: true,
      clientDeliveryLeaseToken: true,
      clientDeliveryLeaseExpiresAt: true,
      reminder24hQueuedAt: true,
      reminder24hSentAt: true,
    },
  });
  const activeBookingIds = activeBookings.map((booking) => booking.id);

  if (activeBookingIds.length === 0) {
    return;
  }

  // Contact rotation and delivery authorization use the same Booking lock.
  // After taking it, refresh the rows so a lease committed concurrently is
  // observed before the snapshot/generation mutation.
  await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "Booking"
    WHERE "id" IN (${Prisma.join(activeBookingIds)})
    ORDER BY "id"
    FOR UPDATE
  `);
  activeBookings = await tx.booking.findMany({
    where: {
      clientId: input.clientId,
      id: { in: activeBookingIds },
      status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
      scheduledStartsAt: { gte: input.now },
    },
    select: {
      id: true,
      status: true,
      serviceId: true,
      serviceNameSnapshot: true,
      clientNameSnapshot: true,
      scheduledStartsAt: true,
      scheduledEndsAt: true,
      intendedVoucherCodeSnapshot: true,
      clientEmailSnapshot: true,
      communicationGeneration: true,
      clientDeliveryLeaseToken: true,
      clientDeliveryLeaseExpiresAt: true,
      reminder24hQueuedAt: true,
      reminder24hSentAt: true,
    },
  });

  if (activeBookings.some((booking) => hasActiveClientDeliveryLease(booking, input.now))) {
    throw new Error("Nelze změnit kontakt během autorizovaného odesílání klientského e-mailu.");
  }

  // Helper rotace tokenů používají i přímé maintenance flow. Snapshot rezervace
  // proto zůstává autoritativní i tehdy, když ho caller před transakcí ještě
  // nepropsal.
  await tx.booking.updateMany({
    where: { id: { in: activeBookingIds } },
    data: {
      clientEmailSnapshot: input.newEmail ?? "",
      communicationGeneration: { increment: 1 },
    },
  });
  const bookingsWithCurrentEmail = activeBookings.map((booking) => ({
    ...booking,
    clientEmailSnapshot: input.newEmail ?? "",
    communicationGeneration: booking.communicationGeneration + 1,
  }));

  // Worker claim lock musí být serializovaný se změnou kontaktu; jinak by mohl
  // mezi načtením pending logu a jeho aktualizací převzít starého příjemce.
  await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "EmailLog"
    WHERE "clientId" = ${input.clientId}
      AND "bookingId" IN (${Prisma.join(activeBookingIds)})
      AND "status" = ${EmailLogStatus.PENDING}
      AND "processingStartedAt" IS NULL
    FOR UPDATE
  `);

  await tx.bookingActionToken.updateMany({
    where: {
      bookingId: {
        in: activeBookingIds,
      },
      type: {
        in: [BookingActionTokenType.RESCHEDULE, BookingActionTokenType.CANCEL],
      },
      usedAt: null,
      revokedAt: null,
      expiresAt: {
        gt: input.now,
      },
    },
    data: {
      revokedAt: input.now,
    },
  });

  const pendingClientEmailLogs = await tx.emailLog.findMany({
    where: {
      clientId: input.clientId,
      bookingId: { in: activeBookingIds },
      status: EmailLogStatus.PENDING,
      audience: EmailAudience.CLIENT,
      processingStartedAt: null,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      communicationGeneration: true,
      bookingId: true,
      type: true,
      templateKey: true,
      recipientEmail: true,
      payload: true,
    },
  });

  const pendingLogsByBookingId = new Map<string, (typeof pendingClientEmailLogs)[number][]>();
  for (const emailLog of pendingClientEmailLogs) {
    if (!emailLog.bookingId) {
      continue;
    }

    const logs = pendingLogsByBookingId.get(emailLog.bookingId) ?? [];
    logs.push(emailLog);
    pendingLogsByBookingId.set(emailLog.bookingId, logs);
  }

  for (const booking of bookingsWithCurrentEmail) {
    const currentEmail = booking.status === BookingStatus.CONFIRMED
      ? {
          type: EmailLogType.BOOKING_CONFIRMED,
          templateKey: "booking-approved-v1",
          subject: `Rezervace potvrzena: ${booking.serviceNameSnapshot}`,
        }
      : {
          type: EmailLogType.BOOKING_RECEIVED,
          templateKey: "booking-confirmation-v1",
          subject: `Přijetí rezervace: ${booking.serviceNameSnapshot}`,
        };
    const pendingLogs = pendingLogsByBookingId.get(booking.id) ?? [];
    const existingEmailLog = pendingLogs.find((emailLog) => {
      if (
        emailLog.type !== currentEmail.type
        || emailLog.templateKey !== currentEmail.templateKey
      ) {
        return false;
      }

      return evaluateBookingEmailPreflight({
        type: emailLog.type,
        audience: EmailAudience.CLIENT,
        templateKey: emailLog.templateKey,
        payload: emailLog.payload,
        booking,
      }).shouldSend;
    });
    const reminderWindowPosition = getBookingReminder24hEnqueueWindowPosition(
      booking.scheduledStartsAt,
      input.now,
    );
    const existingReminderLog = input.newEmail
      && booking.status === BookingStatus.CONFIRMED
      && booking.reminder24hSentAt === null
      && reminderWindowPosition !== "before"
      ? pendingLogs.find((emailLog) => {
          if (
            emailLog.type !== EmailLogType.BOOKING_REMINDER
            || emailLog.templateKey !== "booking-reminder-24h-v1"
          ) {
            return false;
          }

          return evaluateBookingEmailPreflight({
            type: emailLog.type,
            audience: EmailAudience.CLIENT,
            templateKey: emailLog.templateKey,
            payload: emailLog.payload,
            booking,
          }).shouldSend && evaluateBookingReminderDelivery({
            bookingStatus: booking.status,
            reminder24hSentAt: booking.reminder24hSentAt,
            scheduledStartsAt: booking.scheduledStartsAt,
            now: input.now,
          }).shouldSend;
        })
      : undefined;
    const obsoletePendingLogIds = pendingLogs
      .filter((emailLog) => (
        emailLog.id !== existingEmailLog?.id
        && emailLog.id !== existingReminderLog?.id
      ))
      .map((emailLog) => emailLog.id);
    if (!input.newEmail) {
      for (const emailLog of pendingLogs) {
        await systemSkipPendingClientEmailLog(
          tx,
          emailLog,
          "Klientka nemá aktuální e-mailovou adresu.",
          input.now,
        );
      }

      if (booking.status === BookingStatus.CONFIRMED && booking.reminder24hSentAt === null) {
        await tx.booking.update({
          where: { id: booking.id },
          data: { reminder24hQueuedAt: null },
        });
      }
      continue;
    }

    for (const emailLog of pendingLogs.filter((candidate) => obsoletePendingLogIds.includes(candidate.id))) {
      await systemSkipPendingClientEmailLog(
        tx,
        emailLog,
        "Neaktuální klientský booking e-mail byl nahrazen aktuální šablonou.",
        input.now,
      );
    }

    if (booking.status === BookingStatus.CONFIRMED && booking.reminder24hSentAt === null) {
      await tx.booking.update({
        where: { id: booking.id },
        data: { reminder24hQueuedAt: null },
      });

      if (reminderWindowPosition !== "before") {
        await enqueueBookingReminder24hForBooking(tx, {
          id: booking.id,
          clientId: input.clientId,
          clientEmailSnapshot: booking.clientEmailSnapshot,
          communicationGeneration: booking.communicationGeneration,
          clientNameSnapshot: booking.clientNameSnapshot,
          status: booking.status,
          serviceId: booking.serviceId,
          serviceNameSnapshot: booking.serviceNameSnapshot,
          scheduledStartsAt: booking.scheduledStartsAt,
          scheduledEndsAt: booking.scheduledEndsAt,
        }, input.now, existingReminderLog
          ? { existingPendingReminderId: existingReminderLog.id }
          : undefined);
      }
    }

    if (existingEmailLog) {
      const clientTokens = await issueBookingClientActionTokens(tx, {
        bookingId: booking.id,
        scheduledStartsAt: booking.scheduledStartsAt,
        now: input.now,
      });
      const clientPayload = buildCanonicalClientBookingEmailPayload(booking, clientTokens);

      await tx.emailLog.update({
        where: { id: existingEmailLog.id },
        data: {
          recipientEmail: booking.clientEmailSnapshot.trim(),
          communicationGeneration: booking.communicationGeneration,
          actionTokenId: clientTokens.actionTokenId,
          payload: clientPayload,
        },
      });
      continue;
    }

    const clientTokens = await issueBookingClientActionTokens(tx, {
      bookingId: booking.id,
      scheduledStartsAt: booking.scheduledStartsAt,
      now: input.now,
    });
    const clientPayload = buildCanonicalClientBookingEmailPayload(booking, clientTokens);

    await tx.emailLog.create({
      data: {
        bookingId: booking.id,
        clientId: input.clientId,
        actionTokenId: clientTokens.actionTokenId,
        type: currentEmail.type,
        audience: EmailAudience.CLIENT,
        status: env.EMAIL_DELIVERY_MODE === "background" ? undefined : EmailLogStatus.SENT,
        attemptCount: env.EMAIL_DELIVERY_MODE === "background" ? undefined : 1,
        nextAttemptAt: env.EMAIL_DELIVERY_MODE === "background" ? input.now : undefined,
        processingStartedAt: null,
        processingToken: null,
        recipientEmail: booking.clientEmailSnapshot.trim(),
        communicationGeneration: booking.communicationGeneration,
        subject: currentEmail.subject,
        templateKey: currentEmail.templateKey,
        payload: env.EMAIL_DELIVERY_MODE === "background"
          ? clientPayload
          : scrubSensitiveEmailPayload(clientPayload),
        provider: env.EMAIL_DELIVERY_MODE === "background" ? undefined : "log",
        sentAt: env.EMAIL_DELIVERY_MODE === "background" ? undefined : input.now,
      },
    });
  }
}
