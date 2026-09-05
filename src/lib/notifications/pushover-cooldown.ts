import { prisma } from "@/lib/prisma";

export const PUBLIC_BOOKING_RATE_LIMIT_NOTIFICATION_TYPE = "PUBLIC_BOOKING_RATE_LIMITED";
export const PUBLIC_BOOKING_RATE_LIMIT_COOLDOWN_MS = 10 * 60 * 1000;

/**
 * Atomically reserves a notification cooldown for one event and source.
 * The advisory transaction lock makes the check-and-update safe across
 * concurrent requests and separate application instances.
 */
export async function claimPushoverNotificationCooldown({
  eventType,
  sourceHash,
  cooldownMs,
  now = new Date(),
}: {
  eventType: string;
  sourceHash: string;
  cooldownMs: number;
  now?: Date;
}) {
  const lockKey = `pushover-notification:${eventType}:${sourceHash}`;

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;

    const existing = await tx.pushoverNotificationCooldown.findUnique({
      where: {
        eventType_sourceHash: {
          eventType,
          sourceHash,
        },
      },
    });

    if (existing && now.getTime() - existing.lastSentAt.getTime() < cooldownMs) {
      return false;
    }

    if (existing) {
      await tx.pushoverNotificationCooldown.update({
        where: { id: existing.id },
        data: { lastSentAt: now },
      });
    } else {
      await tx.pushoverNotificationCooldown.create({
        data: {
          eventType,
          sourceHash,
          lastSentAt: now,
          createdAt: now,
        },
      });
    }

    return true;
  }, { maxWait: 10_000, timeout: 10_000 });
}
