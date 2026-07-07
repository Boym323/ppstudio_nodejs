import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAvailableCells,
  buildIntervalsFromCells,
  cloneWeekDays,
  patchDayAvailableIntervals,
  sanitizeIntervals,
} from "./admin-weekly-planner-helpers";

function createPlannerDay() {
  return {
    dateKey: "2026-07-07",
    isoDate: "2026-07-07",
    dayNumber: "7",
    label: "Úterý",
    shortLabel: "Út",
    monthLabel: "červenec",
    monthDayLabel: "7. 7.",
    isPast: false,
    isToday: false,
    availableIntervals: [],
    lockedIntervals: [],
    cleanupBlocks: [],
    availableBlocks: [],
    lockedBlocks: [],
    inactiveBlocks: [],
    bookings: [],
    intervals: [],
    cells: {
      available: Array.from({ length: 28 }, () => false),
      booked: Array.from({ length: 28 }, () => false),
      bookedCleanup: Array.from({ length: 28 }, () => false),
      completed: Array.from({ length: 28 }, () => false),
      inactive: Array.from({ length: 28 }, () => false),
      locked: Array.from({ length: 28 }, () => false),
      past: Array.from({ length: 28 }, () => false),
    },
    summary: {
      availableLabel: "Bez volných oken",
      bookingLabel: "Bez rezervací",
      note: "",
    },
  };
}

test("sanitizeIntervals normalizuje, cisti a merguje prekryvy", () => {
  assert.deepEqual(sanitizeIntervals([
    { startCell: -2, endCell: 2.8 },
    { startCell: 2, endCell: 4 },
    { startCell: 10, endCell: 8 },
    { startCell: 30, endCell: 33 },
  ]), [
    { startCell: 0, endCell: 4 },
    { startCell: 28, endCell: 28 },
  ].filter((interval) => interval.endCell > interval.startCell));
});

test("buildIntervalsFromCells sklada souvisle useky z bunek", () => {
  const cells = buildAvailableCells([
    { startCell: 1, endCell: 3 },
    { startCell: 5, endCell: 6 },
  ]);

  assert.deepEqual(buildIntervalsFromCells(cells), [
    { startCell: 1, endCell: 3, label: "06:30 - 07:30" },
    { startCell: 5, endCell: 6, label: "08:30 - 09:00" },
  ]);
});

test("patchDayAvailableIntervals aktualizuje summary i copy bunek bez mutace puvodniho dne", () => {
  const originalDay = createPlannerDay();
  const clonedWeek = cloneWeekDays([originalDay]);
  const patchedDay = patchDayAvailableIntervals(clonedWeek[0], [
    { startCell: 2, endCell: 4, label: "07:00 - 08:00" },
  ]);

  assert.equal(originalDay.cells.available[2], false);
  assert.equal(patchedDay.cells.available[2], true);
  assert.equal(patchedDay.summary.availableLabel, "1 volná okna");
  assert.equal(patchedDay.summary.note, "Dostupnost lze upravit přímo v mřížce nebo přes akční inspektor.");
});
