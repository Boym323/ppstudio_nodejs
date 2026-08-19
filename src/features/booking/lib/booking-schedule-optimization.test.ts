import assert from "node:assert/strict";
import test from "node:test";

import { resolvePragueLocalDateTime } from "./booking-local-time";
import {
  AUTO_LUNCH_POLICY,
  calculateOrphanMinutes,
  canPreserveAutoLunch,
  findBestAutoLunch,
  generateLunchCandidates,
  measureFragmentation,
  rankSuggestedSlots,
  selectSuggestedSlots,
  shouldApplyAutoLunch,
  type ScheduleInterval,
} from "./booking-schedule-optimization";

const serviceOptions = [
  { durationMinutes: 30, cleanupBlockMinutes: 0 },
  { durationMinutes: 45, cleanupBlockMinutes: 0 },
  { durationMinutes: 60, cleanupBlockMinutes: 0 },
  { durationMinutes: 60, cleanupBlockMinutes: 15 },
  { durationMinutes: 90, cleanupBlockMinutes: 30 },
  { durationMinutes: 135, cleanupBlockMinutes: 30 },
];

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

test("archivované rezervace včetně úklidu prodlouží pracovní den pro aktivaci oběda", () => {
  const date = "2026-08-27";
  const availability = [interval(date, "11:15", "13:00")];
  const bookedBlocks = [
    interval(date, "08:30", "11:15"),
    interval(date, "11:15", "11:45"),
    interval(date, "13:00", "15:30"),
    interval(date, "15:30", "17:15"),
  ];

  assert.equal(shouldApplyAutoLunch({
    localDate: date,
    availability,
    globalAutoLunchEnabled: true,
    dayLunchMode: "AUTO",
  }), false);
  assert.equal(shouldApplyAutoLunch({
    localDate: date,
    availability,
    bookedBlocks,
    globalAutoLunchEnabled: true,
    dayLunchMode: "AUTO",
  }), true);
  assert.deepEqual(
    findBestAutoLunch({
      active: true,
      availability,
      lunchCandidates: generateLunchCandidates({ localDate: date, availability }),
      bookedBlocks,
    }),
    interval(date, "11:45", "12:30"),
  );
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

function select(input: Parameters<typeof rank>[0]) {
  return selectSuggestedSlots({
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

test("recommendation selection chooses ranking quality but always presents the subset chronologically", () => {
  const date = "2026-01-15";
  const candidates = suggested(date, "13:00", "10:30", "14:00", "11:00", "11:30", "12:00");
  const selected = select({
    date,
    candidates,
    bookedBlocks: [interval(date, "09:00", "10:30"), interval(date, "15:00", "16:30")],
  });

  assert.deepEqual(selected.map((candidate) => candidate.id), [...selected]
    .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime())
    .map((candidate) => candidate.id));
  assert.ok(selected.length < candidates.length, "slabší termíny se nepoužijí jako výplň do šesti");
  assert.ok(selected.every((candidate) => candidates.includes(candidate)));
});

test("recommendation selection limits equivalent empty-day candidates chronologically without mutating selectable options", () => {
  const date = "2026-01-15";
  const candidates = suggested(date, "13:30", "09:00", "12:30", "10:00", "11:30", "09:30", "11:00", "10:30", "12:00", "13:00");
  const snapshot = structuredClone(candidates);
  const selected = select({ date, candidates });

  assert.deepEqual(candidates, snapshot);
  assert.equal(selected.length, 6);
  assert.deepEqual(selected.map((candidate) => candidate.id), ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]);
});

test("service-aware orphan DP maximally packs actual booking blocks without rounding fragments", () => {
  const orphan = (minutes: number) => calculateOrphanMinutes({
    freeIntervals: [{ startsAt: 0, endsAt: minutes * 60_000 }],
    availability: [{ startsAt: 0, endsAt: minutes * 60_000 }],
    bookingBlocks: [],
    serviceBlockOptions: serviceOptions,
  });
  assert.equal(orphan(0), 0);
  assert.equal(orphan(15), 15);
  assert.equal(orphan(25), 25);
  assert.equal(orphan(30), 0);
  assert.equal(orphan(90), 0, "60 + 30, not greedy 75");
  assert.equal(orphan(100), 10);
  assert.equal(orphan(105), 0);
  assert.equal(orphan(135), 0);
  assert.equal(orphan(150), 0);
  assert.equal(orphan(180), 0);
});

test("service-aware orphan treats only the final cleanup at an availability edge as overflow", () => {
  const option = [{ durationMinutes: 60, cleanupBlockMinutes: 15 }];
  const measure = (minutes: number, edge: boolean) => calculateOrphanMinutes({
    freeIntervals: [{ startsAt: 0, endsAt: minutes * 60_000 }],
    availability: edge
      ? [{ startsAt: 0, endsAt: minutes * 60_000 }]
      : [{ startsAt: 0, endsAt: (minutes + 1) * 60_000 }],
    bookingBlocks: edge ? [] : [{ startsAt: minutes * 60_000, endsAt: (minutes + 1) * 60_000 }],
    serviceBlockOptions: option,
  });
  assert.equal(measure(60, false), 60, "internal fragment needs the 15-minute cleanup");
  assert.equal(measure(60, true), 0, "final cleanup may cross the availability edge");
  assert.equal(measure(59, true), 59, "procedure itself still must fit");
  assert.equal(measure(120, true), 45, "only the final, not the first cleanup may overflow");
  assert.equal(calculateOrphanMinutes({
    freeIntervals: [{ startsAt: 0, endsAt: 60 * 60_000 }],
    availability: [{ startsAt: 0, endsAt: 60 * 60_000 }],
    bookingBlocks: [{ startsAt: 65 * 60_000, endsAt: 90 * 60_000 }],
    serviceBlockOptions: option,
  }), 60, "cleanup overflow may not collide with a later booking");
});

test("service-aware orphan uses rounded cleanup blocks and safely falls back when options are unsupported", () => {
  assert.equal(calculateOrphanMinutes({
    freeIntervals: [{ startsAt: 0, endsAt: 100 * 60_000 }],
    availability: [{ startsAt: 0, endsAt: 100 * 60_000 }],
    bookingBlocks: [],
    serviceBlockOptions: [{ durationMinutes: 90, cleanupBlockMinutes: 30 }],
  }), 10, "90-minute procedure plus rounded 30-minute cleanup only fits at the edge");
  assert.equal(calculateOrphanMinutes({
    freeIntervals: [{ startsAt: 0, endsAt: 115 * 60_000 }],
    availability: [{ startsAt: 0, endsAt: 116 * 60_000 }],
    bookingBlocks: [{ startsAt: 115 * 60_000, endsAt: 116 * 60_000 }],
    serviceBlockOptions: [{ durationMinutes: 90, cleanupBlockMinutes: 30 }],
  }), 115, "raw 20-minute cleanup must not be treated as an unrounded 110-minute block");
  assert.equal(calculateOrphanMinutes({
    freeIntervals: [{ startsAt: 0, endsAt: 15 * 60_000 }],
    availability: [{ startsAt: 0, endsAt: 15 * 60_000 }],
    bookingBlocks: [],
    serviceBlockOptions: [{ durationMinutes: 30.5, cleanupBlockMinutes: 0 }],
  }), 0);
});

test("ranking uses orphanMinutes after fragment count while keeping date-first and capacity fallbacks", () => {
  const date = "2026-01-15";
  const ranked = rankSuggestedSlots({
    candidates: suggested(date, "09:15", "10:30"),
    availability: [interval(date, "09:00", "12:30")],
    bookedBlocks: [],
    serviceDurationMinutes: 30,
    cleanupBlockMinutes: 0,
    capacity: 1,
    globalAutoLunchEnabled: false,
    dayLunchModes: {},
    serviceBlockOptions: serviceOptions,
    supportsServiceAwareOrphans: true,
  });
  assert.equal(ranked[0]?.id, "10:30", "90 + 90 beats 15 + 165 due to orphan 0 < 15");
  assert.deepEqual(rankSuggestedSlots({
    candidates: [...suggested(date, "10:30"), ...suggested("2026-01-16", "09:15")],
    availability: [interval(date, "09:00", "12:30"), interval("2026-01-16", "09:00", "12:30")],
    bookedBlocks: [], serviceDurationMinutes: 30, cleanupBlockMinutes: 0, capacity: 1,
    globalAutoLunchEnabled: false, dayLunchModes: {}, serviceBlockOptions: serviceOptions, supportsServiceAwareOrphans: true,
  }).map((candidate) => candidate.startsAt), [
    ...suggested(date, "10:30").map((candidate) => candidate.startsAt),
    ...suggested("2026-01-16", "09:15").map((candidate) => candidate.startsAt),
  ]);
  assert.deepEqual(rankSuggestedSlots({
    candidates: suggested(date, "10:30", "09:15"), availability: [interval(date, "09:00", "12:30")], bookedBlocks: [],
    serviceDurationMinutes: 30, cleanupBlockMinutes: 0, capacity: 2, globalAutoLunchEnabled: false, dayLunchModes: {}, serviceBlockOptions: serviceOptions, supportsServiceAwareOrphans: true,
  }).map((candidate) => candidate.id), ["10:30", "09:15"]);
});

test("recommendation selection preserves date-first presentation and lunch-aware quality", () => {
  const monday = "2026-07-15";
  const tuesday = "2026-07-16";
  const candidates = [
    ...suggested(monday, "10:30", "12:00", "13:30"),
    ...suggested(tuesday, "09:00", "09:30"),
  ];
  const selected = select({
    date: monday,
    candidates,
    availability: [...fullDay(monday), ...fullDay(tuesday)],
    bookedBlocks: [interval(monday, "09:00", "10:30"), interval(monday, "15:00", "16:30")],
    autoLunch: true,
  });

  assert.deepEqual(selected.map((candidate) => candidate.startsAt), [...selected]
    .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime())
    .map((candidate) => candidate.startsAt));
  assert.ok(selected.some((candidate) => candidate.id === "10:30"), "lunch lze přesunout a přesto zůstává kvalitní kandidát");
  assert.ok(selected.every((candidate) => candidates.includes(candidate)));
});

test("recommendation simulation reports variable subset sizes and chronological subsets", () => {
  const date = "2026-01-15";
  const scenarios = [
    { name: "prázdný den", bookedBlocks: [] as ScheduleInterval[], candidates: suggested(date, "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00") },
    { name: "ranní rezervace", bookedBlocks: [interval(date, "09:00", "10:30")], candidates: suggested(date, "10:30", "11:00", "12:00", "13:00") },
    { name: "odpolední rezervace", bookedBlocks: [interval(date, "15:00", "16:30")], candidates: suggested(date, "10:30", "11:00", "12:00", "13:00") },
    { name: "obě strany", bookedBlocks: [interval(date, "09:00", "10:30"), interval(date, "15:00", "16:30")], candidates: suggested(date, "10:30", "11:00", "12:00", "13:00", "13:30") },
    { name: "krátká mezera", bookedBlocks: [interval(date, "09:00", "11:00"), interval(date, "12:00", "17:00")], candidates: suggested(date, "11:00") },
    { name: "dlouhá mezera", bookedBlocks: [interval(date, "09:00", "10:00")], candidates: suggested(date, "10:00", "11:00", "12:00", "13:00") },
    { name: "aktivní lunch", bookedBlocks: [interval(date, "09:00", "10:30"), interval(date, "15:00", "16:30")], candidates: suggested(date, "10:30", "12:00", "13:30"), autoLunch: true },
    { name: "day OFF", bookedBlocks: [interval(date, "09:00", "10:30")], candidates: suggested(date, "10:30", "12:00", "13:00"), autoLunch: true, dayLunchModes: { [date]: "OFF" as const } },
  ];
  const counts: number[] = [];
  for (const scenario of scenarios) {
    const selected = select({ date, ...scenario });
    counts.push(selected.length);
    assert.ok(selected.every((candidate) => scenario.candidates.includes(candidate)), `${scenario.name}: subset selectable options`);
    assert.deepEqual(selected, [...selected].sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()), `${scenario.name}: chronologicky`);
  }
  assert.equal(counts.filter((count) => count === 6).length, 1);
  assert.equal(counts.filter((count) => count < 6).length, 7);
  assert.equal(Math.min(...counts), 1);
  assert.equal(Math.max(...counts), 6);
  assert.equal(counts.reduce((sum, count) => sum + count, 0) / counts.length, 1.625);
});
