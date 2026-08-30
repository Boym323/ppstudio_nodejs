import { createHash, randomBytes } from "node:crypto";

import { BookingActionTokenType, type Prisma } from "@/generated/prisma/client";
import { env } from "@/config/env";

const BOOKING_ACTION_TOKEN_TTL_DAYS = 30;
const BOOKING_EMAIL_ACTION_TOKEN_TTL_DAYS = 7;
const BOOKING_SELF_SERVICE_TOKEN_GRACE_HOURS = 2;

export type BookingEmailActionIntent = "approve" | "reject";

export function buildBookingActionToken() {
  const rawToken = randomBytes(32).toString("base64url");

  return {
    rawToken,
    tokenHash: hashBookingActionToken(rawToken),
  };
}

export function hashBookingActionToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function buildBookingActionExpiry(now = new Date(), ttlDays = BOOKING_ACTION_TOKEN_TTL_DAYS) {
  return new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
}

export function buildBookingSelfServiceActionExpiry(scheduledStartsAt: Date) {
  return new Date(
    scheduledStartsAt.getTime() + BOOKING_SELF_SERVICE_TOKEN_GRACE_HOURS * 60 * 60 * 1000,
  );
}

export function buildBookingEmailActionExpiry(now = new Date()) {
  return buildBookingActionExpiry(now, BOOKING_EMAIL_ACTION_TOKEN_TTL_DAYS);
}

export async function synchronizeActiveBookingClientActionTokenExpiry(
  tx: Prisma.TransactionClient,
  input: {
    bookingId: string;
    scheduledStartsAt: Date;
    now: Date;
  },
) {
  await tx.bookingActionToken.updateMany({
    where: {
      bookingId: input.bookingId,
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
      expiresAt: buildBookingSelfServiceActionExpiry(input.scheduledStartsAt),
    },
  });
}

export function buildBookingCancellationUrl(rawToken: string) {
  return `${env.NEXT_PUBLIC_APP_URL}/rezervace/storno/${rawToken}`;
}

export function buildBookingManagementUrl(rawToken: string) {
  return `${env.NEXT_PUBLIC_APP_URL}/rezervace/sprava/${rawToken}`;
}

export function buildBookingEmailActionUrl(intent: BookingEmailActionIntent, rawToken: string) {
  return `${env.NEXT_PUBLIC_APP_URL}/rezervace/akce/${intent}/${rawToken}`;
}

export async function issueBookingClientActionTokens(
  tx: Prisma.TransactionClient,
  input: {
    bookingId: string;
    scheduledStartsAt: Date;
    now: Date;
  },
) {
  const manageToken = buildBookingActionToken();
  const cancellationToken = buildBookingActionToken();
  const expiresAt = buildBookingSelfServiceActionExpiry(input.scheduledStartsAt);
  const manageActionToken = await tx.bookingActionToken.create({
    data: {
      bookingId: input.bookingId,
      type: BookingActionTokenType.RESCHEDULE,
      tokenHash: manageToken.tokenHash,
      expiresAt,
      lastSentAt: input.now,
    },
    select: { id: true },
  });

  await tx.bookingActionToken.create({
    data: {
      bookingId: input.bookingId,
      type: BookingActionTokenType.CANCEL,
      tokenHash: cancellationToken.tokenHash,
      expiresAt,
      lastSentAt: input.now,
    },
  });

  return {
    actionTokenId: manageActionToken.id,
    manageReservationUrl: buildBookingManagementUrl(manageToken.rawToken),
    cancellationUrl: buildBookingCancellationUrl(cancellationToken.rawToken),
  };
}
