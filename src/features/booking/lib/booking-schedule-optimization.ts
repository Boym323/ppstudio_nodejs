import { resolvePragueLocalDateTime } from "./booking-local-time";

export const AUTO_LUNCH_POLICY = {
  durationMinutes: 45,
  earliestStart: "11:00",
  latestStart: "13:00",
  candidateStepMinutes: 15,
  minimumShiftMinutes: 5 * 60,
  timeZone: "Europe/Prague",
} as const;

const MINUTE_MS = 60_000;

export type ScheduleInterval = { startsAt: number; endsAt: number };
export type LunchCandidate = ScheduleInterval;
export type BookingBlock = ScheduleInterval & { capacity?: number };
export type DayLunchMode = "AUTO" | "OFF";
export type LunchFeasibility = { active: boolean; feasible: boolean; candidates: LunchCandidate[] };
export type FragmentationMetrics = {
  fragmentCount: number;
  largestFreeBlockMinutes: number;
  orphanMinutes: number;
  bookingAdjacencyMinutes: number;
  availabilityEdgeMinutes: number;
};

function valid(interval: ScheduleInterval) {
  return Number.isFinite(interval.startsAt) && Number.isFinite(interval.endsAt) && interval.endsAt > interval.startsAt;
}

function normalized(intervals: ScheduleInterval[]) {
  const merged: ScheduleInterval[] = [];
  for (const interval of intervals.filter(valid).map(({ startsAt, endsAt }) => ({ startsAt, endsAt })).sort((a, b) => a.startsAt - b.startsAt || a.endsAt - b.endsAt)) {
    const previous = merged.at(-1);
    if (previous && interval.startsAt <= previous.endsAt) previous.endsAt = Math.max(previous.endsAt, interval.endsAt);
    else merged.push(interval);
  }
  return merged;
}

function covered(interval: ScheduleInterval, availability: ScheduleInterval[]) {
  return availability.some((available) => available.startsAt <= interval.startsAt && available.endsAt >= interval.endsAt);
}

function overlaps(left: ScheduleInterval, right: ScheduleInterval) {
  return left.startsAt < right.endsAt && right.startsAt < left.endsAt;
}

function subtract(availability: ScheduleInterval[], occupied: ScheduleInterval[]) {
  let free = normalized(availability);
  for (const block of normalized(occupied)) {
    free = free.flatMap((interval) => {
      if (!overlaps(interval, block)) return [interval];
      const before = interval.startsAt < block.startsAt ? { startsAt: interval.startsAt, endsAt: Math.min(interval.endsAt, block.startsAt) } : null;
      const after = interval.endsAt > block.endsAt ? { startsAt: Math.max(interval.startsAt, block.endsAt), endsAt: interval.endsAt } : null;
      return [before, after].filter((part): part is ScheduleInterval => part !== null && valid(part));
    });
  }
  return free;
}

function localInstant(localDate: string, time: string) {
  return resolvePragueLocalDateTime(localDate, time)?.getTime() ?? null;
}

/** Converts Prague wall-clock lunch times into instants, including DST rules. */
export function generateLunchCandidates(input: { localDate: string; availability: ScheduleInterval[] }) {
  const first = localInstant(input.localDate, AUTO_LUNCH_POLICY.earliestStart);
  const last = localInstant(input.localDate, AUTO_LUNCH_POLICY.latestStart);
  if (first === null || last === null) return [];
  const availability = normalized(input.availability);
  const candidates: LunchCandidate[] = [];
  for (let startsAt = first; startsAt <= last; startsAt += AUTO_LUNCH_POLICY.candidateStepMinutes * MINUTE_MS) {
    const candidate = { startsAt, endsAt: startsAt + AUTO_LUNCH_POLICY.durationMinutes * MINUTE_MS };
    if (covered(candidate, availability)) candidates.push(candidate);
  }
  return candidates;
}

