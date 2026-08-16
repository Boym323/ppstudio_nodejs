import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

dbTest("atomická sliding-window brána nepustí paralelní burst nad limit", async () => {
  const [{ consumeAtomicRateLimit }, { prisma }] = await Promise.all([
    import("./atomic-rate-limit"),
    import("@/lib/prisma"),
  ]);
  const scope = `test-${randomUUID()}`;
  const now = new Date("2026-08-16T12:00:00.000Z");

  try {
    const results = await Promise.all(Array.from({ length: 50 }, () => consumeAtomicRateLimit({
      scope,
      fingerprint: "same-fingerprint",
      limit: 10,
      windowMs: 10 * 60 * 1000,
      now,
    })));
    assert.equal(results.filter((result) => result.allowed).length, 10);
    assert.equal(results.filter((result) => !result.allowed).length, 40);
    assert.equal((await consumeAtomicRateLimit({ scope, fingerprint: "second", limit: 10, windowMs: 600000, now })).allowed, true);
    assert.equal((await consumeAtomicRateLimit({ scope: `${scope}-other`, fingerprint: "same-fingerprint", limit: 10, windowMs: 600000, now })).allowed, true);
    assert.equal((await consumeAtomicRateLimit({ scope, fingerprint: "same-fingerprint", limit: 10, windowMs: 600000, now: new Date(now.getTime() + 600001) })).allowed, true);
  } finally {
    await prisma.rateLimitReservation.deleteMany({ where: { scope: { startsWith: scope } } });
  }
});

dbTest("úspěšné veřejné rezervace neuplatní e-mailový failure limit", async () => {
  const [{ consumeAtomicRateLimit, releaseAtomicRateLimitReservation }, { prisma }] = await Promise.all([
    import("./atomic-rate-limit"),
    import("@/lib/prisma"),
  ]);
  const scope = `test-public-booking-success-${randomUUID()}`;
  const now = new Date("2026-08-16T12:00:00.000Z");

  try {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const result = await consumeAtomicRateLimit({
        scope,
        fingerprint: "email-hash",
        limit: 3,
        windowMs: 10 * 60 * 1000,
        now,
      });
      assert.equal(result.allowed, true);
      await releaseAtomicRateLimitReservation(result.reservationId);
    }

    assert.equal((await consumeAtomicRateLimit({
      scope,
      fingerprint: "email-hash",
      limit: 3,
      windowMs: 10 * 60 * 1000,
      now,
    })).allowed, true);
  } finally {
    await prisma.rateLimitReservation.deleteMany({ where: { scope } });
  }
});

dbTest("validační chyby veřejné rezervace vyčerpají e-mailový failure limit", async () => {
  const [{ consumeAtomicRateLimit }, { prisma }] = await Promise.all([
    import("./atomic-rate-limit"),
    import("@/lib/prisma"),
  ]);
  const scope = `test-public-booking-validation-${randomUUID()}`;
  const now = new Date("2026-08-16T12:00:00.000Z");

  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      assert.equal((await consumeAtomicRateLimit({
        scope,
        fingerprint: "email-hash",
        limit: 3,
        windowMs: 10 * 60 * 1000,
        now,
      })).allowed, true);
    }

    assert.equal((await consumeAtomicRateLimit({
      scope,
      fingerprint: "email-hash",
      limit: 3,
      windowMs: 10 * 60 * 1000,
      now,
    })).allowed, false);
  } finally {
    await prisma.rateLimitReservation.deleteMany({ where: { scope } });
  }
});

dbTest("konflikty veřejné rezervace neuplatní e-mailový failure limit", async () => {
  const [{ consumeAtomicRateLimit, releaseAtomicRateLimitReservation }, { prisma }] = await Promise.all([
    import("./atomic-rate-limit"),
    import("@/lib/prisma"),
  ]);
  const scope = `test-public-booking-conflict-${randomUUID()}`;
  const now = new Date("2026-08-16T12:00:00.000Z");

  try {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const result = await consumeAtomicRateLimit({
        scope,
        fingerprint: "email-hash",
        limit: 3,
        windowMs: 10 * 60 * 1000,
        now,
      });
      assert.equal(result.allowed, true);
      await releaseAtomicRateLimitReservation(result.reservationId);
    }

    assert.equal((await consumeAtomicRateLimit({
      scope,
      fingerprint: "email-hash",
      limit: 3,
      windowMs: 10 * 60 * 1000,
      now,
    })).allowed, true);
  } finally {
    await prisma.rateLimitReservation.deleteMany({ where: { scope } });
  }
});
