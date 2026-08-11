import assert from "node:assert/strict";
import test from "node:test";

import { resolvePragueLocalDateTime } from "./booking-local-time";
import {
  AUTO_LUNCH_POLICY,
  canPreserveAutoLunch,
  findBestAutoLunch,
  generateLunchCandidates,
  measureFragmentation,
  shouldApplyAutoLunch,
  type ScheduleInterval,
} from "./booking-schedule-optimization";

const at = (date: string, time: string) => {
  const value = resolvePragueLocalDateTime(date, time);
  assert.ok(value);
  return value.getTime();
};
const interval = (date: string, start: string, end: string): ScheduleInterval => ({ startsAt: at(date, start), endsAt: at(date, end) });
const fullDay = (date: string) => [interval(date, "09:00", "17:00")];

test("activation respects global/day switches, true published capacity and Prague afternoon", () => {
  const date = "2026-07-15";
  const base = { localDate: date, availability: fullDay(date), globalAutoLunchEnabled: true, dayLunchMode: "AUTO" as const };
  assert.equal(shouldApplyAutoLunch(base), true);
  assert.equal(shouldApplyAutoLunch({ ...base, globalAutoLunchEnabled: false }), false);
  assert.equal(shouldApplyAutoLunch({ ...base, dayLunchMode: "OFF" }), false);
  assert.equal(shouldApplyAutoLunch({ ...base, availability: [interval(date, "09:00", "13:59")] }), false);
  assert.equal(shouldApplyAutoLunch({ ...base, availability: [interval(date, "08:30", "13:30")] }), true);
  assert.equal(shouldApplyAutoLunch({ ...base, availability: [interval(date, "08:00", "13:00")] }), false);
  assert.equal(shouldApplyAutoLunch({ ...base, availability: [interval(date, "12:00", "14:00")] }), false);
});

test("generates exactly nine covered candidates on the fixed 15-minute grid", () => {
  const date = "2026-07-15";
  const candidates = generateLunchCandidates({ localDate: date, availability: fullDay(date) });
  assert.equal(candidates.length, 9);
  assert.deepEqual(candidates[0], interval(date, "11:00", "11:45"));
  assert.deepEqual(candidates.at(-1), interval(date, "13:00", "13:45"));
  assert.equal(generateLunchCandidates({ localDate: date, availability: [interval(date, "11:00", "12:00")] }).length, 2);
});

test("bookings and cleanup move lunch but cannot deactivate an active policy", () => {
  const date = "2026-07-15";
  const availability = fullDay(date);
  const candidates = generateLunchCandidates({ localDate: date, availability });
  const active = shouldApplyAutoLunch({ localDate: date, availability, globalAutoLunchEnabled: true, dayLunchMode: "AUTO" });
  assert.equal(active, true);
  assert.deepEqual(findBestAutoLunch({ active, availability, lunchCandidates: candidates, bookedBlocks: [interval(date, "11:00", "12:45")] }), interval(date, "12:45", "13:30"));

  const onlyLast = [interval(date, "11:00", "13:00")]; // blockedUntil, including cleanup
  assert.deepEqual(canPreserveAutoLunch({ active, availability, lunchCandidates: candidates, bookedBlocks: onlyLast }).candidates, [interval(date, "13:00", "13:45")]);
  assert.deepEqual(canPreserveAutoLunch({ active, availability, lunchCandidates: candidates, bookedBlocks: onlyLast, hypotheticalBlock: interval(date, "13:00", "13:45") }), { active: true, feasible: false, candidates: [] });
  assert.equal(shouldApplyAutoLunch({ localDate: date, availability, globalAutoLunchEnabled: true, dayLunchMode: "AUTO" }), true);
});

test("inactive policy imposes no constraint and optimizer returns no lunch", () => {
  assert.deepEqual(canPreserveAutoLunch({ active: false, availability: [], lunchCandidates: [], hypotheticalBlock: { startsAt: 1, endsAt: 2 } }), { active: false, feasible: true, candidates: [] });
  assert.equal(findBestAutoLunch({ active: false, availability: [], lunchCandidates: [] }), null);
});

test("optimizer fills an exact gap and tie-breaks deterministically", () => {
  const date = "2026-01-15";
  const availability = fullDay(date);
  const candidates = generateLunchCandidates({ localDate: date, availability });
  assert.deepEqual(findBestAutoLunch({ active: true, availability, lunchCandidates: candidates, bookedBlocks: [interval(date, "09:00", "11:00"), interval(date, "11:45", "17:00")] }), interval(date, "11:00", "11:45"));
  assert.deepEqual(findBestAutoLunch({ active: true, availability, lunchCandidates: candidates }), findBestAutoLunch({ active: true, availability, lunchCandidates: candidates }));
});

test("placement at an availability edge preserves one long free block over a middle split", () => {
  const date = "2026-01-15";
  const availability = fullDay(date);
  const edge = measureFragmentation({
    freeIntervals: [interval(date, "11:45", "17:00")],
    availability,
    bookingBlocks: [interval(date, "09:00", "11:45")],
  });
  const middle = measureFragmentation({
    freeIntervals: [interval(date, "09:00", "12:00"), interval(date, "12:45", "17:00")],
    availability,
    bookingBlocks: [interval(date, "12:00", "12:45")],
  });
  assert.equal(edge.fragmentCount, 1);
  assert.equal(middle.fragmentCount, 2);
  assert.ok(edge.largestFreeBlockMinutes > middle.largestFreeBlockMinutes);
});

test("Prague wall-clock candidates retain their local meaning in winter, summer and DST", () => {
  for (const date of ["2026-01-15", "2026-07-15", "2026-03-29"]) {
    const candidates = generateLunchCandidates({ localDate: date, availability: fullDay(date) });
    assert.equal(candidates.length, 9);
    assert.equal(candidates[0].startsAt, at(date, AUTO_LUNCH_POLICY.earliestStart));
    assert.equal(candidates.at(-1)?.endsAt, at(date, "13:45"));
  }
});
