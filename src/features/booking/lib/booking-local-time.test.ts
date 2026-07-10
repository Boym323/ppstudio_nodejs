import assert from "node:assert/strict";
import test from "node:test";

import { resolvePragueLocalDateTime } from "./booking-local-time";

test("resolvePragueLocalDateTime keeps winter salon wall-clock time in Europe/Prague", () => {
  const resolved = resolvePragueLocalDateTime("2026-01-15", "09:00");

  assert.ok(resolved);
  assert.equal(resolved.toISOString(), "2026-01-15T08:00:00.000Z");
});

test("resolvePragueLocalDateTime keeps summer salon wall-clock time in Europe/Prague", () => {
  const resolved = resolvePragueLocalDateTime("2026-07-15", "09:00");

  assert.ok(resolved);
  assert.equal(resolved.toISOString(), "2026-07-15T07:00:00.000Z");
});

test("resolvePragueLocalDateTime rejects the spring-forward DST gap", () => {
  assert.equal(resolvePragueLocalDateTime("2026-03-29", "02:30"), null);
});

test("resolvePragueLocalDateTime chooses the earlier instant for an autumn duplicate", () => {
  const resolved = resolvePragueLocalDateTime("2026-10-25", "02:30");

  assert.ok(resolved);
  assert.equal(resolved.toISOString(), "2026-10-25T00:30:00.000Z");
});

test("resolvePragueLocalDateTime rejects invalid calendar and clock values", () => {
  assert.equal(resolvePragueLocalDateTime("2026-02-31", "10:00"), null);
  assert.equal(resolvePragueLocalDateTime("2026-13-01", "10:00"), null);
  assert.equal(resolvePragueLocalDateTime("2026-01-01", "25:00"), null);
  assert.equal(resolvePragueLocalDateTime("2026-01-01", "10:60"), null);
});
