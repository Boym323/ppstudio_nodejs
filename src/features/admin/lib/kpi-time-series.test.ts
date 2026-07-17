import assert from "node:assert/strict";
import test from "node:test";

import { completeKpiTimeSeries, sortKpiTimeSeries } from "./kpi-time-series";

test("řadí měsíční body od dubna do července bez ohledu na český popisek", () => {
  const points = sortKpiTimeSeries([
    { periodStart: "2026-05-01T00:00:00.000Z" },
    { periodStart: "2026-07-01T00:00:00.000Z" },
    { periodStart: "2026-06-01T00:00:00.000Z" },
    { periodStart: "2026-04-01T00:00:00.000Z" },
  ]);
  assert.deepEqual(points.map((point) => point.periodStart), ["2026-04-01T00:00:00.000Z", "2026-05-01T00:00:00.000Z", "2026-06-01T00:00:00.000Z", "2026-07-01T00:00:00.000Z"]);
});

test("řadí měsíce přes přelom roku", () => {
  const points = sortKpiTimeSeries([
    { periodStart: "2027-02-01T00:00:00.000Z" },
    { periodStart: "2026-12-01T00:00:00.000Z" },
    { periodStart: "2026-11-01T00:00:00.000Z" },
    { periodStart: "2027-01-01T00:00:00.000Z" },
  ]);
  assert.deepEqual(points.map((point) => point.periodStart), ["2026-11-01T00:00:00.000Z", "2026-12-01T00:00:00.000Z", "2027-01-01T00:00:00.000Z", "2027-02-01T00:00:00.000Z"]);
});

test("řadí denní body vlastního období chronologicky", () => {
  const points = sortKpiTimeSeries([
    { periodStart: "2026-07-12T00:00:00.000Z" },
    { periodStart: "2026-07-10T00:00:00.000Z" },
    { periodStart: "2026-07-11T00:00:00.000Z" },
  ]);
  assert.deepEqual(points.map((point) => point.periodStart), ["2026-07-10T00:00:00.000Z", "2026-07-11T00:00:00.000Z", "2026-07-12T00:00:00.000Z"]);
});

test("doplní nulové body mezi rezervacemi včetně přelomu roku a prázdného období", () => {
  const periods = ["2026-12-30T00:00:00.000Z", "2026-12-31T00:00:00.000Z", "2027-01-01T00:00:00.000Z"] .map((value) => new Date(value));
  const complete = completeKpiTimeSeries(periods, [{ periodStart: "2026-12-30T00:00:00.000Z", value: 2 }], (periodStart) => ({ periodStart, value: 0 }));
  assert.deepEqual(complete.map((point) => point.value), [2, 0, 0]);
  assert.deepEqual(completeKpiTimeSeries([], [], (periodStart) => ({ periodStart, value: 0 })), []);
});
