import {
  BookingActionTokenType,
  EmailAudience,
  EmailLogStatus,
  Prisma,
} from "@/generated/prisma/client";
import {
  buildResendEmailLogCreateInput,
  resolveEmailLogRecipient,
  resolveResendIncidentRootId,
} from "@/features/admin/actions/email-log-action-helpers";
import {
  buildBookingActionToken,
  buildBookingEmailActionExpiry,
  buildBookingEmailActionUrl,
  issueBookingClientActionTokens,
} from "@/features/booking/lib/booking-action-tokens";
import {
  buildCanonicalClientBookingEmailPayload,
  evaluateBookingEmailPreflight,
} from "@/lib/email/booking-preflight";
import {
  advanceBookingCommunicationGeneration,
  assertNoActiveClientDeliveryLease,
} from "@/lib/email/booking-delivery-fence";
import { scrubSensitiveEmailPayload } from "@/lib/email/payload-security";
import { runSerializableTransaction } from "@/lib/serializable-transaction";

const CLIENT_TOKEN_EMAIL_TEMPLATES = new Set([
  "booking-confirmation-v1",
  "booking-approved-v1",
  "booking-reminder-24h-v1",
  "booking-rescheduled-v1",
]);

type ResendTokenPayload = {
  manageReservationUrl: string;
  cancellationUrl: string;
  serviceId: string;
} | {
  approveUrl: string;
  rejectUrl: string;
};

type ResendSourceEmailLog = Prisma.EmailLogGetPayload<{
  include: {
    client: { select: { id: true; email: true } };
    booking: { select: { id: true; clientEmailSnapshot: true } };
  };
}>;

type CurrentResendBooking = Prisma.BookingGetPayload<{
  select: {
    id: true;
    clientId: true;
    clientEmailSnapshot: true;
    status: true;
    serviceId: true;
    serviceNameSnapshot: true;
    clientNameSnapshot: true;
    intendedVoucherCodeSnapshot: true;
    clientDeliveryLeaseToken: true;
    clientDeliveryLeaseExpiresAt: true;
    communicationGeneration: true;
    scheduledStartsAt: true;
    scheduledEndsAt: true;
  };
}>;

type ResendTestHooks = {
  beforeClientLock?: () => void | Promise<void>;
  afterTokenMutation?: () => void | Promise<void>;
};

function getResendTokenPayloadKind(emailLog: ResendSourceEmailLog) {
  if (
    emailLog.audience === EmailAudience.CLIENT
    && CLIENT_TOKEN_EMAIL_TEMPLATES.has(emailLog.templateKey)
  ) {
    return "client" as const;
  }

  if (
    emailLog.audience === EmailAudience.ADMIN
    && emailLog.templateKey === "admin-booking-notification-v1"
  ) {
    return "admin" as const;
  }

  return null;
}

