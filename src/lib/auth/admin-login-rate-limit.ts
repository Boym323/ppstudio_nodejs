import { BookingSubmissionOutcome, Prisma } from "@prisma/client";
import { createHash } from "node:crypto";

import { env } from "@/config/env";
import { getTrustedClientIp } from "@/lib/http/trusted-client-ip";
import { prisma } from "@/lib/prisma";
import { consumeAtomicRateLimit, releaseAtomicRateLimitReservation } from "@/lib/security/atomic-rate-limit";

const ADMIN_LOGIN_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const ADMIN_LOGIN_MAX_ATTEMPTS_PER_IP = 20;
const ADMIN_LOGIN_MAX_FAILED_ATTEMPTS_PER_EMAIL = 6;

const ADMIN_LOGIN_FAILURE_CODE_PREFIX = "ADMIN_LOGIN_";
const ADMIN_LOGIN_IP_SCOPE = "admin-login-ip";
const ADMIN_LOGIN_EMAIL_SCOPE = "admin-login-email-failure";

type AdminLoginOutcome = "SUCCESS" | "INVALID_PAYLOAD" | "INVALID_CREDENTIALS" | "RATE_LIMITED";

const outcomeToLogMapping: Record<
  AdminLoginOutcome,
  {
    outcome: BookingSubmissionOutcome;
    failureCode: string;
    failureReason: string;
  }
> = {
  SUCCESS: {
    outcome: BookingSubmissionOutcome.SUCCESS,
    failureCode: `${ADMIN_LOGIN_FAILURE_CODE_PREFIX}SUCCESS`,
    failureReason: "Přihlášení proběhlo úspěšně.",
  },
  INVALID_PAYLOAD: {
    outcome: BookingSubmissionOutcome.FAILED,
    failureCode: `${ADMIN_LOGIN_FAILURE_CODE_PREFIX}INVALID_PAYLOAD`,
    failureReason: "Login formulář neprošel validací.",
  },
  INVALID_CREDENTIALS: {
    outcome: BookingSubmissionOutcome.FAILED,
    failureCode: `${ADMIN_LOGIN_FAILURE_CODE_PREFIX}INVALID_CREDENTIALS`,
    failureReason: "Neplatné přihlašovací údaje.",
  },
  RATE_LIMITED: {
    outcome: BookingSubmissionOutcome.BLOCKED,
    failureCode: `${ADMIN_LOGIN_FAILURE_CODE_PREFIX}RATE_LIMITED`,
    failureReason: "Příliš mnoho pokusů o přihlášení v krátkém čase.",
  },
};

function hashLoginFingerprint(value: string) {
  return createHash("sha256").update(`${env.ADMIN_SESSION_SECRET}:${value}`).digest("hex");
}

export function normalizeAdminLoginEmail(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

export function extractClientIp(requestHeaders: Headers) {
  return getTrustedClientIp(requestHeaders);
}

export function getAdminLoginAttemptMetadata(requestHeaders: Headers, normalizedEmail?: string) {
  const clientIp = extractClientIp(requestHeaders);
  const userAgent = requestHeaders.get("user-agent")?.slice(0, 256) ?? undefined;

  return {
    ipHash: clientIp ? hashLoginFingerprint(clientIp) : undefined,
    emailHash: normalizedEmail ? hashLoginFingerprint(normalizedEmail) : undefined,
    userAgent,
  };
}

export function isAdminLoginRateLimited({
  ipAttempts,
  emailFailures,
}: {
  ipAttempts: number;
  emailFailures: number;
}) {
  return (
    ipAttempts >= ADMIN_LOGIN_MAX_ATTEMPTS_PER_IP ||
    emailFailures >= ADMIN_LOGIN_MAX_FAILED_ATTEMPTS_PER_EMAIL
  );
}

export async function consumeAdminLoginRateLimit({ ipHash, emailHash }: { ipHash?: string; emailHash?: string }) {
  const ip = await consumeAtomicRateLimit({ scope: ADMIN_LOGIN_IP_SCOPE, fingerprint: ipHash, limit: ADMIN_LOGIN_MAX_ATTEMPTS_PER_IP, windowMs: ADMIN_LOGIN_ATTEMPT_WINDOW_MS });
  if (!ip.allowed) return { allowed: false, ipAttempts: ip.attempts, emailFailures: 0 };
  const email = await consumeAtomicRateLimit({ scope: ADMIN_LOGIN_EMAIL_SCOPE, fingerprint: emailHash, limit: ADMIN_LOGIN_MAX_FAILED_ATTEMPTS_PER_EMAIL, windowMs: ADMIN_LOGIN_ATTEMPT_WINDOW_MS });
  return { allowed: email.allowed, ipAttempts: ip.attempts, emailFailures: email.attempts, emailReservationId: email.reservationId };
}

export const releaseAdminLoginEmailReservation = releaseAtomicRateLimitReservation;

export async function writeAdminLoginAttemptLog({
  loginOutcome,
  ipHash,
  emailHash,
  userAgent,
  metadata,
}: {
  loginOutcome: AdminLoginOutcome;
  ipHash?: string;
  emailHash?: string;
  userAgent?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  const mapping = outcomeToLogMapping[loginOutcome];

  try {
    await prisma.bookingSubmissionLog.create({
      data: {
        outcome: mapping.outcome,
        failureCode: mapping.failureCode,
        failureReason: mapping.failureReason,
        ipHash,
        emailHash,
        userAgent,
        metadata,
      },
    });
  } catch (error) {
    console.error("Failed to write admin login audit log", error);
  }
}
