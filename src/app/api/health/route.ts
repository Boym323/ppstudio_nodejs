import { EmailLogStatus } from "@prisma/client";
import packageJson from "../../../../package.json";

import { sendOwnerSystemErrorPushover } from "@/lib/notifications/pushover";
import { prisma } from "@/lib/prisma";

const DEPLOYMENT_ID_ENV_KEYS = ["NEXT_DEPLOYMENT_ID", "DEPLOYMENT_VERSION", "GIT_HASH"] as const;
const WORKER_LOCK_TIMEOUT_MS = 10 * 60 * 1000;
const RECENT_EMAIL_ERROR_WINDOW_MS = 24 * 60 * 60 * 1000;

function getCurrentDeploymentId() {
  for (const key of DEPLOYMENT_ID_ENV_KEYS) {
    const value = process.env[key];

    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

export async function GET() {
  const startedAtMs = Date.now();
  const now = new Date();
  const nowMs = now.getTime();
  const staleThreshold = new Date(nowMs - WORKER_LOCK_TIMEOUT_MS);
  const recentErrorThreshold = new Date(nowMs - RECENT_EMAIL_ERROR_WINDOW_MS);
  const release = {
    version: packageJson.version,
    deploymentId: getCurrentDeploymentId(),
    deploymentVersion: process.env.DEPLOYMENT_VERSION?.trim() || null,
    gitHash: process.env.GIT_HASH?.trim() || null,
  };

  const alerts: string[] = [];
  let dbStatus: "ok" | "error" = "ok";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    dbStatus = "error";
    alerts.push("DB check failed");

    await sendOwnerSystemErrorPushover({
      title: "PP Studio - systemova chyba",
      message: "Health endpoint selhal pri DB kontrole.",
      context: {
        contextId: "health-db-check",
      },
      error,
    });

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
        emailDelivery: {
          lastSentAt: null,
          lastErrorAt: null,
          hasRecentError: false,
          recentErrorWindowMs: RECENT_EMAIL_ERROR_WINDOW_MS,
        },
        alerts,
        error: error instanceof Error ? error.message : "Unknown DB error",
      },
      {
        status: 503,
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  }

  const [pending, retrying, processingActive, processingStale, failed, lastSentLog, latestErrorLog] =
    await Promise.all([
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
        where: {
          status: EmailLogStatus.FAILED,
        },
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
            { status: EmailLogStatus.FAILED },
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

  const workerStuck = processingStale > 0;
  const workerBacklog = pending + retrying > 0 && processingActive === 0;
  const workerHasErrors = failed > 0;

  if (workerHasErrors) {
    alerts.push(`Failed emails: ${failed}`);
  }

  if (workerStuck) {
    alerts.push(`Stale processing claims: ${processingStale}`);
  }

  if (workerBacklog) {
    alerts.push("Email queue has pending/retry items without active worker claim");
  }

  if (latestErrorLog?.errorMessage) {
    alerts.push("Recent email error present");
  }

  const workerStatus = workerHasErrors || workerStuck ? "error" : workerBacklog ? "warning" : "ok";

  const status = workerStatus === "error" ? "error" : workerStatus === "warning" ? "warning" : "ok";

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
              : "Worker vyžaduje zásah (failed emaily nebo stale claim).",
      },
      emailQueue: {
        pending,
        retrying,
        processing: processingActive,
        staleProcessing: processingStale,
        failed,
      },
      emailDelivery: {
        lastSentAt: lastSentLog?.sentAt?.toISOString() ?? null,
        lastErrorAt: latestErrorLog?.updatedAt?.toISOString() ?? null,
        hasRecentError: Boolean(latestErrorLog?.errorMessage),
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
}