async function loadCurrentResendBooking(
  tx: Prisma.TransactionClient,
  bookingId: string,
  lock: boolean,
) {
  if (lock) {
    await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "Booking"
      WHERE "id" = ${bookingId}
      FOR UPDATE
    `);
  }

  return tx.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      clientId: true,
      clientEmailSnapshot: true,
      status: true,
      serviceId: true,
      serviceNameSnapshot: true,
      clientNameSnapshot: true,
      intendedVoucherCodeSnapshot: true,
      clientDeliveryLeaseToken: true,
      clientDeliveryLeaseExpiresAt: true,
      communicationGeneration: true,
      scheduledStartsAt: true,
      scheduledEndsAt: true,
    },
  });
}

async function issueResendBookingActionTokens(
  tx: Prisma.TransactionClient,
  emailLog: ResendSourceEmailLog,
  kind: "client" | "admin",
  now: Date,
) {
  if (!emailLog.bookingId) {
    return null;
  }

  const tokenTypes = kind === "client"
    ? [BookingActionTokenType.RESCHEDULE, BookingActionTokenType.CANCEL]
    : [BookingActionTokenType.APPROVE, BookingActionTokenType.REJECT];

  let clientScheduledStartsAt: Date | null = null;
  let clientServiceId: string | null = null;
  if (kind === "client") {
    const booking = await tx.booking.findUnique({
      where: { id: emailLog.bookingId },
      select: { scheduledStartsAt: true, serviceId: true },
    });

    if (!booking) {
      return null;
    }

    clientScheduledStartsAt = booking.scheduledStartsAt;
    clientServiceId = booking.serviceId;
  }

  if (kind === "client") {
    if (clientScheduledStartsAt === null || clientServiceId === null) {
      return null;
    }

    const scheduledStartsAt = clientScheduledStartsAt;
    const clientTokens = await issueBookingClientActionTokens(tx, {
      bookingId: emailLog.bookingId,
      scheduledStartsAt,
      now,
    });

    return {
      actionTokenId: clientTokens.actionTokenId,
      payload: {
        manageReservationUrl: clientTokens.manageReservationUrl,
        cancellationUrl: clientTokens.cancellationUrl,
        serviceId: clientServiceId,
      },
    };
  }

  const firstToken = buildBookingActionToken();
  const secondToken = buildBookingActionToken();

  const expiresAt = buildBookingEmailActionExpiry(now);

  const firstActionToken = await tx.bookingActionToken.create({
    data: {
      bookingId: emailLog.bookingId,
      type: tokenTypes[0],
      tokenHash: firstToken.tokenHash,
      expiresAt,
      lastSentAt: now,
    },
    select: { id: true },
  });

  await tx.bookingActionToken.create({
    data: {
      bookingId: emailLog.bookingId,
      type: tokenTypes[1],
      tokenHash: secondToken.tokenHash,
      expiresAt,
      lastSentAt: now,
    },
  });

  const payload: ResendTokenPayload = {
    approveUrl: buildBookingEmailActionUrl("approve", firstToken.rawToken),
    rejectUrl: buildBookingEmailActionUrl("reject", secondToken.rawToken),
  };

  return {
    actionTokenId: firstActionToken.id,
    payload,
  };
}

function buildResendPayload(payload: Prisma.JsonValue | null, tokenPayload: ResendTokenPayload) {
  const basePayload = payload && typeof payload === "object" && !Array.isArray(payload)
    ? { ...(payload as Record<string, Prisma.JsonValue>) }
    : {};

  return {
    ...basePayload,
    ...tokenPayload,
  } satisfies Prisma.InputJsonObject;
}

async function reconcilePendingClientTokenEmailLogs(
  tx: Prisma.TransactionClient,
  booking: CurrentResendBooking,
  previousGeneration: number,
  tokenPayload: Extract<ResendTokenPayload, { manageReservationUrl: string }>,
  actionTokenId: string,
  now: Date,
) {
  const pendingLogs = await tx.emailLog.findMany({
    where: {
      bookingId: booking.id,
      audience: EmailAudience.CLIENT,
      status: EmailLogStatus.PENDING,
      templateKey: { in: Array.from(CLIENT_TOKEN_EMAIL_TEMPLATES) },
    },
    select: {
      id: true,
      communicationGeneration: true,
      type: true,
      templateKey: true,
      payload: true,
    },
  });

  const canonicalPayload = buildCanonicalClientBookingEmailPayload(booking, tokenPayload);
  for (const emailLog of pendingLogs) {
    const isCurrent = emailLog.communicationGeneration === previousGeneration
      && evaluateBookingEmailPreflight({
        type: emailLog.type,
        audience: EmailAudience.CLIENT,
        templateKey: emailLog.templateKey,
        payload: emailLog.payload,
        booking,
      }).shouldSend;

    if (isCurrent) {
      const preservesManualReminderResend = emailLog.type === "BOOKING_REMINDER"
        && emailLog.payload
        && typeof emailLog.payload === "object"
        && !Array.isArray(emailLog.payload)
        && emailLog.payload.manualReminderResend === true;
      await tx.emailLog.update({
        where: { id: emailLog.id },
        data: {
          recipientEmail: booking.clientEmailSnapshot.trim(),
          communicationGeneration: booking.communicationGeneration,
          actionTokenId,
          payload: preservesManualReminderResend
            ? { ...canonicalPayload, manualReminderResend: true }
            : canonicalPayload,
          nextAttemptAt: now,
          errorMessage: null,
        },
      });
      continue;
    }

    await tx.emailLog.update({
      where: { id: emailLog.id },
      data: {
        status: EmailLogStatus.SENT,
        provider: "system-skip",
        sentAt: now,
        processingStartedAt: null,
        processingToken: null,
        nextAttemptAt: now,
        errorMessage: "Neaktuální tokenový klientský e-mail byl nahrazen novou komunikační generací.",
        payload: scrubSensitiveEmailPayload(emailLog.payload),
      },
    });
  }

  return canonicalPayload;
}

/** Vlastní zápis nového logu; server action pouze ověřuje oprávnění a navigaci. */
export async function createResendEmailLog(input: {
  emailLog: ResendSourceEmailLog;
  adminNotificationEmail?: string | null;
  hooks?: ResendTestHooks;
}) {
  const { emailLog } = input;
  const tokenPayloadKind = getResendTokenPayloadKind(emailLog);
  const isClientAudience = emailLog.audience === EmailAudience.CLIENT;
  const recipientEmailForNonClient = isClientAudience
    ? null
    : resolveEmailLogRecipient({
        audience: emailLog.audience,
        clientIsAvailable: emailLog.client !== null,
        clientEmail: emailLog.client?.email ?? null,
        bookingClientEmailSnapshot: emailLog.booking?.clientEmailSnapshot ?? null,
        originalRecipientEmail: emailLog.recipientEmail,
        adminNotificationEmail: input.adminNotificationEmail,
      });

  if (!isClientAudience && !recipientEmailForNonClient) return null;

  return runSerializableTransaction(async (tx) => {
    let recipientEmail = recipientEmailForNonClient;
    let currentClient: { id: string; email: string | null } | null = null;
    let currentBooking: CurrentResendBooking | null = null;

    if (isClientAudience) {
      // clientId je u běžných logů známý už z initial lookup. Legacy log bez
      // něj musí nejprve zjistit aktuální vazbu booking -> Client, ale vlastní
      // lock je stále získán před čtením recipientu a před token mutation.
      let clientId = emailLog.clientId;
      if (!clientId && emailLog.bookingId) {
        const bookingIdentity = await tx.booking.findUnique({
          where: { id: emailLog.bookingId },
          select: { clientId: true },
        });
        clientId = bookingIdentity?.clientId ?? null;
      }

      await input.hooks?.beforeClientLock?.();

      if (clientId) {
        await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT "id"
          FROM "Client"
          WHERE "id" = ${clientId}
          FOR UPDATE
        `);
        currentClient = await tx.client.findUnique({
          where: { id: clientId },
          select: { id: true, email: true },
        });
      }

      if (emailLog.bookingId) {
        currentBooking = await loadCurrentResendBooking(
          tx,
          emailLog.bookingId,
          true,
        );

        if (!currentBooking) {
          return null;
        }

        if (emailLog.communicationGeneration !== currentBooking.communicationGeneration) {
          return null;
        }
      }

      recipientEmail = emailLog.bookingId
        ? currentBooking?.clientEmailSnapshot.trim() || null
        : resolveEmailLogRecipient({
            audience: EmailAudience.CLIENT,
            clientIsAvailable: currentClient !== null,
            clientEmail: currentClient?.email ?? null,
            bookingClientEmailSnapshot: null,
            originalRecipientEmail: emailLog.recipientEmail,
          });
      if (!recipientEmail) return null;
    }

    const incidentRoot = emailLog.resendRootId
      ? await tx.emailLog.findUnique({
          where: { id: emailLog.resendRootId },
          select: { incidentResolvedAt: true },
        })
      : emailLog;
    if (tokenPayloadKind && !emailLog.bookingId) {
      return null;
    }

    if (tokenPayloadKind === "client" && emailLog.bookingId) {
      // Zamknutí booking brání tomu, aby mezi preflightem a revokací tokenů
      // proběhl souběžný přesun nebo storno.
      currentBooking ??= await loadCurrentResendBooking(tx, emailLog.bookingId, true);
      if (!currentBooking) return null;
      const lockedBooking = currentBooking;
      const preflight = evaluateBookingEmailPreflight({
        type: emailLog.type,
        audience: emailLog.audience,
        templateKey: emailLog.templateKey,
        payload: emailLog.payload,
        booking: lockedBooking,
      });

      if (!preflight.shouldSend) {
        return null;
      }

      assertNoActiveClientDeliveryLease(
        lockedBooking,
        new Date(),
        "Nelze znovu vydat klientské odkazy během autorizovaného odesílání e-mailu.",
      );

      const previousGeneration = lockedBooking.communicationGeneration;
      await tx.booking.update({
        where: { id: lockedBooking.id },
        data: { communicationGeneration: { increment: 1 } },
      });
      const nextBooking: CurrentResendBooking = {
        ...lockedBooking,
        communicationGeneration: advanceBookingCommunicationGeneration(lockedBooking),
      };

      await tx.bookingActionToken.updateMany({
        where: {
          bookingId: nextBooking.id,
          type: { in: [BookingActionTokenType.RESCHEDULE, BookingActionTokenType.CANCEL] },
          usedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      const tokenPayload = await issueResendBookingActionTokens(
        tx,
        emailLog,
        tokenPayloadKind,
        new Date(),
      );
      if (!tokenPayload) return null;
      if (!("manageReservationUrl" in tokenPayload.payload)) return null;
      const clientRecipientEmail = recipientEmail;
      if (!clientRecipientEmail) return null;

      await input.hooks?.afterTokenMutation?.();
      await reconcilePendingClientTokenEmailLogs(
        tx,
        nextBooking,
        previousGeneration,
        tokenPayload.payload,
        tokenPayload.actionTokenId,
        new Date(),
      );

      return tx.emailLog.create({
        data: buildResendEmailLogCreateInput({
          resendOfId: emailLog.id,
          resendRootId: resolveResendIncidentRootId({
            sourceEmailLogId: emailLog.id,
            sourceResendRootId: emailLog.resendRootId,
            incidentResolvedAt: incidentRoot?.incidentResolvedAt ?? emailLog.incidentResolvedAt,
          }),
          bookingId: emailLog.bookingId,
          clientId: emailLog.clientId,
          communicationGeneration: nextBooking.communicationGeneration,
          actionTokenId: tokenPayload.actionTokenId,
          type: emailLog.type,
          audience: emailLog.audience,
          recipientEmail: clientRecipientEmail,
          subject: emailLog.subject,
          templateKey: emailLog.templateKey,
          payload: buildResendPayload(emailLog.payload, tokenPayload.payload),
        }),
      });
    }

    if (tokenPayloadKind === "admin" && emailLog.bookingId && emailLog.status !== EmailLogStatus.PENDING) {
      await tx.bookingActionToken.updateMany({
        where: {
          bookingId: emailLog.bookingId,
          type: { in: [BookingActionTokenType.APPROVE, BookingActionTokenType.REJECT] },
          usedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    }

    const tokenPayload = tokenPayloadKind
      ? await issueResendBookingActionTokens(tx, emailLog, tokenPayloadKind, new Date())
      : null;

    if (tokenPayload) {
      await input.hooks?.afterTokenMutation?.();
    }

    if (!recipientEmail) {
      return null;
    }

    return tx.emailLog.create({
      data: buildResendEmailLogCreateInput({
        resendOfId: emailLog.id,
        resendRootId: resolveResendIncidentRootId({
          sourceEmailLogId: emailLog.id,
          sourceResendRootId: emailLog.resendRootId,
          incidentResolvedAt: incidentRoot?.incidentResolvedAt ?? emailLog.incidentResolvedAt,
        }),
        bookingId: emailLog.bookingId,
        clientId: emailLog.clientId,
        communicationGeneration: currentBooking?.communicationGeneration,
        actionTokenId: tokenPayload?.actionTokenId ?? emailLog.actionTokenId,
        type: emailLog.type,
        audience: emailLog.audience,
        recipientEmail,
        subject: emailLog.subject,
        templateKey: emailLog.templateKey,
        payload: tokenPayload
          ? buildResendPayload(emailLog.payload, tokenPayload.payload)
          : emailLog.payload,
      }),
    });
  });
}
