import { EmailLogStatus } from "@prisma/client";
import packageJson from "../../../../package.json";

import { sendOwnerSystemErrorPushover } from "@/lib/notifications/pushover";
import { prisma } from "@/lib/prisma";
import { getUnresolvedEmailDeliveryFailureWhere } from "@/lib/email/incidents";

const DEPLOYMENT_ID_ENV_KEYS = [
  "NEXT_DEPLOYMENT_ID",
  "DEPLOYMENT_VERSION",
  "GIT_HASH",
] as const;
const WORKER_LOCK_TIMEOUT_MS = 10 * 60 * 1000;
const RECENT_EMAIL_ERROR_WINDOW_MS = 24 * 60 * 60 * 1000;
const DB_UNAVAILABLE_ERROR_CODE = "DATABASE_UNAVAILABLE";
const EMAIL_HEALTH_UNAVAILABLE_ERROR_CODE = "EMAIL_HEALTH_UNAVAILABLE";
const DB_FAILURE_ALERT_COOLDOWN_MS = 10 * 60 * 1000;

type HealthRouteDependencies = {
  checkDatabase: () => Promise<unknown>;
  getEmailHealthData: (now: Date) => Promise<EmailHealthData>;
  notifySystemError: typeof sendOwnerSystemErrorPushover;
  logEmailHealthError: (error: unknown) => void;
  now: () => Date;
  claimDbFailureAlert: (nowMs: number) => boolean;
};

export type EmailHealthData = {
  pending: number;
  retrying: number;
  processingActive: number;
  processingStale: number;
  failed: number;
  lastSentAt: Date | null;
  latestError: {
    errorMessage: string | null;
    updatedAt: Date;
  } | null;
};

export function createDbFailureAlertCooldown(
  cooldownMs = DB_FAILURE_ALERT_COOLDOWN_MS,
) {
  let lastAlertAtMs: number | null = null;

  return (nowMs: number) => {
    if (lastAlertAtMs !== null && nowMs - lastAlertAtMs < cooldownMs) {
      return false;
    }

    lastAlertAtMs = nowMs;
    return true;
  };
}
const claimDbFailureAlert = createDbFailureAlertCooldown();

