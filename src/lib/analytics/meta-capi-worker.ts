import { MetaConversionEventStatus, Prisma } from "@/generated/prisma/client";
import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";

import { getMetaCapiConfig } from "./meta-capi-config";
import { MetaCapiRequestError, sendMetaCapiEvent, type MetaScheduleEvent } from "./meta-capi";

const WORKER_BATCH_SIZE = 8;
const MAX_ATTEMPTS = 6;
const PROCESSING_LEASE_MS = 2 * 60 * 1_000;
const MAX_EVENT_AGE_MS = 6 * 24 * 60 * 60 * 1_000;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 3 * 60 * 60_000];

type ClaimedMetaEvent = MetaScheduleEvent & {
  attemptCount: number;
  processingToken: string;
};

function getSafeErrorCode(error: unknown) {
  if (error instanceof MetaCapiRequestError) return error.code;
  if (error instanceof Error && error.name === "TimeoutError") return "TIMEOUT";
  if (error instanceof Error && error.name === "AbortError") return "TIMEOUT";
  return "NETWORK_ERROR";
}

function isRetryableError(error: unknown) {
  return !(error instanceof MetaCapiRequestError) || error.retryable;
}

async function expireOldMetaEvents(now: Date) {
  const expiredBefore = new Date(now.getTime() - MAX_EVENT_AGE_MS);

  await prisma.metaConversionEvent.updateMany({
    where: {
      status: { in: [MetaConversionEventStatus.PENDING, MetaConversionEventStatus.PROCESSING] },
      eventTime: { lt: expiredBefore },
    },
    data: {
      status: MetaConversionEventStatus.FAILED,
      processingStartedAt: null,
      processingToken: null,
      lastErrorCode: "EVENT_EXPIRED",
      userAgent: null,
      fbp: null,
      fbc: null,
    },
  });
}

async function cancelUndeliveredEventsWhenDisabled(now: Date) {
  const staleBefore = new Date(now.getTime() - PROCESSING_LEASE_MS);

  await prisma.metaConversionEvent.updateMany({
    where: {
      OR: [
        { status: MetaConversionEventStatus.PENDING },
        {
          status: MetaConversionEventStatus.PROCESSING,
          processingStartedAt: { lt: staleBefore },
        },
      ],
    },
    data: {
      status: MetaConversionEventStatus.FAILED,
      processingStartedAt: null,
      processingToken: null,
      lastErrorCode: "CAPI_DISABLED",
      userAgent: null,
      fbp: null,
      fbc: null,
    },
  });
}

async function claimDueMetaEvents(now: Date): Promise<ClaimedMetaEvent[]> {
  const staleBefore = new Date(now.getTime() - PROCESSING_LEASE_MS);
  const eventMustBeNewerThan = new Date(now.getTime() - MAX_EVENT_AGE_MS);

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "MetaConversionEvent"
      WHERE (
        ("status" = ${MetaConversionEventStatus.PENDING} AND "nextAttemptAt" <= ${now})
        OR
        ("status" = ${MetaConversionEventStatus.PROCESSING} AND "processingStartedAt" < ${staleBefore})
      )
        AND "eventTime" >= ${eventMustBeNewerThan}
      ORDER BY "createdAt" ASC
      LIMIT ${WORKER_BATCH_SIZE}
      FOR UPDATE SKIP LOCKED
    `);

    const claimed: ClaimedMetaEvent[] = [];

    for (const row of rows) {
      const processingToken = randomUUID();
      const event = await tx.metaConversionEvent.update({
        where: { id: row.id },
        data: {
          status: MetaConversionEventStatus.PROCESSING,
          attemptCount: { increment: 1 },
          lastAttemptAt: now,
          processingStartedAt: now,
          processingToken,
        },
        select: {
          id: true,
          eventId: true,
          eventTime: true,
          eventSourceUrl: true,
          userAgent: true,
          fbp: true,
          fbc: true,
          attemptCount: true,
          processingToken: true,
        },
      });

      if (!event.processingToken) continue;
      claimed.push({ ...event, processingToken: event.processingToken });
    }

    return claimed;
  });
}

async function markMetaEventSent(event: ClaimedMetaEvent, now: Date) {
  return prisma.metaConversionEvent.updateMany({
    where: {
      id: event.id,
      status: MetaConversionEventStatus.PROCESSING,
      processingToken: event.processingToken,
    },
    data: {
      status: MetaConversionEventStatus.SENT,
      sentAt: now,
      processingStartedAt: null,
      processingToken: null,
      lastErrorCode: null,
      userAgent: null,
      fbp: null,
      fbc: null,
    },
  });
}

async function markMetaEventFailedOrRetry(event: ClaimedMetaEvent, error: unknown, now: Date) {
  const retryable = isRetryableError(error) && event.attemptCount < MAX_ATTEMPTS;
  const ageWithinWindow = now.getTime() - event.eventTime.getTime() < MAX_EVENT_AGE_MS;
  const shouldRetry = retryable && ageWithinWindow;
  const retryDelay = RETRY_DELAYS_MS[Math.min(event.attemptCount - 1, RETRY_DELAYS_MS.length - 1)] ?? 0;

  return prisma.metaConversionEvent.updateMany({
    where: {
      id: event.id,
      status: MetaConversionEventStatus.PROCESSING,
      processingToken: event.processingToken,
    },
    data: {
      status: shouldRetry ? MetaConversionEventStatus.PENDING : MetaConversionEventStatus.FAILED,
      nextAttemptAt: shouldRetry ? new Date(now.getTime() + retryDelay) : now,
      processingStartedAt: null,
      processingToken: null,
      lastErrorCode: getSafeErrorCode(error),
      ...(!shouldRetry ? { userAgent: null, fbp: null, fbc: null } : {}),
    },
  });
}

export async function runMetaConversionWorkerOnce(
  now = new Date(),
  config: ReturnType<typeof getMetaCapiConfig> = getMetaCapiConfig(),
) {
  await expireOldMetaEvents(now);
  if (!config) {
    await cancelUndeliveredEventsWhenDisabled(now);
    return { attempted: 0, sent: 0, retrying: 0, failed: 0 };
  }

  const events = await claimDueMetaEvents(now);
  let sent = 0;
  let retrying = 0;
  let failed = 0;

  await Promise.all(events.map(async (event) => {
    try {
      await sendMetaCapiEvent(event, config);
      const result = await markMetaEventSent(event, new Date());
      if (result.count > 0) sent += 1;
    } catch (error) {
      const result = await markMetaEventFailedOrRetry(event, error, new Date());
      if (result.count === 0) return;
      if (isRetryableError(error) && event.attemptCount < MAX_ATTEMPTS) retrying += 1;
      else failed += 1;
    }
  }));

  if (events.length > 0) {
    console.info("Meta CAPI outbox batch processed", {
      attempted: events.length,
      sent,
      retrying,
      failed,
    });
  }

  return { attempted: events.length, sent, retrying, failed };
}
