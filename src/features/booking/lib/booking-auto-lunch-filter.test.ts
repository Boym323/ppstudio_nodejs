import assert from "node:assert/strict";
import test from "node:test";

import { resolvePragueLocalDateTime } from "./booking-local-time";
import {
  filterTimeOptionsForAutoLunch,
  type TimeSlotOption,
} from "./booking-time-slots";

const localDate = "2026-07-15";

function iso(time: string) {
  const value = resolvePragueLocalDateTime(localDate, time);
  assert.ok(value);
  return value.toISOString();
}

function option(start: string, serviceDurationMinutes: number): TimeSlotOption {
  const startsAt = iso(start);
  return {
    key: startsAt,
    slotId: "slot-1",
    startsAt,
    endsAt: new Date(new Date(startsAt).getTime() + serviceDurationMinutes * 60_000).toISOString(),
    publicNote: null,
    isDisabled: false,
  };
}

function context(input?: {
  availabilityStart?: string;
  availabilityEnd?: string;
  globalAutoLunchEnabled?: boolean;
  dayLunchMode?: "AUTO" | "OFF";
  bookedIntervals?: Array<{ start: string; end: string }>;
}): Parameters<typeof filterTimeOptionsForAutoLunch>[1]["scheduleOptimization"] {
  return {
    globalAutoLunchEnabled: input?.globalAutoLunchEnabled ?? true,
    dayLunchModes: input?.dayLunchMode ? { [localDate]: input.dayLunchMode } : {},
    publishedAvailability: [{
      startsAt: iso(input?.availabilityStart ?? "09:00"),
      endsAt: iso(input?.availabilityEnd ?? "17:00"),
    }],
    bookedIntervals: (input?.bookedIntervals ?? []).map((interval) => ({
      startsAt: iso(interval.start),
      endsAt: iso(interval.end),
    })),
  };
}

function filter(
  candidate: TimeSlotOption,
  scheduleOptimization = context(),
  cleanupBlockMinutes = 0,
) {
  return filterTimeOptionsForAutoLunch([candidate], {
    serviceDurationMinutes:
      (new Date(candidate.endsAt).getTime() - new Date(candidate.startsAt).getTime()) / 60_000,
    cleanupBlockMinutes,
    capacity: 1,
    scheduleOptimization,
  });
}

test("neaktivní lunch policy zachová původní selectable termíny", () => {
  const candidate = option("11:00", 165);
  assert.deepEqual(filter(candidate, context({ globalAutoLunchEnabled: false })), [candidate]);
});

test("rezervace, která pouze přesune oběd, zůstane selectable", () => {
  const candidate = option("11:00", 60);
  assert.deepEqual(filter(candidate), [candidate]);
});

test("rezervace ponechávající přesně jeden oběd zůstane selectable", () => {
  const candidate = option("11:00", 120);
  assert.deepEqual(filter(candidate), [candidate]);
});

test("rezervace odstraňující poslední možnost oběda není selectable", () => {
  assert.deepEqual(filter(option("11:00", 165)), []);
});

test("cleanup odstraňující poslední možnost oběda není selectable", () => {
  assert.deepEqual(filter(option("10:30", 30), context(), 165), []);
});

test("krátká směna lunch constraint nepoužije", () => {
  const candidate = option("11:00", 165);
  assert.deepEqual(filter(candidate, context({ availabilityEnd: "13:00" })), [candidate]);
});

test("global OFF a day OFF lunch constraint nepoužijí", () => {
  const candidate = option("11:00", 165);
  assert.deepEqual(filter(candidate, context({ globalAutoLunchEnabled: false })), [candidate]);
  assert.deepEqual(filter(candidate, context({ dayLunchMode: "OFF" })), [candidate]);
});

test("capacity vyšší než jedna použije nezměněný chronologický fallback", () => {
  const candidate = option("11:00", 165);
  assert.deepEqual(filterTimeOptionsForAutoLunch([candidate], {
    serviceDurationMinutes: 165,
    cleanupBlockMinutes: 0,
    capacity: 2,
    scheduleOptimization: context(),
  }), [candidate]);
});

test("filtrování zachová chronologické pořadí a předem disabled možnosti", () => {
  const early = option("09:00", 60);
  const blocked = { ...option("11:00", 165), isDisabled: true };
  const late = option("14:00", 60);
  assert.deepEqual(
    filterTimeOptionsForAutoLunch([early, blocked, late], {
      serviceDurationMinutes: 60,
      cleanupBlockMinutes: 0,
      capacity: 1,
      scheduleOptimization: context(),
    }),
    [early, blocked, late],
  );
});
