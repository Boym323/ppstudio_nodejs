import {
  BookingActorType,
  BookingActionTokenType,
  BookingSource,
  BookingStatus,
  EmailLogType,
  Prisma,
} from "@prisma/client";

import { hashBookingActionToken } from "@/features/booking/lib/booking-action-tokens";
import { formatBookingDateLabel } from "@/features/booking/lib/booking-format";
import { deliverEmailLog } from "@/lib/email/delivery";
import { prisma } from "@/lib/prisma";

const CANCELLABLE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
];

type CancellationPageStateBase = {
  referenceCode?: string;
  serviceName?: string;
  clientName?: string;
  scheduledAtLabel?: string;
};

export type PublicCancellationPageState =
  | (CancellationPageStateBase & {
      status: "ready";
      expiresAt: string;
    })
  | (CancellationPageStateBase & {
      status: "already_cancelled" | "expired" | "invalid" | "not_cancellable";
      message: string;
    });

export type CancelPublicBookingResult =
  | {
      status: "cancelled";
      referenceCode: string;
      serviceName: string;
      clientName: string;
      scheduledAtLabel: string;
      emailDeliveryStatus: "sent" | "failed" | "skipped";
    }
  | {
      status: "already_cancelled" | "expired" | "invalid" | "not_cancellable";
      message: string;
      referenceCode?: string;
      serviceName?: string;
      clientName?: string;
      scheduledAtLabel?: string;
    };

type LoadedCancellationToken = {
  id: string;
  bookingId: string;
  type: BookingActionTokenType;
  expiresAt: Date;
  usedAt: Date | null;
  revokedAt: Date | null;
  booking: {
    id: string;
    status: BookingStatus;
    cancelledAt: Date | null;
    clientId: string;
    clientEmailSnapshot: string;
    clientNameSnapshot: string;
    serviceNameSnapshot: string;
    scheduledStartsAt: Date;
    scheduledEndsAt: Date;
  };
};

function toCancellationDetails(token: LoadedCancellationToken) {
  return {
    referenceCode: token.booking.id.slice(-8).toUpperCase(),
    serviceName: token.booking.serviceNameSnapshot,
    clientName: token.booking.clientNameSnapshot,
    scheduledAtLabel: formatBookingDateLabel(
      token.booking.scheduledStartsAt,
      token.booking.scheduledEndsAt,
    ),
  };
}

async function findCancellationToken(tokenHash: string) {
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
          cancelledAt: true,
          clientId: true,
          clientEmailSnapshot: true,
          clientNameSnapshot: true,
          serviceNameSnapshot: true,
          scheduledStartsAt: true,
          scheduledEndsAt: true,
        },
      },
    },
  });
}

function resolveCancellationState(token: LoadedCancellationToken | null): PublicCancellationPageState {
  if (!token) {
    return {
      status: "invalid",
      message: "Storno odkaz je neplatný nebo už neexistuje.",
    };
  }

  const details = toCancellationDetails(token);

  if (token.type !== BookingActionTokenType.CANCEL) {
    return {
      status: "invalid",
      message: "Tento odkaz neslouží pro storno rezervace.",
      ...details,
    };
  }

  if (token.revokedAt) {
    return {
      status: "invalid",
      message: "Tento storno odkaz už není aktivní.",
      ...details,
    };
  }

  if (token.expiresAt <= new Date()) {
    return {
      status: "expired",
      message: "Platnost storno odkazu už vypršela. Pokud potřebujete pomoc, kontaktujte salon.",
      ...details,
    };
  }

  if (token.booking.status === BookingStatus.CANCELLED || token.usedAt || token.booking.cancelledAt) {
    return {
      status: "already_cancelled",
      message: "Rezervace už byla dříve zrušena.",
      ...details,
    };
  }

  if (!CANCELLABLE_BOOKING_STATUSES.includes(token.booking.status)) {
    return {
      status: "not_cancellable",
      message: "Tuto rezervaci už nejde přes storno odkaz upravit. Kontaktujte prosím salon.",
      ...details,
    };
  }

  return {
    status: "ready",
    expiresAt: token.expiresAt.toISOString(),
    ...details,
  };
}

export async function getPublicCancellationPageState(rawToken: string): Promise<PublicCancellationPageState> {
  const tokenHash = hashBookingActionToken(rawToken);
  const token = await findCancellationToken(tokenHash);

  return resolveCancellationState(token);
}

export async function cancelPublicBookingByToken(rawToken: string): Promise<CancelPublicBookingResult> {
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
              cancelledAt: true,
              clientId: true,
              clientEmailSnapshot: true,
              clientNameSnapshot: true,
              serviceNameSnapshot: true,
              scheduledStartsAt: true,
              scheduledEndsAt: true,
            },
          },
        },
      });

      const state = resolveCancellationState(token);

      if (state.status !== "ready") {
        return state;
      }

      const lockedToken = token as LoadedCancellationToken;
      const now = new Date();

      await tx.booking.update({
        where: {
          id: lockedToken.booking.id,
        },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: now,
        },
      });

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
          type: BookingActionTokenType.CANCEL,
          id: {
            not: lockedToken.id,
          },
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: lockedToken.booking.id,
          status: BookingStatus.CANCELLED,
          actorType: BookingActorType.CLIENT,
          reason: "public-cancellation-flow-v1",
          metadata: {
            source: BookingSource.PUBLIC_WEB,
            via: "cancellation-token",
          },
        },
      });

      const emailLog = await tx.emailLog.create({
        data: {
          bookingId: lockedToken.booking.id,
          clientId: lockedToken.booking.clientId,
          actionTokenId: lockedToken.id,
          type: EmailLogType.BOOKING_CANCELLED,
          recipientEmail: lockedToken.booking.clientEmailSnapshot,
          subject: `Storno potvrzeno: ${lockedToken.booking.serviceNameSnapshot}`,
          templateKey: "booking-cancelled-v1",
          payload: {
            bookingId: lockedToken.booking.id,
            serviceName: lockedToken.booking.serviceNameSnapshot,
            clientName: lockedToken.booking.clientNameSnapshot,
            scheduledStartsAt: lockedToken.booking.scheduledStartsAt.toISOString(),
            scheduledEndsAt: lockedToken.booking.scheduledEndsAt.toISOString(),
          },
        },
        select: {
          id: true,
        },
      });

      return {
        status: "ready" as const,
        details: toCancellationDetails(lockedToken),
        emailLogId: emailLog.id,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  if (transactionResult.status !== "ready") {
    return transactionResult;
  }

  const emailDelivery = await deliverEmailLog(transactionResult.emailLogId);

  return {
    status: "cancelled",
    ...transactionResult.details,
    emailDeliveryStatus: emailDelivery.status,
  };
}
