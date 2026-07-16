import { BookingSubmissionOutcome, Prisma } from "@prisma/client";
import { createHash } from "node:crypto";

import { env } from "@/config/env";
import { getTrustedClientIp } from "@/lib/http/trusted-client-ip";
import { prisma } from "@/lib/prisma";

const ADMIN_INVITE_ACTIVATION_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const ADMIN_INVITE_ACTIVATION_MAX_ATTEMPTS_PER_IP = 10;
const ADMIN_INVITE_ACTIVATION_FAILURE_CODE_PREFIX = "ADMIN_INVITE_ACTIVATION_";

export type AdminInviteActivationAuditOutcome =
  | "SUCCESS"
  | "INVALID"
  | "ALREADY_USED"
  | "EXPIRED"
  | "USER_INACTIVE"
  | "RATE_LIMITED";

const outcomeToLogMapping: Record<
  AdminInviteActivationAuditOutcome,
  {
    outcome: BookingSubmissionOutcome;
    failureCode: string;
    failureReason: string;
  }
> = {
  SUCCESS: {
    outcome: BookingSubmissionOutcome.SUCCESS,
    failureCode: `${ADMIN_INVITE_ACTIVATION_FAILURE_CODE_PREFIX}SUCCESS`,
    failureReason: "Aktivace administrátorské pozvánky proběhla úspěšně.",
  },
  INVALID: {
    outcome: BookingSubmissionOutcome.FAILED,
    failureCode: `${ADMIN_INVITE_ACTIVATION_FAILURE_CODE_PREFIX}INVALID`,
    failureReason: "Administrátorská pozvánka není platná.",
  },
  ALREADY_USED: {
    outcome: BookingSubmissionOutcome.FAILED,
    failureCode: `${ADMIN_INVITE_ACTIVATION_FAILURE_CODE_PREFIX}ALREADY_USED`,
    failureReason: "Administrátorská pozvánka už byla použitá nebo zneplatněná.",
  },
  EXPIRED: {
    outcome: BookingSubmissionOutcome.FAILED,
    failureCode: `${ADMIN_INVITE_ACTIVATION_FAILURE_CODE_PREFIX}EXPIRED`,
    failureReason: "Administrátorská pozvánka vypršela.",
  },
  USER_INACTIVE: {
    outcome: BookingSubmissionOutcome.FAILED,
    failureCode: `${ADMIN_INVITE_ACTIVATION_FAILURE_CODE_PREFIX}USER_INACTIVE`,
    failureReason: "Účet administrátorské pozvánky je deaktivovaný.",
  },
  RATE_LIMITED: {
    outcome: BookingSubmissionOutcome.BLOCKED,
    failureCode: `${ADMIN_INVITE_ACTIVATION_FAILURE_CODE_PREFIX}RATE_LIMITED`,
    failureReason: "Příliš mnoho pokusů o aktivaci administrátorské pozvánky v krátkém čase.",
  },
};

function hashInviteActivationFingerprint(value: string) {
  return createHash("sha256").update(`${env.ADMIN_SESSION_SECRET}:${value}`).digest("hex");
}

export function getAdminInviteActivationAttemptMetadata(requestHeaders: Headers) {
  const clientIp = getTrustedClientIp(requestHeaders);
  const userAgent = requestHeaders.get("user-agent")?.slice(0, 256) ?? undefined;

  return {
    ipHash: clientIp ? hashInviteActivationFingerprint(clientIp) : undefined,
    userAgent,
  };
}

export async function getRecentAdminInviteActivationAttemptCount(ipHash?: string) {
  if (!ipHash) {
    return 0;
  }

  return prisma.bookingSubmissionLog.count({
    where: {
      ipHash,
      createdAt: {
        gte: new Date(Date.now() - ADMIN_INVITE_ACTIVATION_ATTEMPT_WINDOW_MS),
      },
      failureCode: {
        startsWith: ADMIN_INVITE_ACTIVATION_FAILURE_CODE_PREFIX,
      },
    },
  });
}

export function isAdminInviteActivationRateLimited(ipAttempts: number) {
  return ipAttempts >= ADMIN_INVITE_ACTIVATION_MAX_ATTEMPTS_PER_IP;
}

export async function writeAdminInviteActivationAttemptLog({
  auditOutcome,
  ipHash,
  userAgent,
  metadata,
}: {
  auditOutcome: AdminInviteActivationAuditOutcome;
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
    console.error("Failed to write admin invite activation audit log", error);
  }
}