/** Activation uses raw published availability only; booking blocks never enter this decision. */
export function shouldApplyAutoLunch(input: { localDate: string; availability: ScheduleInterval[]; globalAutoLunchEnabled: boolean; dayLunchMode: DayLunchMode }) {
  if (!input.globalAutoLunchEnabled || input.dayLunchMode === "OFF") return false;
  const availability = normalized(input.availability);
  const total = availability.reduce((sum, interval) => sum + interval.endsAt - interval.startsAt, 0);
  const onePm = localInstant(input.localDate, AUTO_LUNCH_POLICY.latestStart);
  return total >= AUTO_LUNCH_POLICY.minimumShiftMinutes * MINUTE_MS
    && onePm !== null
    && availability.some((interval) => interval.endsAt > onePm)
    && generateLunchCandidates(input).length > 0;
}

export function findAvailableLunchCandidates(input: { availability: ScheduleInterval[]; lunchCandidates: LunchCandidate[]; bookedBlocks?: BookingBlock[]; hypotheticalBlock?: ScheduleInterval }) {
  const occupied = [...(input.bookedBlocks ?? []), ...(input.hypotheticalBlock ? [input.hypotheticalBlock] : [])];
  const free = subtract(input.availability, occupied);
  return input.lunchCandidates.filter((candidate) => covered(candidate, free));
}

export function canPreserveAutoLunch(input: { active: boolean; availability: ScheduleInterval[]; lunchCandidates: LunchCandidate[]; bookedBlocks?: BookingBlock[]; hypotheticalBlock?: ScheduleInterval }): LunchFeasibility {
  if (!input.active) return { active: false, feasible: true, candidates: [] };
  const candidates = findAvailableLunchCandidates(input);
  return { active: true, feasible: candidates.length > 0, candidates };
}

export function measureFragmentation(input: { freeIntervals: ScheduleInterval[]; availability: ScheduleInterval[]; bookingBlocks: ScheduleInterval[] }): FragmentationMetrics {
  const free = normalized(input.freeIntervals);
  const availability = normalized(input.availability);
  const booked = normalized(input.bookingBlocks);
  const minutes = (interval: ScheduleInterval) => (interval.endsAt - interval.startsAt) / MINUTE_MS;
  return {
    fragmentCount: free.length,
    largestFreeBlockMinutes: free.reduce((largest, interval) => Math.max(largest, minutes(interval)), 0),
    // A service catalogue is intentionally not an engine input in Phase 1.
    orphanMinutes: 0,
    bookingAdjacencyMinutes: free.filter((item) => booked.some((block) => block.endsAt === item.startsAt || block.startsAt === item.endsAt)).reduce((sum, item) => sum + minutes(item), 0),
    availabilityEdgeMinutes: free.filter((item) => availability.some((block) => block.startsAt === item.startsAt || block.endsAt === item.endsAt)).reduce((sum, item) => sum + minutes(item), 0),
  };
}

function compare(left: LunchCandidate, leftMetrics: FragmentationMetrics, right: LunchCandidate, rightMetrics: FragmentationMetrics, center: number) {
  return [
    leftMetrics.fragmentCount - rightMetrics.fragmentCount,
    rightMetrics.largestFreeBlockMinutes - leftMetrics.largestFreeBlockMinutes,
    rightMetrics.bookingAdjacencyMinutes - leftMetrics.bookingAdjacencyMinutes,
    rightMetrics.availabilityEdgeMinutes - leftMetrics.availabilityEdgeMinutes,
    Math.abs(left.startsAt - center) - Math.abs(right.startsAt - center),
    left.startsAt - right.startsAt,
  ].find((value) => value !== 0) ?? 0;
}

export function findBestAutoLunch(input: { active: boolean; availability: ScheduleInterval[]; lunchCandidates: LunchCandidate[]; bookedBlocks?: BookingBlock[] }) {
  if (!input.active) return null;
  const candidates = findAvailableLunchCandidates(input);
  const center = candidates.length ? (candidates[0].startsAt + candidates.at(-1)!.startsAt) / 2 : 0;
  let best: LunchCandidate | null = null;
  let bestMetrics: FragmentationMetrics | null = null;
  for (const candidate of candidates) {
    const booked = [...(input.bookedBlocks ?? []), candidate];
    const metrics = measureFragmentation({ freeIntervals: subtract(input.availability, booked), availability: input.availability, bookingBlocks: booked });
    if (!best || !bestMetrics || compare(candidate, metrics, best, bestMetrics, center) < 0) {
      best = candidate;
      bestMetrics = metrics;
    }
  }
  return best;
}
