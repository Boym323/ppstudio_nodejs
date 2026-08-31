import assert from "node:assert/strict";
import test from "node:test";

import { calculateKpiOccupancy, getKpiIntervalUnionMinutes } from "./kpi-occupancy";

const date = (hour: number) => new Date(`2026-07-10T${String(hour).padStart(2, "0")}:00:00.000Z`);
const interval = (start: number, end: number) => ({ startsAt: date(start), endsAt: date(end) });
const range = { start: date(9), end: date(15) };

test("union dostupnosti zachová jeden slot a nesčítá replacement ani split sloty", () => {
  assert.equal(getKpiIntervalUnionMinutes([interval(9, 13)], range), 240);
  assert.equal(getKpiIntervalUnionMinutes([interval(9, 13), interval(9, 13)], range), 240);
  assert.equal(getKpiIntervalUnionMinutes([interval(9, 13), interval(9, 11), interval(11, 13)], range), 240);
});

test("union spojí částečné překryvy a navazující intervaly, oddělené ponechá", () => {
  assert.equal(getKpiIntervalUnionMinutes([interval(9, 12), interval(11, 14)], range), 300);
  assert.equal(getKpiIntervalUnionMinutes([interval(9, 11), interval(13, 15)], range), 240);
});

test("union ořízne slot na KPI range", () => {
  assert.equal(getKpiIntervalUnionMinutes([interval(8, 12)], { start: date(9), end: date(11) }), 120);
});

test("validní čtyřhodinová návštěva dává raw obsazenost 100 % bez clampu", () => {
  const occupancy = calculateKpiOccupancy({
    publishedAvailability: [interval(9, 13), interval(9, 11), interval(11, 13)],
    manualCompletedWork: [],
    completedWork: [interval(9, 13)],
    range,
  });
  assert.equal(occupancy.availableMinutes, 240);
  assert.equal(occupancy.reservedMinutes, 240);
  assert.equal(occupancy.rawPercent, 100);
  assert.equal(occupancy.percent, 100);
});

test("dokončená manuální rezervace doplní pouze skutečně odpracovanou kapacitu", () => {
  const occupancy = calculateKpiOccupancy({
    publishedAvailability: [],
    manualCompletedWork: [interval(9, 13)],
    completedWork: [interval(9, 13)],
    range,
  });
  assert.equal(occupancy.availableMinutes, 240);
  assert.equal(occupancy.rawPercent, 100);
});
