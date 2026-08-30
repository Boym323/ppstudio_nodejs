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
import { evaluateBookingEmailPreflight } from "@/lib/email/booking-preflight";
import { prisma } from "@/lib/prisma";

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

  // PENDING zdroj může stále potřebovat své payload pro automatický retry.
  // Jeho starý token proto ponecháme platný; u SENT/FAILED už ho můžeme
  // bezpečně zneplatnit před vydáním nových odkazů.
  if (emailLog.status !== EmailLogStatus.PENDING) {
    await tx.bookingActionToken.updateMany({
      where: {
        bookingId: emailLog.bookingId,
        type: { in: tokenTypes },
        usedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: now },
    });
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

/** Vlastní zápis nového logu; server action pouze ověřuje oprávnění a navigaci. */
export async function createResendEmailLog(input: {
  emailLog: ResendSourceEmailLog;
  adminNotificationEmail?: string | null;
}) {
  const { emailLog } = input;
  const recipientEmail = resolveEmailLogRecipient({
    audience: emailLog.audience,
    clientIsAvailable: emailLog.client !== null,
    clientEmail: emailLog.client?.email ?? null,
    bookingClientEmailSnapshot: emailLog.booking?.clientEmailSnapshot ?? null,
    originalRecipientEmail: emailLog.recipientEmail,
    adminNotificationEmail: input.adminNotificationEmail,
  });
  if (!recipientEmail) return null;

  return prisma.$transaction(async (tx) => {
    const incidentRoot = emailLog.resendRootId
      ? await tx.emailLog.findUnique({
          where: { id: emailLog.resendRootId },
          select: { incidentResolvedAt: true },
        })
      : emailLog;
    const tokenPayloadKind = getResendTokenPayloadKind(emailLog);
    if (tokenPayloadKind && !emailLog.bookingId) {
      return null;
    }

    if (tokenPayloadKind === "client" && emailLog.bookingId) {
      // Zamknutí booking brání tomu, aby mezi preflightem a revokací tokenů
      // proběhl souběžný přesun nebo storno.
      await tx.$queryRaw(Prisma.sql`
        SELECT "id"
        FROM "Booking"
        WHERE "id" = ${emailLog.bookingId}
        FOR UPDATE
      `);
      const booking = await tx.booking.findUnique({
        where: { id: emailLog.bookingId },
        select: {
          status: true,
          serviceId: true,
          scheduledStartsAt: true,
          scheduledEndsAt: true,
        },
      });
      const preflight = evaluateBookingEmailPreflight({
        type: emailLog.type,
        audience: emailLog.audience,
        templateKey: emailLog.templateKey,
        payload: emailLog.payload,
        booking,
      });

      if (!preflight.shouldSend) {
        return null;
      }
    }

    const tokenPayload = tokenPayloadKind
      ? await issueResendBookingActionTokens(tx, emailLog, tokenPayloadKind, new Date())
      : null;

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
