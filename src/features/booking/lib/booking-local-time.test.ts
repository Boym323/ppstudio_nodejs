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
