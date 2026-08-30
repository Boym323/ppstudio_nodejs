import "server-only";

import {
  BookingActionTokenType,
  BookingActorType,
  BookingSource,
  BookingStatus,
  EmailAudience,
  EmailLogStatus,
  EmailLogType,
  Prisma,
} from "@/generated/prisma/client";

import { env } from "@/config/env";
import {
  buildBookingActionToken,
  buildBookingCancellationUrl,
  buildBookingManagementUrl,
  buildBookingSelfServiceActionExpiry,
  type BookingEmailActionIntent,
  hashBookingActionToken,
} from "@/features/booking/lib/booking-action-tokens";
import { formatBookingDateLabel } from "@/features/booking/lib/booking-format";
import {
  archiveOrphanedManualOverrideSlotAfterCancellation,
  compactAdjacentEditableSlotsForBooking,
} from "@/features/booking/lib/booking-slot-compaction";
import { getBookingStatusLabel } from "@/features/booking/lib/booking-status-presentation";
import { sendOwnerBookingPushover } from "@/lib/notifications/pushover";
import { prisma } from "@/lib/prisma";
import { scrubSensitiveEmailPayload } from "@/lib/email/payload-security";

type BookingEmailActionTargetStatus = "CONFIRMED" | "CANCELLED";

type LoadedBookingActionToken = {
  id: string;
  bookingId: string;
  type: BookingActionTokenType;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
  booking: {
    id: string;
    status: BookingStatus;
    confirmedAt: Date | null;
    cancelledAt: Date | null;
    manualOverride: boolean;
    clientId: string;
    client: {
      email: string | null;
    } | null;
    slotId: string;
    serviceId: string;
    clientNameSnapshot: string;
    clientEmailSnapshot: string;
    serviceNameSnapshot: string;
    scheduledStartsAt: Date;
    scheduledEndsAt: Date;
    voucherRedemptions: ReadonlyArray<{ id: string }>;
  } | null;
};

export type BookingEmailActionTokenRecord = LoadedBookingActionToken | null;

type BookingEmailActionDetails = {
  bookingId: string;
  serviceName: string;
  clientName: string;
  scheduledAtLabel: string;
  currentStatusLabel: string;
  adminDetailUrl: string;
  adminOverviewUrl: string;
};

type BookingEmailActionTerminalState = Partial<BookingEmailActionDetails> & {
  status:
    | "auth_required"
    | "invalid"
    | "expired"
    | "already_confirmed"
    | "already_cancelled"
    | "voucher_redemption_blocked"
    | "already_processed"
    | "not_found";
  intent: BookingEmailActionIntent;
  title: string;
  message: string;
};

export type BookingEmailActionPageState =
  | (BookingEmailActionDetails & {
      status: "ready";
      intent: BookingEmailActionIntent;
      actionLabel: string;
      actionQuestion: string;
      confirmLabel: string;
      resultTitle: string;
      resultDescription: string;
      expiresAt: string;
    })
  | BookingEmailActionTerminalState;

export type PerformBookingEmailActionResult =
  | (BookingEmailActionDetails & {
      status: "completed";
      intent: BookingEmailActionIntent;
      resultTitle: string;
      resultDescription: string;
      emailDeliveryStatus: "queued" | "logged" | "skipped";
    })
  | BookingEmailActionTerminalState;

function buildBookingApprovedEmailPayload(
  booking: NonNullable<LoadedBookingActionToken["booking"]>,
  manageReservationUrl: string,
  cancellationUrl: string,
) {
  return {
    bookingId: booking.id,
    serviceId: booking.serviceId,
    serviceName: booking.serviceNameSnapshot,
    clientName: booking.clientNameSnapshot,
    scheduledStartsAt: booking.scheduledStartsAt.toISOString(),
    scheduledEndsAt: booking.scheduledEndsAt.toISOString(),
    manageReservationUrl,
    cancellationUrl,
  };
}

function getActionTokenType(intent: BookingEmailActionIntent) {
  return intent === "approve" ? BookingActionTokenType.APPROVE : BookingActionTokenType.REJECT;
}

function getTargetStatus(intent: BookingEmailActionIntent): BookingEmailActionTargetStatus {
  return intent === "approve" ? BookingStatus.CONFIRMED : BookingStatus.CANCELLED;
}

