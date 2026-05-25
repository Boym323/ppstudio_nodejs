import assert from "node:assert/strict";
import test from "node:test";

import { resolveBookingTimingSnapshot, roundUpToQuarterHour } from "./booking-cleanup";

test("roundUpToQuarterHour rounds up to 15-minute buckets", () => {
  assert.equal(roundUpToQuarterHour(0), 0);
  assert.equal(roundUpToQuarterHour(1), 15);
  assert.equal(roundUpToQuarterHour(10), 15);
  assert.equal(roundUpToQuarterHour(15), 15);
  assert.equal(roundUpToQuarterHour(16), 30);
  assert.equal(roundUpToQuarterHour(29), 30);
  assert.equal(roundUpToQuarterHour(30), 30);
  assert.equal(roundUpToQuarterHour(31), 45);
  assert.equal(roundUpToQuarterHour(44), 45);
  assert.equal(roundUpToQuarterHour(45), 45);
  assert.equal(roundUpToQuarterHour(46), 60);
  assert.equal(roundUpToQuarterHour(59), 60);
  assert.equal(roundUpToQuarterHour(60), 60);
});

test("resolveBookingTimingSnapshot keeps client service end and computes blockedUntil", () => {
  const result = resolveBookingTimingSnapshot({
    startsAt: new Date("2026-06-10T09:00:00.000Z"),
    serviceDurationMinutes: 60,
    cleanupMinutes: 16,
  });

  assert.equal(result.serviceEnd.toISOString(), "2026-06-10T10:00:00.000Z");
  assert.equal(result.cleanupBlockMinutes, 30);
  assert.equal(result.blockedUntil.toISOString(), "2026-06-10T10:30:00.000Z");
});

test("resolveBookingTimingSnapshot falls back to zero cleanup for legacy values", () => {
  const result = resolveBookingTimingSnapshot({
    startsAt: new Date("2026-06-10T09:00:00.000Z"),
    serviceDurationMinutes: 60,
    cleanupMinutes: null,
    cleanupBlockMinutes: null,
  });

  assert.equal(result.cleanupMinutes, 0);
  assert.equal(result.cleanupBlockMinutes, 0);
  assert.equal(result.blockedUntil.toISOString(), "2026-06-10T10:00:00.000Z");
});
