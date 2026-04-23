import { EmailLogStatus, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

import {
  BOOKING_REMINDER_SCAN_INTERVAL_MS,
  enqueueBookingReminder24hJobs,
} from "@/features/booking/lib/booking-reminders";
import { deliverEmailLog } from "@/lib/email/delivery";
import { prisma } from "@/lib/prisma";

const WORKER_BATCH_SIZE = 10;
const WORKER_IDLE_DELAY_MS = 5_000;
const WORKER_LOCK_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_ITERATIONS_PER_RUN = 1_000;

export type EmailWorkerConfig = {
  once?: boolean;
};

type ClaimedEmailLog = {
  id: string;
};

async function claimDueEmailLogs(limit: number): Promise<ClaimedEmailLog[]> {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - WORKER_LOCK_TIMEOUT_MS);

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "EmailLog"
      WHERE "status" = ${EmailLogStatus.PENDING}
        AND "nextAttemptAt" <= ${now}
        AND ("processingStartedAt" IS NULL OR "processingStartedAt" < ${staleBefore})
      ORDER BY "createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `);

    const claimed: ClaimedEmailLog[] = [];

    for (const row of rows) {
      const updated = await tx.emailLog.update({
        where: {
          id: row.id,
        },
        data: {
          attemptCount: {
            increment: 1,
          },
          processingStartedAt: now,
          processingToken: randomUUID(),
        },
        select: {
          id: true,
        },
      });

      claimed.push(updated);
    }

    return claimed;
  });
}

export async function runEmailDeliveryWorkerOnce() {
  let processed = 0;

  while (processed < MAX_ITERATIONS_PER_RUN) {
    const batch = await claimDueEmailLogs(WORKER_BATCH_SIZE);

    if (batch.length === 0) {
      break;
    }

    for (const emailLog of batch) {
      await deliverEmailLog(emailLog.id);
      processed += 1;
    }
  }

  return processed;
}

export async function runBookingReminderSchedulerOnce(now = new Date()) {
  const result = await enqueueBookingReminder24hJobs(now);

  console.info("Booking reminder 24h scan finished", {
    at: now.toISOString(),
    foundBookings: result.foundBookings,
    enqueued: result.enqueued,
    failed: result.failed,
  });

  return result;
}

export async function startEmailDeliveryWorker() {
  let nextReminderScanAt = 0;

  while (true) {
    const now = Date.now();

    if (now >= nextReminderScanAt) {
      await runBookingReminderSchedulerOnce(new Date(now));
      nextReminderScanAt = now + BOOKING_REMINDER_SCAN_INTERVAL_MS;
    }

    const processed = await runEmailDeliveryWorkerOnce();

    if (processed === 0) {
      await new Promise((resolve) => setTimeout(resolve, WORKER_IDLE_DELAY_MS));
    }
  }
}
