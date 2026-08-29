import {
  BookingActionTokenType,
  EmailAudience,
  EmailLogStatus,
  Prisma,
} from "@/generated/prisma/client";

import { issueBookingClientActionTokens } from "@/features/booking/lib/booking-action-tokens";
import { normalizeClientEmail } from "@/features/booking/lib/booking-public";

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

  await tx.bookingActionToken.updateMany({
    where: {
      bookingId: {
        in: input.bookingIds,
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

  if (!input.newEmail) {
    return;
  }

  const pendingClientEmailLogs = await tx.emailLog.findMany({
    where: {
      clientId: input.clientId,
      bookingId: {
        in: input.bookingIds,
      },
      status: EmailLogStatus.PENDING,
      audience: EmailAudience.CLIENT,
      processingStartedAt: null,
      actionTokenId: {
        not: null,
      },
    },
    select: {
      id: true,
      payload: true,
      booking: {
        select: {
          id: true,
          scheduledStartsAt: true,
        },
      },
    },
  });

  for (const emailLog of pendingClientEmailLogs) {
    if (!emailLog.booking) {
      continue;
    }

    const clientTokens = await issueBookingClientActionTokens(tx, {
      bookingId: emailLog.booking.id,
      scheduledStartsAt: emailLog.booking.scheduledStartsAt,
      now: input.now,
    });
    const basePayload = emailLog.payload
      && typeof emailLog.payload === "object"
      && !Array.isArray(emailLog.payload)
      ? { ...(emailLog.payload as Record<string, Prisma.JsonValue>) }
      : {};

    await tx.emailLog.update({
      where: { id: emailLog.id },
      data: {
        recipientEmail: input.newEmail,
        actionTokenId: clientTokens.actionTokenId,
        payload: {
          ...basePayload,
          manageReservationUrl: clientTokens.manageReservationUrl,
          cancellationUrl: clientTokens.cancellationUrl,
        } satisfies Prisma.InputJsonObject,
      },
    });
  }
}
