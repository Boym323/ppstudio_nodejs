import assert from "node:assert/strict";
import test from "node:test";

import { calculateDisruptionMetrics } from "./kpi-disruption-metrics";

const published = new Date("2026-01-01T10:00:00.000Z");
const booking = (overrides: Record<string, unknown> = {}) => ({
  status: "CONFIRMED",
  slotPublishedAt: published,
  finalPriceCzk: 1000,
  servicePriceFromCzk: 800,
  ...overrides,
});

test("při nulovém jmenovateli vrací nulové míry", () => {
  assert.deepEqual(calculateDisruptionMetrics([]), {
    relevantCount: 0, cancellations: 0, cancellationRate: 0, cancellationValue: 0,
    noShows: 0, noShowRate: 0, noShowValue: 0,
  });
});

test("jedno storno z deseti používá historickou finální cenu", () => {
  const result = calculateDisruptionMetrics([
    booking({ status: "CANCELLED", finalPriceCzk: 1085 }),
    ...Array.from({ length: 9 }, () => booking()),
  ]);
  assert.equal(result.cancellations, 1);
  assert.equal(result.cancellationRate, 10);
  assert.equal(result.cancellationValue, 1085);
});

test("počítá no-show a vylučuje nepublikovaný koncept", () => {
  const result = calculateDisruptionMetrics([
    booking({ status: "NO_SHOW", finalPriceCzk: null, servicePriceFromCzk: 900 }),
    booking({ status: "PENDING", slotPublishedAt: null }),
  ]);
  assert.equal(result.relevantCount, 1);
  assert.equal(result.noShows, 1);
  assert.equal(result.noShowRate, 100);
  assert.equal(result.noShowValue, 900);
});
