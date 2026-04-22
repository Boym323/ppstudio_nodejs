import { createHash, randomBytes } from "node:crypto";

import { env } from "@/config/env";

const BOOKING_ACTION_TOKEN_TTL_DAYS = 30;
const BOOKING_EMAIL_ACTION_TOKEN_TTL_DAYS = 7;

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

export function buildBookingEmailActionExpiry(now = new Date()) {
  return buildBookingActionExpiry(now, BOOKING_EMAIL_ACTION_TOKEN_TTL_DAYS);
}

export function buildBookingCancellationUrl(rawToken: string) {
  return `${env.NEXT_PUBLIC_APP_URL}/rezervace/storno/${rawToken}`;
}

export function buildBookingEmailActionUrl(intent: BookingEmailActionIntent, rawToken: string) {
  return `${env.NEXT_PUBLIC_APP_URL}/rezervace/akce/${intent}/${rawToken}`;
}
