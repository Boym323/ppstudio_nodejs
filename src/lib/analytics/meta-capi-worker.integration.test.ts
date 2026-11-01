import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.NEXT_PUBLIC_META_PIXEL_ENABLED = "true";
process.env.NEXT_PUBLIC_META_PIXEL_ID = "123456789012345";
process.env.META_CAPI_ENABLED = "true";
process.env.META_CAPI_DATASET_ID = "123456789012345";
process.env.META_CAPI_ACCESS_TOKEN = "test-only-meta-access-token";
process.env.META_CAPI_API_VERSION = "v26.0";
process.env.META_CAPI_TEST_EVENT_CODE = "TEST_ONLY";

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

dbTest("Meta CAPI worker retries the same event id and recovers stale claims without duplicates", async () => {
  const [{ prisma }, worker] = await Promise.all([
    import("@/lib/prisma"),
    import("./meta-capi-worker"),
  ]);
  const originalFetch = globalThis.fetch;
  const eventId = randomUUID();
  const now = new Date();
  const eventTime = new Date(now.getTime() - 2_000);
  const seenEventIds: string[] = [];
  let fetchAttempt = 0;

  const outbox = await prisma.metaConversionEvent.create({
    data: {
      eventId,
      eventTime,
      eventSourceUrl: "http://127.0.0.1:3000/rezervace",
      userAgent: "Integration test browser",
      fbp: "fb.1.1793528132000.1234567890",
      fbc: "fb.1.1793528132000.AbCdEf12345",
    },
  });

  globalThis.fetch = async (_input, init) => {
    fetchAttempt += 1;
    const requestBody = new URLSearchParams(String(init?.body));
    const events = JSON.parse(requestBody.get("data") ?? "[]") as Array<{ event_id: string }>;
    seenEventIds.push(events[0]?.event_id ?? "");

    if (fetchAttempt === 1) {
      return new Response(JSON.stringify({ error: { code: 1, is_transient: true } }), { status: 503 });
    }

    return new Response(JSON.stringify({ events_received: 1 }), { status: 200 });
  };

  try {
    const firstRun = await worker.runMetaConversionWorkerOnce(now);
    assert.deepEqual(firstRun, { attempted: 1, sent: 0, retrying: 1, failed: 0 });

    const retrying = await prisma.metaConversionEvent.findUniqueOrThrow({ where: { id: outbox.id } });
    assert.equal(retrying.status, "PENDING");
    assert.equal(retrying.attemptCount, 1);
    assert.equal(retrying.lastAttemptAt?.getTime(), now.getTime());
    assert.ok(retrying.nextAttemptAt > now);

    // Simuluje restart po claimu: nová instance převezme expirovaný PROCESSING lease.
    await prisma.metaConversionEvent.update({
      where: { id: outbox.id },
      data: {
        status: "PROCESSING",
        processingStartedAt: new Date(now.getTime() - 3 * 60_000),
        processingToken: "abandoned-worker-claim",
        nextAttemptAt: new Date(now.getTime() - 1),
      },
    });

    const recoveryRuns = await Promise.all([
      worker.runMetaConversionWorkerOnce(now),
      worker.runMetaConversionWorkerOnce(now),
    ]);
    assert.equal(recoveryRuns.reduce((total, result) => total + result.attempted, 0), 1);
    assert.equal(recoveryRuns.reduce((total, result) => total + result.sent, 0), 1);

    const finalEvent = await prisma.metaConversionEvent.findUniqueOrThrow({ where: { id: outbox.id } });
    assert.equal(finalEvent.status, "SENT");
    assert.equal(finalEvent.attemptCount, 2);
    assert.equal(finalEvent.eventId, eventId);
    assert.equal(finalEvent.eventTime.toISOString(), eventTime.toISOString());
    assert.ok(finalEvent.sentAt);
    assert.equal(finalEvent.lastAttemptAt?.getTime(), now.getTime());
    assert.equal(finalEvent.userAgent, null);
    assert.equal(finalEvent.fbp, null);
    assert.equal(finalEvent.fbc, null);
    assert.deepEqual(seenEventIds, [eventId, eventId]);

    const noDuplicateRun = await worker.runMetaConversionWorkerOnce(now);
    assert.deepEqual(noDuplicateRun, { attempted: 0, sent: 0, retrying: 0, failed: 0 });
    assert.equal(fetchAttempt, 2);
    assert.equal(await prisma.metaConversionEvent.count({ where: { eventId } }), 1);
  } finally {
    globalThis.fetch = originalFetch;
    await prisma.metaConversionEvent.deleteMany({ where: { id: outbox.id } });
  }
});
