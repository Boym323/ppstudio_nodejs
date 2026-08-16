import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";

export type AtomicRateLimitResult = {
  allowed: boolean;
  attempts: number;
  reservationId?: string;
};

/**
 * Sliding-window gate. The advisory transaction lock serializes only one
 * `(scope, fingerprint)` bucket; count and reservation insert therefore form
 * one atomic operation even across Node processes.
 */
export async function consumeAtomicRateLimit({
  scope,
  fingerprint,
  limit,
  windowMs,
  now = new Date(),
}: {
  scope: string;
  fingerprint?: string;
  limit: number;
  windowMs: number;
  now?: Date;
}): Promise<AtomicRateLimitResult> {
  if (!fingerprint) {
    return { allowed: true, attempts: 0 };
  }

  const expiresAt = new Date(now.getTime() + windowMs);
  const lockKey = `${scope}:${fingerprint}`;

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
    await tx.rateLimitReservation.deleteMany({
      where: { scope, fingerprint, expiresAt: { lte: now } },
    });
    const attempts = await tx.rateLimitReservation.count({
      where: { scope, fingerprint, expiresAt: { gt: now } },
    });

    if (attempts >= limit) {
      return { allowed: false, attempts };
    }

    const reservationId = randomUUID();
    await tx.rateLimitReservation.create({
      data: { id: reservationId, scope, fingerprint, expiresAt },
    });
    return { allowed: true, attempts: attempts + 1, reservationId };
  }, { maxWait: 10_000, timeout: 10_000 });
}

/** Releases a provisional reservation for outcomes that historically did not count. */
export async function releaseAtomicRateLimitReservation(reservationId?: string) {
  if (reservationId) {
    await prisma.rateLimitReservation.deleteMany({ where: { id: reservationId } });
  }
}
