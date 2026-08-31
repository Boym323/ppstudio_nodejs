import assert from "node:assert/strict";
import test from "node:test";

import { getKpiDateKey, getKpiDateRanges, getKpiPercentChange, getPragueCalendarDayCount, usesMonthlyKpiBuckets } from "./kpi-date-range";

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
test("příští měsíc je celý následující kalendářní měsíc", () => {
  const { current, previous } = getKpiDateRanges({ period: "next_month" }, new Date("2026-12-16T10:00:00.000Z"));
  assert.equal(current.label, "Příští měsíc");
  assert.equal(current.start.toISOString(), "2026-12-31T23:00:00.000Z");
  assert.equal(current.end.toISOString(), "2027-01-31T23:00:00.000Z");
  assert.equal(previous.end.getTime(), current.start.getTime());
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

test("předchozí vlastní období zachová pražské kalendářní dny přes CET → CEST", () => {
  const { current, previous } = getKpiDateRanges({ period: "custom", dateFrom: "2026-03-20", dateTo: "2026-04-02" });
  assert.equal(getPragueCalendarDayCount(current.start, current.end), 14);
  assert.equal(previous.start.toISOString(), "2026-03-05T23:00:00.000Z");
  assert.equal(previous.end.toISOString(), "2026-03-19T23:00:00.000Z");
});

test("předchozí vlastní období zachová pražské kalendářní dny přes CEST → CET", () => {
  const { current, previous } = getKpiDateRanges({ period: "custom", dateFrom: "2026-10-20", dateTo: "2026-11-02" });
  assert.equal(getPragueCalendarDayCount(current.start, current.end), 14);
  assert.equal(previous.start.toISOString(), "2026-10-05T22:00:00.000Z");
  assert.equal(previous.end.toISOString(), "2026-10-19T22:00:00.000Z");
});

test("celý kalendářní měsíc porovnává s předchozím měsícem přes DST a leap year", () => {
  const march = getKpiDateRanges({ period: "last_month" }, new Date("2026-04-15T10:00:00.000Z"));
  assert.equal(march.previous.start.toISOString(), "2026-01-31T23:00:00.000Z");
  assert.equal(march.previous.end.toISOString(), "2026-02-28T23:00:00.000Z");
  const leapFebruary = getKpiDateRanges({ period: "last_month" }, new Date("2028-03-15T10:00:00.000Z"));
  assert.equal(leapFebruary.current.start.toISOString(), "2028-01-31T23:00:00.000Z");
  assert.equal(leapFebruary.previous.start.toISOString(), "2027-12-31T23:00:00.000Z");
});

test("hranice 62 dní používá pražské kalendářní dny i přes podzimní DST", () => {
  const daily = getKpiDateRanges({ period: "custom", dateFrom: "2026-09-01", dateTo: "2026-11-01" }).current;
  const monthly = getKpiDateRanges({ period: "custom", dateFrom: "2026-09-01", dateTo: "2026-11-02" }).current;
  assert.equal(getPragueCalendarDayCount(daily.start, daily.end), 62);
  assert.equal(usesMonthlyKpiBuckets(daily), false);
  assert.equal(getPragueCalendarDayCount(monthly.start, monthly.end), 63);
  assert.equal(usesMonthlyKpiBuckets(monthly), true);
});
