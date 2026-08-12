import assert from "node:assert/strict";
import test from "node:test";

import { resolvePragueLocalDateTime } from "./booking-local-time";
import {
  AUTO_LUNCH_POLICY,
  canPreserveAutoLunch,
  findBestAutoLunch,
  generateLunchCandidates,
  measureFragmentation,
  rankSuggestedSlots,
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

type SuggestedCandidate = { id: string; startsAt: string };

function suggested(date: string, ...times: string[]): SuggestedCandidate[] {
  return times.map((time) => ({
    id: time,
    startsAt: new Date(at(date, time)).toISOString(),
  }));
}

function rank(input: {
  date: string;
  candidates: SuggestedCandidate[];
  availability?: ScheduleInterval[];
  bookedBlocks?: ScheduleInterval[];
  capacity?: number;
  autoLunch?: boolean;
  dayLunchModes?: Record<string, "AUTO" | "OFF" | undefined>;
}) {
  return rankSuggestedSlots({
    candidates: input.candidates,
    availability: input.availability ?? fullDay(input.date),
    bookedBlocks: input.bookedBlocks ?? [],
    serviceDurationMinutes: 60,
    cleanupBlockMinutes: 0,
    capacity: input.capacity ?? 1,
    globalAutoLunchEnabled: input.autoLunch ?? false,
    dayLunchModes: input.dayLunchModes ?? {},
  });
}

test("smart ranking preserves the valid candidate set and chronologically falls back for capacity above one", () => {
  const date = "2026-01-15";
  const candidates = suggested(date, "12:00", "10:30", "13:30");
  const ranked = rank({
    date,
    candidates,
    bookedBlocks: [interval(date, "09:00", "10:30"), interval(date, "15:00", "16:30")],
  });
  assert.deepEqual([...ranked].map((candidate) => candidate.id).sort(), [...candidates].map((candidate) => candidate.id).sort());
  assert.equal(ranked[0]?.id, "10:30");
  assert.deepEqual(rank({ date, candidates, capacity: 2 }).map((candidate) => candidate.id), candidates.map((candidate) => candidate.id));
});

test("smart ranking prefers fewer fragments, then a larger free block and direct booking adjacency", () => {
  const date = "2026-01-15";
  assert.equal(rank({
    date,
    candidates: suggested(date, "12:00", "10:30"),
    bookedBlocks: [interval(date, "09:00", "10:30"), interval(date, "15:00", "16:30")],
  })[0]?.id, "10:30");
  assert.equal(rank({
    date,
    candidates: suggested(date, "13:00", "11:00"),
    bookedBlocks: [interval(date, "09:00", "10:00"), interval(date, "16:00", "17:00")],
  })[0]?.id, "11:00");
  assert.equal(rank({
    date,
    candidates: suggested(date, "09:00", "11:00"),
    bookedBlocks: [interval(date, "12:00", "13:00")],
  })[0]?.id, "11:00");
});

test("smart ranking measures the resulting schedule including the best lunch placement without penalizing its move", () => {
  const date = "2026-07-15";
  const candidates = suggested(date, "10:30", "12:00", "13:30");
  const ranked = rank({
    date,
    candidates,
    bookedBlocks: [interval(date, "09:00", "10:30"), interval(date, "15:00", "16:30")],
    autoLunch: true,
  });
  assert.equal(ranked[0]?.id, "10:30");
  assert.deepEqual(rank({
    date,
    candidates,
    bookedBlocks: [interval(date, "09:00", "10:30"), interval(date, "15:00", "16:30")],
    autoLunch: true,
  }).map((candidate) => candidate.id), ranked.map((candidate) => candidate.id));
});

test("smart ranking is date-first, stable on ties and keeps an empty day chronological", () => {
  const firstDate = "2026-01-15";
  const nextDate = "2026-01-16";
  const candidates = [
    ...suggested(firstDate, "12:00", "10:30"),
    ...suggested(nextDate, "09:00"),
  ];
  const ranked = rank({
    date: firstDate,
    candidates,
    availability: [fullDay(firstDate)[0]!, fullDay(nextDate)[0]!],
    bookedBlocks: [interval(firstDate, "09:00", "10:30"), interval(firstDate, "15:00", "16:30")],
  });
  assert.deepEqual(ranked.map((candidate) => candidate.id), ["10:30", "12:00", "09:00"]);
  assert.deepEqual(rank({
    date: firstDate,
    candidates: suggested(firstDate, "09:00", "10:00", "11:00"),
  }).map((candidate) => candidate.id), ["09:00", "10:00", "11:00"]);
});

test("smart ranking simulation keeps valid sets and date-first order across representative days", () => {
  const date = "2026-01-15";
  const scenarios = [
    { name: "prázdný den", bookedBlocks: [] as ScheduleInterval[], candidates: suggested(date, "09:00", "10:00", "11:00"), expectedFirst: "09:00" },
    { name: "ranní rezervace", bookedBlocks: [interval(date, "09:00", "10:30")], candidates: suggested(date, "10:30", "12:00"), expectedFirst: "10:30" },
    { name: "odpolední rezervace", bookedBlocks: [interval(date, "15:00", "16:30")], candidates: suggested(date, "10:30", "12:00"), expectedFirst: "10:30" },
    { name: "rezervace na obou stranách", bookedBlocks: [interval(date, "09:00", "10:30"), interval(date, "15:00", "16:30")], candidates: suggested(date, "10:30", "12:00", "13:30"), expectedFirst: "10:30" },
    { name: "krátká mezera", bookedBlocks: [interval(date, "09:00", "11:00"), interval(date, "12:00", "17:00")], candidates: suggested(date, "11:00"), expectedFirst: "11:00" },
    { name: "dlouhý souvislý blok", bookedBlocks: [interval(date, "09:00", "10:00")], candidates: suggested(date, "10:00", "12:00"), expectedFirst: "10:00" },
    { name: "aktivní automatický oběd", bookedBlocks: [interval(date, "09:00", "10:30"), interval(date, "15:00", "16:30")], candidates: suggested(date, "10:30", "12:00"), expectedFirst: "10:30", autoLunch: true },
    { name: "denní OFF", bookedBlocks: [interval(date, "09:00", "10:30")], candidates: suggested(date, "10:30", "12:00"), expectedFirst: "10:30", autoLunch: true, dayLunchModes: { [date]: "OFF" as const } },
  ];

  for (const scenario of scenarios) {
    const first = rank({ date, ...scenario });
    const second = rank({ date, ...scenario });
    assert.deepEqual(first.map((candidate) => candidate.id).sort(), scenario.candidates.map((candidate) => candidate.id).sort(), scenario.name);
    assert.deepEqual(first, second, `${scenario.name}: determinismus`);
    assert.equal(first[0]?.id, scenario.expectedFirst, scenario.name);
  }
});