async function getEmailHealthData(now: Date): Promise<EmailHealthData> {
  const staleThreshold = new Date(now.getTime() - WORKER_LOCK_TIMEOUT_MS);
  const recentErrorThreshold = new Date(
    now.getTime() - RECENT_EMAIL_ERROR_WINDOW_MS,
  );
  const [
    pending,
    retrying,
    processingActive,
    processingStale,
    failed,
    lastSentLog,
    latestError,
  ] = await Promise.all([
    prisma.emailLog.count({
      where: {
        status: EmailLogStatus.PENDING,
        attemptCount: 0,
        processingStartedAt: null,
        nextAttemptAt: { lte: now },
      },
    }),
    prisma.emailLog.count({
      where: {
        status: EmailLogStatus.PENDING,
        attemptCount: { gt: 0 },
        processingStartedAt: null,
      },
    }),
    prisma.emailLog.count({
      where: {
        status: EmailLogStatus.PENDING,
        processingStartedAt: { not: null, gte: staleThreshold },
      },
    }),
    prisma.emailLog.count({
      where: {
        status: EmailLogStatus.PENDING,
        processingStartedAt: { lt: staleThreshold },
      },
    }),
    prisma.emailLog.count({
      where: getUnresolvedEmailDeliveryFailureWhere(),
    }),
    prisma.emailLog.findFirst({
      where: {
        status: EmailLogStatus.SENT,
        sentAt: { not: null },
      },
      orderBy: {
        sentAt: "desc",
      },
      select: {
        sentAt: true,
      },
    }),
    prisma.emailLog.findFirst({
      where: {
        errorMessage: { not: null },
        updatedAt: { gte: recentErrorThreshold },
        OR: [
          getUnresolvedEmailDeliveryFailureWhere(),
          {
            status: EmailLogStatus.PENDING,
            attemptCount: { gt: 0 },
          },
        ],
      },
      orderBy: { updatedAt: "desc" },
      select: {
        errorMessage: true,
        updatedAt: true,
      },
    }),
  ]);

  return {
    pending,
    retrying,
    processingActive,
    processingStale,
    failed,
    lastSentAt: lastSentLog?.sentAt ?? null,
    latestError,
  };
}
function getCurrentDeploymentId() {
  for (const key of DEPLOYMENT_ID_ENV_KEYS) {
    const value = process.env[key];

    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

export function createHealthRouteApi(
  overrides: Partial<HealthRouteDependencies> = {},
) {
  const dependencies: HealthRouteDependencies = {
    checkDatabase: () => prisma.$queryRaw`SELECT 1`,
    getEmailHealthData,
    notifySystemError: sendOwnerSystemErrorPushover,
    logEmailHealthError: (error) => {
      console.error("Health email status check failed", { error });
    },
    now: () => new Date(),
    claimDbFailureAlert,
    ...overrides,
  };

  return {
    GET: async () => {
      const startedAtMs = Date.now();
      const now = dependencies.now();
      const nowMs = now.getTime();
      const release = {
        version: packageJson.version,
        deploymentId: getCurrentDeploymentId(),
        deploymentVersion: process.env.DEPLOYMENT_VERSION?.trim() || null,
        gitHash: process.env.GIT_HASH?.trim() || null,
      };

      const alerts: string[] = [];
      let dbStatus: "ok" | "error" = "ok";

      try {
        await dependencies.checkDatabase();
      } catch {
        dbStatus = "error";
        alerts.push("DB check failed");

        if (dependencies.claimDbFailureAlert(nowMs)) {
          void dependencies
            .notifySystemError({
              title: "PP Studio - systemova chyba",
              message: "Health endpoint zjistil nedostupnou databazi.",
              context: {
                contextId: "health-db-check",
              },
            })
            .catch((notificationError) => {
              console.error("Health DB failure Pushover dispatch failed", {
                notificationError,
              });
            });
        }

        return Response.json(
          {
            status: "error",
            checkedAt: now.toISOString(),
            durationMs: Date.now() - startedAtMs,
            release,
            db: {
              status: dbStatus,
            },
            emailWorker: {
              status: "unknown",
              staleClaimTimeoutMs: WORKER_LOCK_TIMEOUT_MS,
              summary: "Nelze vyhodnotit bez funkční DB.",
            },
            emailQueue: {
              pending: 0,
              retrying: 0,
              processing: 0,
              staleProcessing: 0,
              failed: 0,
            },
            emailIncidents: {
              status: "unknown",
              active: 0,
            },
            emailDelivery: {
              lastSentAt: null,
              lastErrorAt: null,
              hasRecentError: false,
              recentErrorWindowMs: RECENT_EMAIL_ERROR_WINDOW_MS,
            },
            alerts,
            error: {
              code: DB_UNAVAILABLE_ERROR_CODE,
            },
          },
          {
            status: 503,
            headers: {
              "cache-control": "no-store",
            },
          },
        );
      }

      let emailHealthData: EmailHealthData;

      try {
        emailHealthData = await dependencies.getEmailHealthData(now);
      } catch (healthDataError) {
        dependencies.logEmailHealthError(healthDataError);

        return Response.json(
          {
            status: "warning",
            checkedAt: now.toISOString(),
            durationMs: Date.now() - startedAtMs,
            release,
            db: {
              status: "ok",
            },
            emailWorker: {
              status: "unknown",
              staleClaimTimeoutMs: WORKER_LOCK_TIMEOUT_MS,
              summary: "Detailní stav e-mailové fronty není dostupný.",
            },
            emailQueue: {
              pending: 0,
              retrying: 0,
              processing: 0,
              staleProcessing: 0,
              failed: 0,
            },
            emailIncidents: {
              status: "unknown",
              active: 0,
            },
            emailDelivery: {
              lastSentAt: null,
              lastErrorAt: null,
              hasRecentError: false,
              recentErrorWindowMs: RECENT_EMAIL_ERROR_WINDOW_MS,
            },
            alerts: ["Email health check unavailable"],
            error: {
              code: EMAIL_HEALTH_UNAVAILABLE_ERROR_CODE,
            },
          },
          {
            status: 200,
            headers: {
              "cache-control": "no-store",
            },
          },
        );
      }

      const {
        pending,
        retrying,
        processingActive,
        processingStale,
        failed: activeIncidents,
        lastSentAt,
        latestError,
      } = emailHealthData;

      const workerStuck = processingStale > 0;
      const workerBacklog = pending + retrying > 0 && processingActive === 0;
      const hasActiveEmailIncidents = activeIncidents > 0;

      if (hasActiveEmailIncidents) {
        alerts.push(`Active email delivery incidents: ${activeIncidents}`);
      }

      if (workerStuck) {
        alerts.push(`Stale processing claims: ${processingStale}`);
      }

      if (workerBacklog) {
        alerts.push(
          "Email queue has pending/retry items without active worker claim",
        );
      }

      if (latestError?.errorMessage) {
        alerts.push("Recent email error present");
      }

      const workerStatus =
        workerStuck
          ? "error"
          : workerBacklog
            ? "warning"
            : "ok";

      const status =
        workerStatus === "error"
          ? "error"
          : workerStatus === "warning" || hasActiveEmailIncidents
            ? "warning"
            : "ok";

      return Response.json(
        {
          status,
          checkedAt: now.toISOString(),
          durationMs: Date.now() - startedAtMs,
          release,
          db: {
            status: dbStatus,
          },
          emailWorker: {
            status: workerStatus,
            staleClaimTimeoutMs: WORKER_LOCK_TIMEOUT_MS,
            summary:
              workerStatus === "ok"
                ? "Worker frontu zpracovává bez aktivní chyby."
                : workerStatus === "warning"
                  ? "Fronta čeká na zpracování nebo retry, ale není vidět aktivní claim."
                  : "Worker vyžaduje zásah kvůli stale processing claimu.",
          },
          emailQueue: {
            pending,
            retrying,
            processing: processingActive,
            staleProcessing: processingStale,
            failed: activeIncidents,
          },
          emailIncidents: {
            status: hasActiveEmailIncidents ? "warning" : "ok",
            active: activeIncidents,
          },
          emailDelivery: {
            lastSentAt: lastSentAt?.toISOString() ?? null,
            lastErrorAt: latestError?.updatedAt?.toISOString() ?? null,
            hasRecentError: Boolean(latestError?.errorMessage),
            recentErrorWindowMs: RECENT_EMAIL_ERROR_WINDOW_MS,
          },
          alerts,
        },
        {
          status: status === "error" ? 503 : 200,
          headers: {
            "cache-control": "no-store",
          },
        },
      );
    },
  };
}
