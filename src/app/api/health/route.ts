import { EmailLogStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const WORKER_LOCK_TIMEOUT_MS = 10 * 60 * 1000;

export async function GET() {
  const now = new Date();
  const nowMs = now.getTime();
  const staleThreshold = new Date(nowMs - WORKER_LOCK_TIMEOUT_MS);

  const alerts: string[] = [];
  let dbStatus: "ok" | "error" = "ok";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    dbStatus = "error";
    alerts.push("DB check failed");

    return Response.json(
      {
        status: "error",
        checkedAt: now.toISOString(),
        db: {
          status: dbStatus,
        },
        emailWorker: {
          status: "unknown",
          summary: "Nelze vyhodnotit bez funkční DB.",
        },
        emailQueue: {
          pending: 0,
          retrying: 0,
          processing: 0,
          failed: 0,
        },
        alerts,
        error: error instanceof Error ? error.message : "Unknown DB error",
      },
      { status: 503 },
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
    alerts.push("Latest email error present");
  }

  const workerStatus = workerHasErrors || workerStuck ? "error" : workerBacklog ? "warning" : "ok";

  const status = workerStatus === "error" ? "error" : workerStatus === "warning" ? "warning" : "ok";

  return Response.json(
    {
      status,
      checkedAt: now.toISOString(),
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
