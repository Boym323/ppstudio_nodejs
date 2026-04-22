import { createHash, randomBytes } from "node:crypto";

import { env } from "@/config/env";

const INVITE_TOKEN_TTL_DAYS = 7;

export function buildAdminInviteToken() {
  const rawToken = randomBytes(32).toString("base64url");

  return {
    rawToken,
    tokenHash: hashAdminInviteToken(rawToken),
    expiresAt: buildAdminInviteExpiry(),
  };
}

export function hashAdminInviteToken(rawToken: string) {
  return createHash("sha256").update(`${env.ADMIN_SESSION_SECRET}:${rawToken}`).digest("hex");
}

export function buildAdminInviteUrl(rawToken: string) {
  return `${env.NEXT_PUBLIC_APP_URL}/admin/pozvanka/${rawToken}`;
}

function buildAdminInviteExpiry(now = new Date()) {
  return new Date(now.getTime() + INVITE_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}
