import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { BookingSubmissionOutcome } from "@/generated/prisma/client";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

dbTest("veřejný booking rate-limit posílá nejvýše jednu Pushover zprávu za zdroj a 10 minut", async () => {
  const [{ prisma }, { sendOwnerPublicBookingRateLimitPushover }, { PUBLIC_BOOKING_RATE_LIMIT_NOTIFICATION_TYPE }] = await Promise.all([
    import("@/lib/prisma"),
    import("@/lib/notifications/pushover-core"),
    import("@/lib/notifications/pushover-cooldown"),
  ]);
  const runId = randomUUID();
  const sourceHash = `test-ip-${runId}`;
  const otherSourceHash = `test-ip-other-${runId}`;
  const concurrentSourceHash = `test-ip-concurrent-${runId}`;
  const firstAt = new Date("2026-08-16T12:00:00.000Z");
  const sentInputs: Array<{ title: string; message: string; context?: Record<string, string | number | boolean | null> }> = [];
  const dependencies = {
    isConfigured: () => true,
    sendPushover: async (input: { title: string; message: string; context?: Record<string, string | number | boolean | null> }) => {
      sentInputs.push(input);
    },
  };
  const logIds: string[] = [];

  async function blockedRequest(source: string, now: Date) {
    const log = await prisma.bookingSubmissionLog.create({
      data: {
        ipHash: source,
        outcome: BookingSubmissionOutcome.BLOCKED,
        failureCode: "RATE_LIMITED",
        failureReason: "Příliš mnoho pokusů v krátkém čase.",
        createdAt: now,
        updatedAt: now,
      },
    });
    logIds.push(log.id);

    await sendOwnerPublicBookingRateLimitPushover({
      sourceHash: source,
      sourceKind: "ip",
      ipAttempts: 8,
      emailFailures: 0,
      now,
    }, dependencies);
  }

  try {
    // A: první blokace předá zprávu do Pushover dispatchu.
    await blockedRequest(sourceHash, firstAt);
    assert.equal(sentInputs.length, 1);
    assert.match(sentInputs[0].message, /Zdroj: test-ip-/);

    // B + F: opakování po 30 s se potlačí, ale auditní řádek vznikne.
    await blockedRequest(sourceHash, new Date(firstAt.getTime() + 30_000));
    assert.equal(sentInputs.length, 1);
    assert.equal(await prisma.bookingSubmissionLog.count({ where: { id: { in: logIds } } }), 2);

    // C: jiný hash má vlastní cooldown.
    await blockedRequest(otherSourceHash, new Date(firstAt.getTime() + 30_000));
    assert.equal(sentInputs.length, 2);

    // D: po uplynutí celých 10 minut lze zprávu poslat znovu.
    await blockedRequest(sourceHash, new Date(firstAt.getTime() + 10 * 60_000 + 1));
    assert.equal(sentInputs.length, 3);

    // E: advisory lock zajistí jediný claim i při souběžných requestech.
    await Promise.all(Array.from({ length: 20 }, () => blockedRequest(concurrentSourceHash, firstAt)));
    assert.equal(sentInputs.length, 4);
    assert.equal(
      await prisma.bookingSubmissionLog.count({ where: { ipHash: concurrentSourceHash, failureCode: "RATE_LIMITED" } }),
      20,
    );
  } finally {
    await prisma.bookingSubmissionLog.deleteMany({ where: { id: { in: logIds } } });
    await prisma.pushoverNotificationCooldown.deleteMany({
      where: {
        eventType: PUBLIC_BOOKING_RATE_LIMIT_NOTIFICATION_TYPE,
        sourceHash: { in: [sourceHash, otherSourceHash, concurrentSourceHash] },
      },
    });
  }
});
