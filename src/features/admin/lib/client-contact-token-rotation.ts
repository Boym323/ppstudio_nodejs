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
  buildCanonicalClientBookingEmailPayload,
  evaluateBookingEmailPreflight,
} from "@/lib/email/booking-preflight";
import { scrubSensitiveEmailPayload } from "@/lib/email/payload-security";

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
  const normalizedCurrentEmail = currentEmail ? normalizeClientEmail(currentEmail) : null;

  return normalizedCurrentEmail !== nextEmail;
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

  const activeBookings = await tx.booking.findMany({
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
    },
  });
  const activeBookingIds = activeBookings.map((booking) => booking.id);

  if (activeBookingIds.length === 0) {
    return;
  }

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
      bookingId: true,
      type: true,
      templateKey: true,
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

  for (const booking of activeBookings) {
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
    const obsoletePendingLogIds = pendingLogs
      .filter((emailLog) => emailLog.id !== existingEmailLog?.id)
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
          recipientEmail: input.newEmail,
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
        recipientEmail: input.newEmail,
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
