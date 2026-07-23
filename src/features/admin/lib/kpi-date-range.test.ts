import assert from "node:assert/strict";
import test from "node:test";

import { getKpiDateKey, getKpiDateRanges, getKpiPercentChange } from "./kpi-date-range";

test("KPI období tento měsíc a předchozí interval", () => {
  const { current, previous } = getKpiDateRanges({}, new Date("2026-07-16T10:00:00.000Z"));
  assert.equal(current.label, "Tento měsíc");
  assert.equal(current.start.toISOString(), "2026-06-30T22:00:00.000Z");
  assert.equal(previous.end.getTime(), current.start.getTime());
});
test("vlastní období zahrne oba dny", () => {
  const { current } = getKpiDateRanges({ period: "custom", dateFrom: "2026-07-10", dateTo: "2026-07-19" });
  assert.equal((current.end.getTime() - current.start.getTime()) / 86_400_000, 10);
});
test("procentní změna při nulové výchozí hodnotě není zavádějící", () => {
  assert.equal(getKpiPercentChange(10, 0), null);
  assert.equal(getKpiPercentChange(15, 10), 50);
});
test("denní i měsíční popisek grafu obsahuje rok", () => {
  const value = new Date("2026-07-10T10:00:00.000Z");
  assert.match(getKpiDateKey(value, false), /2026/);
  assert.match(getKpiDateKey(value, true), /2026/);
});
