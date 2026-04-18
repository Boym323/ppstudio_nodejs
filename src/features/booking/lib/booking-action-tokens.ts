import { createHash, randomBytes } from "node:crypto";

import { env } from "@/config/env";

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

export function buildBookingCancellationUrl(rawToken: string) {
  return `${env.NEXT_PUBLIC_APP_URL}/rezervace/storno/${rawToken}`;
}
