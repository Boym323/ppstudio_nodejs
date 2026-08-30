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

type CurrentResendBooking = Prisma.BookingGetPayload<{
  select: {
    id: true;
    clientId: true;
    clientEmailSnapshot: true;
    status: true;
    serviceId: true;
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

  return prisma.$transaction(async (tx) => {
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
      const preflight = evaluateBookingEmailPreflight({
        type: emailLog.type,
        audience: emailLog.audience,
        templateKey: emailLog.templateKey,
        payload: emailLog.payload,
        booking: currentBooking,
      });

      if (!preflight.shouldSend) {
        return null;
      }
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