function getActionCopy(intent: BookingEmailActionIntent) {
  if (intent === "approve") {
    return {
      actionLabel: "Schválení rezervace",
      actionQuestion: "Opravdu chcete tuto rezervaci potvrdit?",
      confirmLabel: "Potvrdit schválení",
      resultTitle: "Rezervace byla potvrzena",
      resultDescription: "Klientce bude odeslán potvrzovací e-mail s výsledkem rezervace.",
      staleTitle: "Tento odkaz už nejde použít pro potvrzení",
    };
  }

  return {
    actionLabel: "Zrušení rezervace",
    actionQuestion: "Opravdu chcete tuto rezervaci zrušit?",
    confirmLabel: "Potvrdit zrušení",
    resultTitle: "Rezervace byla zrušena",
    resultDescription: "Klientce bude odeslán e-mail o zrušení rezervace.",
    staleTitle: "Tento odkaz už nejde použít pro zrušení",
  };
}

function getAdminDetailUrl(bookingId: string) {
  return `${env.NEXT_PUBLIC_APP_URL}/admin/rezervace/${bookingId}`;
}

function getAdminOverviewUrl() {
  return `${env.NEXT_PUBLIC_APP_URL}/admin`;
}

function toActionDetails(booking: NonNullable<LoadedBookingActionToken["booking"]>): BookingEmailActionDetails {
  return {
    bookingId: booking.id,
    serviceName: booking.serviceNameSnapshot,
    clientName: booking.clientNameSnapshot,
    scheduledAtLabel: formatBookingDateLabel(booking.scheduledStartsAt, booking.scheduledEndsAt),
    currentStatusLabel: getBookingStatusLabel(booking.status),
    adminDetailUrl: getAdminDetailUrl(booking.id),
    adminOverviewUrl: getAdminOverviewUrl(),
  };
}

