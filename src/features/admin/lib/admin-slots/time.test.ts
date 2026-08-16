import assert from "node:assert/strict";
import test from "node:test";

import {
  formatDateKey,
  getCellRangeBounds,
  getDayBounds,
  isDateKeyInWeek,
  isValidDateKey,
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

test("getDayBounds používá pražské půlnoci nezávisle na timezone Node.js v létě, zimě i při DST", () => {
  const summer = getDayBounds("2026-08-16");
  const winter = getDayBounds("2026-01-16");
  const dst = getDayBounds("2026-03-29");

  assert.equal(summer.startsAt.toISOString(), "2026-08-15T22:00:00.000Z");
  assert.equal(summer.endsAt.toISOString(), "2026-08-16T22:00:00.000Z");
  assert.equal(winter.startsAt.toISOString(), "2026-01-15T23:00:00.000Z");
  assert.equal(winter.endsAt.toISOString(), "2026-01-16T23:00:00.000Z");
  assert.equal(dst.startsAt.toISOString(), "2026-03-28T23:00:00.000Z");
  assert.equal(dst.endsAt.toISOString(), "2026-03-29T22:00:00.000Z");
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
