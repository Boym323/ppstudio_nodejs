import { BookingSubmissionOutcome, Prisma } from "@prisma/client";
import { createHash } from "node:crypto";

import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";

const ADMIN_LOGIN_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const ADMIN_LOGIN_MAX_ATTEMPTS_PER_IP = 20;
const ADMIN_LOGIN_MAX_FAILED_ATTEMPTS_PER_EMAIL = 6;

const ADMIN_LOGIN_FAILURE_CODE_PREFIX = "ADMIN_LOGIN_";

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
  const forwardedFor = requestHeaders.get("x-forwarded-for");

  if (forwardedFor) {
    const firstForwardedIp = forwardedFor.split(",")[0]?.trim();
    if (firstForwardedIp) {
      return firstForwardedIp;
    }
  }

  return (
    requestHeaders.get("cf-connecting-ip") ??
    requestHeaders.get("x-real-ip") ??
    requestHeaders.get("x-vercel-forwarded-for") ??
    undefined
  );
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

export async function getRecentAdminLoginAttemptCounts({
  ipHash,
  emailHash,
}: {
  ipHash?: string;
  emailHash?: string;
}) {
  const windowStart = new Date(Date.now() - ADMIN_LOGIN_ATTEMPT_WINDOW_MS);

  const [ipAttempts, emailFailures] = await Promise.all([
    ipHash
      ? prisma.bookingSubmissionLog.count({
          where: {
            ipHash,
            createdAt: {
              gte: windowStart,
            },
            failureCode: {
              startsWith: ADMIN_LOGIN_FAILURE_CODE_PREFIX,
            },
          },
        })
      : Promise.resolve(0),
    emailHash
      ? prisma.bookingSubmissionLog.count({
          where: {
            emailHash,
            createdAt: {
              gte: windowStart,
            },
            outcome: {
              in: [BookingSubmissionOutcome.FAILED, BookingSubmissionOutcome.BLOCKED],
            },
            failureCode: {
              startsWith: ADMIN_LOGIN_FAILURE_CODE_PREFIX,
            },
          },
        })
      : Promise.resolve(0),
  ]);

  return { ipAttempts, emailFailures };
}

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