async function findActionToken(tokenHash: string) {
  return prisma.bookingActionToken.findUnique({
    where: {
      tokenHash,
    },
    select: {
      id: true,
      bookingId: true,
      type: true,
      expiresAt: true,
      usedAt: true,
      revokedAt: true,
      booking: {
        select: {
          id: true,
          status: true,
          confirmedAt: true,
          cancelledAt: true,
          manualOverride: true,
          clientId: true,
          client: {
            select: { email: true },
          },
          slotId: true,
          serviceId: true,
          clientNameSnapshot: true,
          clientEmailSnapshot: true,
          serviceNameSnapshot: true,
          scheduledStartsAt: true,
          scheduledEndsAt: true,
          voucherRedemptions: {
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });
}

function resolveNonReadyState(
  token: LoadedBookingActionToken | null,
  intent: BookingEmailActionIntent,
): BookingEmailActionTerminalState {
  const copy = getActionCopy(intent);

  if (!token) {
    return {
      status: "invalid",
      intent,
      title: "Tento odkaz není platný",
      message: "Akční odkaz je neplatný, poškozený nebo už neexistuje.",
    };
  }

  if (!token.booking) {
    return {
      status: "not_found",
      intent,
      title: "Rezervace nebyla nalezena",
      message: "K této akci už neexistuje odpovídající rezervace.",
    };
  }

  const details = toActionDetails(token.booking);

  if (token.booking.voucherRedemptions.length > 0) {
    return {
      status: "voucher_redemption_blocked",
      intent,
      title: "Akci nelze bezpečně provést",
      message: "Rezervace už obsahuje voucherové čerpání. Potvrzení ani zrušení z e-mailového odkazu proto není dostupné; finanční událost nebyla automaticky odstraněna.",
      ...details,
    };
  }

  if (token.type !== getActionTokenType(intent)) {
    return {
      status: "invalid",
      intent,
      title: "Tento odkaz nesouhlasí s požadovanou akcí",
      message: "Zkontrolujte, že otevíráte správný akční odkaz z provozního e-mailu.",
      ...details,
    };
  }

  if (token.expiresAt <= new Date()) {
    return {
      status: "expired",
      intent,
      title: "Platnost odkazu vypršela",
      message: "Tento odkaz už není platný. Otevřete rezervaci v administraci a dokončete ji tam.",
      ...details,
    };
  }

  if (token.usedAt || token.revokedAt) {
    return {
      status: "already_processed",
      intent,
      title: copy.staleTitle,
      message: "Tato rezervace už byla dříve zpracována.",
      ...details,
    };
  }

  if (token.booking.status === BookingStatus.CONFIRMED || token.booking.confirmedAt) {
    return {
      status: "already_confirmed",
      intent,
      title: "Rezervace už je potvrzená",
      message: "Tato rezervace už byla dříve potvrzena.",
      ...details,
    };
  }

  if (token.booking.status === BookingStatus.CANCELLED || token.booking.cancelledAt) {
    return {
      status: "already_cancelled",
      intent,
      title: "Rezervace už je zrušená",
      message: "Tato rezervace už byla dříve zrušena.",
      ...details,
    };
  }

  return {
    status: "already_processed",
    intent,
    title: copy.staleTitle,
    message: `Rezervace je ve stavu „${getBookingStatusLabel(token.booking.status)}“ a tento odkaz už nejde použít.`,
    ...details,
  };
}

export function resolveBookingEmailActionPageState(
  token: BookingEmailActionTokenRecord,
  intent: BookingEmailActionIntent,
): BookingEmailActionPageState {
  if (
    !token
    || !token.booking
    || token.type !== getActionTokenType(intent)
    || token.expiresAt <= new Date()
    || token.usedAt
    || token.revokedAt
    || token.booking.status !== BookingStatus.PENDING
    || token.booking.confirmedAt
    || token.booking.cancelledAt
  ) {
    return resolveNonReadyState(token, intent);
  }

  if (token.booking.voucherRedemptions.length > 0) {
    return resolveNonReadyState(token, intent);
  }

  const copy = getActionCopy(intent);

  return {
    status: "ready",
    intent,
    expiresAt: token.expiresAt.toISOString(),
    ...copy,
    ...toActionDetails(token.booking),
  };
}

export async function getBookingEmailActionPageState(
  intent: BookingEmailActionIntent,
  rawToken: string,
): Promise<BookingEmailActionPageState> {
  const token = await findActionToken(hashBookingActionToken(rawToken));
  return resolveBookingEmailActionPageState(token, intent);
}

type PerformBookingEmailActionAudit = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type BookingEmailActionActor = {
  userId: string | null;
};

export async function performBookingEmailAction(
  intent: BookingEmailActionIntent,
  rawToken: string,
  audit?: PerformBookingEmailActionAudit,
  actor?: BookingEmailActionActor,
): Promise<PerformBookingEmailActionResult> {
  if (!actor) {
    return {
      status: "auth_required",
      intent,
      title: "Nejdřív se přihlaste do administrace",
      message: "Potvrzení nebo zrušení rezervace z e-mailového odkazu teď vyžaduje aktivní admin session.",
    };
  }

  const tokenHash = hashBookingActionToken(rawToken);

  const transactionResult = await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT "id"
        FROM "BookingActionToken"
        WHERE "tokenHash" = ${tokenHash}
        FOR UPDATE
      `);

      const token = await tx.bookingActionToken.findUnique({
        where: {
          tokenHash,
        },
        select: {
          id: true,
          bookingId: true,
          type: true,
          expiresAt: true,
          usedAt: true,
          revokedAt: true,
          booking: {
            select: {
              id: true,
              status: true,
              confirmedAt: true,
              cancelledAt: true,
              manualOverride: true,
              clientId: true,
              client: {
                select: { email: true },
              },
              slotId: true,
              serviceId: true,
              clientNameSnapshot: true,
              clientEmailSnapshot: true,
              serviceNameSnapshot: true,
              scheduledStartsAt: true,
              scheduledEndsAt: true,
              voucherRedemptions: {
                select: { id: true },
                take: 1,
              },
            },
          },
        },
      });

      const state = resolveBookingEmailActionPageState(token, intent);

      if (state.status !== "ready") {
        return state;
      }

      const lockedToken = token as LoadedBookingActionToken;
      const now = new Date();
      const targetStatus = getTargetStatus(intent);
      const copy = getActionCopy(intent);
      const clientEmail = lockedToken.booking?.client?.email?.trim() ?? "";

      await tx.booking.update({
        where: {
          id: lockedToken.bookingId,
        },
        data: {
          status: targetStatus,
          confirmedAt: targetStatus === BookingStatus.CONFIRMED ? now : null,
          cancelledAt: targetStatus === BookingStatus.CANCELLED ? now : null,
        },
      });

      if (targetStatus === BookingStatus.CANCELLED) {
        await compactAdjacentEditableSlotsForBooking(tx, lockedToken.booking!.slotId);

        if (lockedToken.booking!.manualOverride) {
          await archiveOrphanedManualOverrideSlotAfterCancellation(tx, lockedToken.booking!.slotId);
        }
      }

      await tx.bookingActionToken.update({
        where: {
          id: lockedToken.id,
        },
        data: {
          usedAt: now,
        },
      });

      await tx.bookingActionToken.updateMany({
        where: {
          bookingId: lockedToken.bookingId,
          id: {
            not: lockedToken.id,
          },
          usedAt: null,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: lockedToken.bookingId,
          status: targetStatus,
          actorType: BookingActorType.USER,
          actorUserId: actor.userId,
          reason: intent === "approve" ? "owner-email-approve-v1" : "owner-email-reject-v1",
          metadata: {
            source: BookingSource.WEB,
            via: "owner-email-action-token-admin-session",
            intent,
            tokenId: lockedToken.id,
            tokenType: lockedToken.type,
            fromStatus: lockedToken.booking?.status,
            toStatus: targetStatus,
            ipAddress: audit?.ipAddress ?? null,
            userAgent: audit?.userAgent ?? null,
          },
        },
      });

      let bookingApprovedPayload:
        | ReturnType<typeof buildBookingApprovedEmailPayload>
        | {
            bookingId: string;
            serviceName: string;
            clientName: string;
            scheduledStartsAt: string;
            scheduledEndsAt: string;
          };

      if (targetStatus === BookingStatus.CONFIRMED && clientEmail.length > 0) {
        const manageToken = buildBookingActionToken();
        const cancellationToken = buildBookingActionToken();

        await tx.bookingActionToken.create({
          data: {
            bookingId: lockedToken.bookingId,
            type: BookingActionTokenType.RESCHEDULE,
            tokenHash: manageToken.tokenHash,
            expiresAt: buildBookingSelfServiceActionExpiry(lockedToken.booking!.scheduledStartsAt),
            lastSentAt: now,
          },
        });
        await tx.bookingActionToken.create({
          data: {
            bookingId: lockedToken.bookingId,
            type: BookingActionTokenType.CANCEL,
            tokenHash: cancellationToken.tokenHash,
            expiresAt: buildBookingSelfServiceActionExpiry(lockedToken.booking!.scheduledStartsAt),
            lastSentAt: now,
          },
        });

        bookingApprovedPayload = buildBookingApprovedEmailPayload(
          lockedToken.booking!,
          buildBookingManagementUrl(manageToken.rawToken),
          buildBookingCancellationUrl(cancellationToken.rawToken),
        );
      } else {
        bookingApprovedPayload = {
          bookingId: lockedToken.booking!.id,
          serviceId: lockedToken.booking!.serviceId,
          serviceName: lockedToken.booking!.serviceNameSnapshot,
          clientName: lockedToken.booking!.clientNameSnapshot,
          scheduledStartsAt: lockedToken.booking!.scheduledStartsAt.toISOString(),
          scheduledEndsAt: lockedToken.booking!.scheduledEndsAt.toISOString(),
        };
      }

      if (clientEmail.length > 0) {
        await tx.emailLog.create({
          data: {
            bookingId: lockedToken.bookingId,
            clientId: lockedToken.booking?.clientId,
            actionTokenId: lockedToken.id,
            type:
              targetStatus === BookingStatus.CONFIRMED
                ? EmailLogType.BOOKING_CONFIRMED
                : EmailLogType.BOOKING_CANCELLED,
            audience: EmailAudience.CLIENT,
            status: env.EMAIL_DELIVERY_MODE === "background" ? undefined : EmailLogStatus.SENT,
            attemptCount: env.EMAIL_DELIVERY_MODE === "background" ? undefined : 1,
            nextAttemptAt: env.EMAIL_DELIVERY_MODE === "background" ? now : undefined,
            processingStartedAt: null,
            processingToken: null,
            recipientEmail: clientEmail,
            subject:
              targetStatus === BookingStatus.CONFIRMED
                ? `Rezervace potvrzena: ${lockedToken.booking?.serviceNameSnapshot ?? ""}`
                : `Rezervace nebyla potvrzena: ${lockedToken.booking?.serviceNameSnapshot ?? ""}`,
            templateKey:
              targetStatus === BookingStatus.CONFIRMED ? "booking-approved-v1" : "booking-rejected-v1",
            payload: env.EMAIL_DELIVERY_MODE === "background"
              ? bookingApprovedPayload
              : scrubSensitiveEmailPayload(bookingApprovedPayload),
            provider: env.EMAIL_DELIVERY_MODE === "background" ? undefined : "log",
            sentAt: env.EMAIL_DELIVERY_MODE === "background" ? undefined : now,
          },
        });
      }

      return {
        status: "completed" as const,
        intent,
        resultTitle: copy.resultTitle,
        resultDescription: clientEmail.length > 0
          ? copy.resultDescription
          : "Rezervace byla zpracována, ale klientský e-mail nebyl vytvořen, protože klientka nemá aktuální e-mail.",
        emailDeliveryStatus: clientEmail.length > 0
          ? env.EMAIL_DELIVERY_MODE === "background" ? "queued" as const : "logged" as const
          : "skipped" as const,
        details: toActionDetails(lockedToken.booking!),
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  if (transactionResult.status !== "completed") {
    return transactionResult;
  }

  await sendOwnerBookingPushover({
    type: intent === "approve" ? "BOOKING_CONFIRMED" : "BOOKING_CANCELLED",
    bookingId: transactionResult.details.bookingId,
    sourceLabel: "Email akce",
  });

  return {
    status: "completed",
    intent,
    resultTitle: transactionResult.resultTitle,
    resultDescription: transactionResult.resultDescription,
    emailDeliveryStatus: transactionResult.emailDeliveryStatus,
    ...transactionResult.details,
  };
}
