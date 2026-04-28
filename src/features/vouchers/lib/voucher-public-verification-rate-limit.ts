import { BookingSubmissionOutcome, Prisma } from "@prisma/client";
import { createHash } from "node:crypto";

import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";

const VOUCHER_VERIFICATION_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const VOUCHER_VERIFICATION_MAX_ATTEMPTS_PER_IP = 10;
const VOUCHER_VERIFICATION_FAILURE_CODE_PREFIX = "PUBLIC_VOUCHER_VERIFY_";

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
    failureCode: `${VOUCHER_VERIFICATION_FAILURE_CODE_PREFIX}SUCCESS`,
    failureReason: "Veřejné ověření voucheru proběhlo úspěšně.",
  },
  NOT_FOUND_OR_INVALID: {
    outcome: BookingSubmissionOutcome.FAILED,
    failureCode: `${VOUCHER_VERIFICATION_FAILURE_CODE_PREFIX}NOT_FOUND_OR_INVALID`,
    failureReason: "Veřejné ověření voucheru neprošlo.",
  },
  RATE_LIMITED: {
    outcome: BookingSubmissionOutcome.BLOCKED,
    failureCode: `${VOUCHER_VERIFICATION_FAILURE_CODE_PREFIX}RATE_LIMITED`,
    failureReason: "Příliš mnoho pokusů o veřejné ověření voucheru v krátkém čase.",
  },
  UNKNOWN_ERROR: {
    outcome: BookingSubmissionOutcome.FAILED,
    failureCode: `${VOUCHER_VERIFICATION_FAILURE_CODE_PREFIX}UNKNOWN_ERROR`,
    failureReason: "Veřejné ověření voucheru selhalo interní chybou.",
  },
};

function hashVoucherVerificationFingerprint(value: string) {
  return createHash("sha256").update(`${env.ADMIN_SESSION_SECRET}:${value}`).digest("hex");
}

function extractClientIp(requestHeaders: Headers) {
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

export function getVoucherPublicVerificationMetadata(requestHeaders: Headers) {
  const clientIp = extractClientIp(requestHeaders);
  const userAgent = requestHeaders.get("user-agent")?.slice(0, 256) ?? undefined;

  return {
    ipHash: clientIp ? hashVoucherVerificationFingerprint(clientIp) : undefined,
    userAgent,
  };
}

export async function getRecentVoucherPublicVerificationAttemptCount(ipHash?: string) {
  if (!ipHash) {
    return 0;
  }

  const windowStart = new Date(Date.now() - VOUCHER_VERIFICATION_ATTEMPT_WINDOW_MS);

  return prisma.bookingSubmissionLog.count({
    where: {
      ipHash,
      createdAt: {
        gte: windowStart,
      },
      failureCode: {
        startsWith: VOUCHER_VERIFICATION_FAILURE_CODE_PREFIX,
      },
      outcome: {
        in: [
          BookingSubmissionOutcome.SUCCESS,
          BookingSubmissionOutcome.FAILED,
          BookingSubmissionOutcome.BLOCKED,
        ],
      },
    },
  });
}

export function isVoucherPublicVerificationRateLimited(ipAttempts: number) {
  return ipAttempts >= VOUCHER_VERIFICATION_MAX_ATTEMPTS_PER_IP;
}

export async function writeVoucherPublicVerificationAttemptLog({
  auditOutcome,
  ipHash,
  userAgent,
  metadata,
}: {
  auditOutcome: PublicVoucherVerificationAuditOutcome;
  ipHash?: string;
  userAgent?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  const mapping = outcomeToLogMapping[auditOutcome];

  try {
    await prisma.bookingSubmissionLog.create({
      data: {
        outcome: mapping.outcome,
        failureCode: mapping.failureCode,
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
