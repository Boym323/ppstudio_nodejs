import assert from "node:assert/strict";
import test from "node:test";

import { getRetentionBand, getRetentionBandDateBounds } from "./kpi-retention";

const now = new Date("2026-07-16T12:00:00.000Z");
const weeksAgo = (weeks: number, days = 0) => new Date(now.getTime() - (weeks * 7 + days) * 86_400_000);

test("retenční pásma jsou výlučná na všech hranicích", () => {
  assert.equal(getRetentionBand(weeksAgo(8), now), "8_11");
  assert.equal(getRetentionBand(weeksAgo(11, 6), now), "8_11");
  assert.equal(getRetentionBand(weeksAgo(12), now), "12_15");
  assert.equal(getRetentionBand(weeksAgo(16), now), "16_plus");
});

test("budoucí návštěva ani chybějící poslední návštěva nejsou retenční případ", () => {
  assert.equal(getRetentionBand(new Date("2026-07-20T12:00:00.000Z"), now), null);
  assert.equal(getRetentionBand(null, now), null);
});

test("sdílené hranice přesně odpovídají retenčním pásmům", () => {
  for (const band of ["8_11", "12_15", "16_plus"] as const) {
    const bounds = getRetentionBandDateBounds(band, now);
    if (bounds.start) assert.equal(getRetentionBand(bounds.start, now), band);
    assert.equal(getRetentionBand(new Date(bounds.end.getTime() - 1), now), band);
    assert.notEqual(getRetentionBand(bounds.end, now), band);
  }
});

test("hranice zůstávají shodné přes jarní i podzimní DST", () => {
  for (const reference of [new Date("2026-04-15T12:00:00.000Z"), new Date("2026-11-15T12:00:00.000Z")]) {
    for (const band of ["8_11", "12_15", "16_plus"] as const) {
      const bounds = getRetentionBandDateBounds(band, reference);
      assert.equal(getRetentionBand(new Date(bounds.end.getTime() - 1), reference), band);
      if (bounds.start) assert.equal(getRetentionBand(bounds.start, reference), band);
    }
  }
});
