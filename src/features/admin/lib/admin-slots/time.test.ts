import assert from "node:assert/strict";
import test from "node:test";

import {
  formatDateKey,
  getCellRangeBounds,
  isDateKeyInWeek,
  isValidDateKey,
  moveIntervalToDateKey,
  timeFormatter,
} from "./time";

test("dateKey musí být skutečné datum a patřit do zadaného planner týdne", () => {
  assert.equal(isValidDateKey("2026-02-29"), false);
  assert.equal(isValidDateKey("2026-03-02"), true);
  assert.equal(isDateKeyInWeek("2026-03-08", "2026-03-02"), true);
  assert.equal(isDateKeyInWeek("2026-03-09", "2026-03-02"), false);
});

test("winter salon slot 09:00-10:00 stays 09:00-10:00 Europe/Prague", () => {
  const slot = getCellRangeBounds("2026-01-15", 6, 8);

  assert.equal(formatDateKey(slot.startsAt), "2026-01-15");
  assert.equal(timeFormatter.format(slot.startsAt), "09:00");
  assert.equal(timeFormatter.format(slot.endsAt), "10:00");
  assert.equal(slot.startsAt.toISOString(), "2026-01-15T08:00:00.000Z");
  assert.equal(slot.endsAt.toISOString(), "2026-01-15T09:00:00.000Z");
});

test("summer salon slot 09:00-10:00 stays 09:00-10:00 Europe/Prague", () => {
  const slot = getCellRangeBounds("2026-07-15", 6, 8);

  assert.equal(formatDateKey(slot.startsAt), "2026-07-15");
  assert.equal(timeFormatter.format(slot.startsAt), "09:00");
  assert.equal(timeFormatter.format(slot.endsAt), "10:00");
  assert.equal(slot.startsAt.toISOString(), "2026-07-15T07:00:00.000Z");
  assert.equal(slot.endsAt.toISOString(), "2026-07-15T08:00:00.000Z");
});

test("getCellRangeBounds creates winter slot from local planner cells", () => {
  const slot = getCellRangeBounds("2026-02-02", 6, 8);

  assert.equal(slot.startsAt.toISOString(), "2026-02-02T08:00:00.000Z");
  assert.equal(slot.endsAt.toISOString(), "2026-02-02T09:00:00.000Z");
});

test("getCellRangeBounds creates summer slot from local planner cells", () => {
  const slot = getCellRangeBounds("2026-08-03", 6, 8);

  assert.equal(slot.startsAt.toISOString(), "2026-08-03T07:00:00.000Z");
  assert.equal(slot.endsAt.toISOString(), "2026-08-03T08:00:00.000Z");
});

test("copying a day over spring DST keeps local salon hours", () => {
  const source = getCellRangeBounds("2026-03-28", 6, 8);
  const copied = moveIntervalToDateKey(source, "2026-03-29");

  assert.equal(formatDateKey(copied.startsAt), "2026-03-29");
  assert.equal(timeFormatter.format(copied.startsAt), "09:00");
  assert.equal(timeFormatter.format(copied.endsAt), "10:00");
  assert.equal(copied.startsAt.toISOString(), "2026-03-29T07:00:00.000Z");
});

test("copying a day over autumn DST keeps local salon hours", () => {
  const source = getCellRangeBounds("2026-10-24", 6, 8);
  const copied = moveIntervalToDateKey(source, "2026-10-25");

  assert.equal(formatDateKey(copied.startsAt), "2026-10-25");
  assert.equal(timeFormatter.format(copied.startsAt), "09:00");
  assert.equal(timeFormatter.format(copied.endsAt), "10:00");
  assert.equal(copied.startsAt.toISOString(), "2026-10-25T08:00:00.000Z");
});

test("copying a week over DST keeps local salon hours", () => {
  const mondayBeforeSpringChange = getCellRangeBounds("2026-03-23", 6, 8);
  const copiedToNextWeek = moveIntervalToDateKey(mondayBeforeSpringChange, "2026-03-30");

  assert.equal(formatDateKey(copiedToNextWeek.startsAt), "2026-03-30");
  assert.equal(timeFormatter.format(copiedToNextWeek.startsAt), "09:00");
  assert.equal(timeFormatter.format(copiedToNextWeek.endsAt), "10:00");
  assert.equal(copiedToNextWeek.startsAt.toISOString(), "2026-03-30T07:00:00.000Z");
});
