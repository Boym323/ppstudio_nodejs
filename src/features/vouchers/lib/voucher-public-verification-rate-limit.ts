import { BookingSubmissionOutcome, Prisma } from "@prisma/client";
import { createHash } from "node:crypto";

import { env } from "@/config/env";
import { getTrustedClientIp } from "@/lib/http/trusted-client-ip";
import { prisma } from "@/lib/prisma";
import { consumeAtomicRateLimit, releaseAtomicRateLimitReservation } from "@/lib/security/atomic-rate-limit";

const VOUCHER_VERIFICATION_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const VOUCHER_VERIFICATION_MAX_ATTEMPTS_PER_IP = 10;
const VOUCHER_VERIFICATION_FAILURE_CODE_PREFIX = "PUBLIC_VOUCHER_VERIFY_";

export const publicVoucherVerificationSources = {
  publicPage: "PUBLIC_PAGE",
  publicBooking: "PUBLIC_BOOKING",
} as const;

export type PublicVoucherVerificationSource =
  (typeof publicVoucherVerificationSources)[keyof typeof publicVoucherVerificationSources];

export type PublicVoucherVerificationAuditOutcome =
  | "SUCCESS"
  | "NOT_FOUND_OR_INVALID"
  | "RATE_LIMITED"
  | "UNKNOWN_ERROR";

const outcomeToLogMapping: Record<
  PublicVoucherVerificationAuditOutcome,
  {
    outcome: BookingSubmissionOutcome;
    failureCode: string;
    failureReason: string;
  }
> = {
  SUCCESS: {
    outcome: BookingSubmissionOutcome.SUCCESS,
    failureCode: "SUCCESS",
    failureReason: "Veřejné ověření voucheru proběhlo úspěšně.",
  },
  NOT_FOUND_OR_INVALID: {
    outcome: BookingSubmissionOutcome.FAILED,
    failureCode: "NOT_FOUND_OR_INVALID",
    failureReason: "Veřejné ověření voucheru neprošlo.",
  },
  RATE_LIMITED: {
    outcome: BookingSubmissionOutcome.BLOCKED,
    failureCode: "RATE_LIMITED",
    failureReason: "Příliš mnoho pokusů o veřejné ověření voucheru v krátkém čase.",
  },
  UNKNOWN_ERROR: {
    outcome: BookingSubmissionOutcome.FAILED,
    failureCode: "UNKNOWN_ERROR",
    failureReason: "Veřejné ověření voucheru selhalo interní chybou.",
  },
};

function hashVoucherVerificationFingerprint(value: string) {
  return createHash("sha256").update(`${env.ADMIN_SESSION_SECRET}:${value}`).digest("hex");
}

function extractClientIp(requestHeaders: Headers) {
  return getTrustedClientIp(requestHeaders);
}

export function getVoucherPublicVerificationMetadata(requestHeaders: Headers) {
  const clientIp = extractClientIp(requestHeaders);
  const userAgent = requestHeaders.get("user-agent")?.slice(0, 256) ?? undefined;

  return {
    ipHash: clientIp ? hashVoucherVerificationFingerprint(clientIp) : undefined,
    userAgent,
  };
}

export function getVoucherPublicVerificationFailureCode(
  source: PublicVoucherVerificationSource,
  auditOutcome: PublicVoucherVerificationAuditOutcome,
) {
  return `${VOUCHER_VERIFICATION_FAILURE_CODE_PREFIX}${source}_${outcomeToLogMapping[auditOutcome].failureCode}`;
}

export function isVoucherPublicVerificationGuessingAttempt(auditOutcome: PublicVoucherVerificationAuditOutcome) {
  return auditOutcome === "NOT_FOUND_OR_INVALID";
}

export function getVoucherPublicVerificationAttemptWhere({
  ipHash,
  source,
  windowStart,
}: {
  ipHash: string;
  source: PublicVoucherVerificationSource;
  windowStart: Date;
}): Prisma.BookingSubmissionLogWhereInput {
  return {
    ipHash,
    createdAt: {
      gte: windowStart,
    },
    failureCode: {
      equals: getVoucherPublicVerificationFailureCode(source, "NOT_FOUND_OR_INVALID"),
    },
  };
}

export function isVoucherPublicVerificationRateLimited(ipAttempts: number) {
  return ipAttempts >= VOUCHER_VERIFICATION_MAX_ATTEMPTS_PER_IP;
}

export function consumeVoucherPublicVerificationRateLimit({ ipHash, source }: { ipHash?: string; source: PublicVoucherVerificationSource }) {
  return consumeAtomicRateLimit({ scope: `public-voucher-verification-${source}`, fingerprint: ipHash, limit: VOUCHER_VERIFICATION_MAX_ATTEMPTS_PER_IP, windowMs: VOUCHER_VERIFICATION_ATTEMPT_WINDOW_MS });
}

export const releaseVoucherPublicVerificationReservation = releaseAtomicRateLimitReservation;

export async function writeVoucherPublicVerificationAttemptLog({
  auditOutcome,
  source,
  ipHash,
  userAgent,
  metadata,
}: {
  auditOutcome: PublicVoucherVerificationAuditOutcome;
  source: PublicVoucherVerificationSource;
  ipHash?: string;
  userAgent?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  const mapping = outcomeToLogMapping[auditOutcome];

  try {
    await prisma.bookingSubmissionLog.create({
      data: {
        outcome: mapping.outcome,
        failureCode: getVoucherPublicVerificationFailureCode(source, auditOutcome),
        failureReason: mapping.failureReason,
        ipHash,
        userAgent,
        metadata,
      },
    });
  } catch (error) {
    console.error("Failed to write public voucher verification audit log", error);
  }
}
