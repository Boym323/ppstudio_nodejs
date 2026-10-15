import { getNextCalendarDate, getPragueLocalDate, resolvePragueLocalDateTime } from "./booking-local-time";

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
export type ServiceBookingBlockOption = {
  durationMinutes: number;
  cleanupBlockMinutes: number;
};
export type DayLunchMode = "AUTO" | "OFF";
export type LunchFeasibility = { active: boolean; feasible: boolean; candidates: LunchCandidate[] };
export type FragmentationMetrics = {
  fragmentCount: number;
  largestFreeBlockMinutes: number;
  orphanMinutes: number;
  bookingAdjacencyMinutes: number;
  availabilityEdgeMinutes: number;
};
export type SuggestedSlotCandidate = { startsAt: string };
export type AutoLunchDayContext = {
  active: boolean;
  availability: ScheduleInterval[];
  lunchCandidates: LunchCandidate[];
  lunchCandidatesWithoutBookings: LunchCandidate[];
  bookedBlocks: BookingBlock[];
};

type EvaluatedSuggestedSlot<T> = {
  candidate: T;
  index: number;
  startsAt: number;
  candidateAdjacency: number;
  metrics: FragmentationMetrics;
};

type SuggestedSlotRankingInput<T extends SuggestedSlotCandidate> = {
  candidates: readonly T[];
  availability: ScheduleInterval[];
  bookedBlocks: BookingBlock[];
  serviceDurationMinutes: number;
  cleanupBlockMinutes: number;
  capacity: number;
  globalAutoLunchEnabled: boolean;
  dayLunchModes: Record<string, DayLunchMode | undefined>;
  serviceBlockOptions?: readonly ServiceBookingBlockOption[];
  supportsServiceAwareOrphans?: boolean;
};

type MaxInternalUtilization = (fragmentMinutes: number) => number;

type RankedSuggestedSlots<T> = {
  candidates: T[];
  qualities: Map<T, FragmentationMetrics | null>;
};

function valid(interval: ScheduleInterval) {
  return Number.isFinite(interval.startsAt) && Number.isFinite(interval.endsAt) && interval.endsAt > interval.startsAt;
}

function normalized(intervals: readonly ScheduleInterval[]) {
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
  return subtractNormalized(normalized(availability), normalized(occupied));
}

function subtractNormalized(availability: readonly ScheduleInterval[], occupied: readonly ScheduleInterval[]) {
  let free = [...availability];
  for (const block of occupied) {
    free = free.flatMap((interval) => {
      if (!overlaps(interval, block)) return [interval];
      const before = interval.startsAt < block.startsAt ? { startsAt: interval.startsAt, endsAt: Math.min(interval.endsAt, block.startsAt) } : null;
      const after = interval.endsAt > block.endsAt ? { startsAt: Math.max(interval.startsAt, block.endsAt), endsAt: interval.endsAt } : null;
      return [before, after].filter((part): part is ScheduleInterval => part !== null && valid(part));
    });
  }
  return free;
}

function intervalsForDay(intervals: ScheduleInterval[], startsAt: number, endsAt: number) {
  return intervals.flatMap((interval) => {
    const dayInterval = {
      startsAt: Math.max(interval.startsAt, startsAt),
      endsAt: Math.min(interval.endsAt, endsAt),
    };
    return valid(dayInterval) ? [dayInterval] : [];
  });
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

/**
 * Aktivace vychází z reálného pracovního dne: publikované dostupnosti a již
 * obsazených bloků včetně úklidu. Kandidát na oběd ale musí vždy zůstat v
 * publikované dostupnosti.
 */
export function shouldApplyAutoLunch(input: { localDate: string; availability: ScheduleInterval[]; bookedBlocks?: BookingBlock[]; globalAutoLunchEnabled: boolean; dayLunchMode: DayLunchMode; lunchCandidates?: LunchCandidate[] }) {
  if (!input.globalAutoLunchEnabled || input.dayLunchMode === "OFF") return false;
  const workingDay = normalized([...input.availability, ...(input.bookedBlocks ?? [])]);
  const total = workingDay.reduce((sum, interval) => sum + interval.endsAt - interval.startsAt, 0);
  const onePm = localInstant(input.localDate, AUTO_LUNCH_POLICY.latestStart);
  return total >= AUTO_LUNCH_POLICY.minimumShiftMinutes * MINUTE_MS
    && onePm !== null
    && workingDay.some((interval) => interval.endsAt > onePm)
    && (input.lunchCandidates ?? generateLunchCandidates(input)).length > 0;
}

export function createAutoLunchDayContext(input: {
  localDate: string;
  availability: ScheduleInterval[];
  bookedBlocks?: BookingBlock[];
  globalAutoLunchEnabled: boolean;
  dayLunchMode: DayLunchMode;
}): AutoLunchDayContext {
  const availability = normalized(input.availability);
  const bookedBlocks = normalized(input.bookedBlocks ?? []);
  const lunchCandidates = generateLunchCandidates({ localDate: input.localDate, availability });
  return {
    active: shouldApplyAutoLunch({
      ...input,
      availability,
      bookedBlocks,
      lunchCandidates,
    }),
    availability,
    lunchCandidates,
    lunchCandidatesWithoutBookings: lunchCandidates.filter(
      (candidate) => !bookedBlocks.some((block) => overlaps(candidate, block)),
    ),
    bookedBlocks,
  };
}

export function canPreserveAutoLunchInContext(input: {
  context: AutoLunchDayContext;
  hypotheticalBlock: ScheduleInterval;
}) {
  if (!input.context.active) return true;
  return input.context.lunchCandidatesWithoutBookings.some(
    (candidate) => !overlaps(candidate, input.hypotheticalBlock),
  );
}

export function findAvailableLunchCandidates(input: { availability: ScheduleInterval[]; lunchCandidates: LunchCandidate[]; bookedBlocks?: BookingBlock[]; hypotheticalBlock?: ScheduleInterval }) {
  const availability = normalized(input.availability);
  const occupied = normalized([
    ...(input.bookedBlocks ?? []),
    ...(input.hypotheticalBlock ? [input.hypotheticalBlock] : []),
  ]);
  return input.lunchCandidates.filter((candidate) => covered(candidate, availability)
    && !occupied.some((block) => overlaps(candidate, block)));
}

export function canPreserveAutoLunch(input: { active: boolean; availability: ScheduleInterval[]; lunchCandidates: LunchCandidate[]; bookedBlocks?: BookingBlock[]; hypotheticalBlock?: ScheduleInterval }): LunchFeasibility {
  if (!input.active) return { active: false, feasible: true, candidates: [] };
  const candidates = findAvailableLunchCandidates(input);
  return { active: true, feasible: candidates.length > 0, candidates };
}

function validServiceOptions(options: readonly ServiceBookingBlockOption[] | undefined) {
  if (!options?.length) return null;
  const unique = new Map<string, ServiceBookingBlockOption>();
  for (const option of options) {
    if (!Number.isInteger(option.durationMinutes) || option.durationMinutes <= 0
      || !Number.isInteger(option.cleanupBlockMinutes) || option.cleanupBlockMinutes < 0) return null;
    unique.set(`${option.durationMinutes}:${option.cleanupBlockMinutes}`, option);
  }
  return [...unique.values()];
}

function createMaxInternalUtilization(options: readonly ServiceBookingBlockOption[]): MaxInternalUtilization {
  const blockMinutes = options.map((option) => option.durationMinutes + option.cleanupBlockMinutes);
  let reachable = new Uint8Array([1]);
  let computedThrough = 0;
  const results = new Map<number, number>();

  return (fragmentMinutes) => {
    const cached = results.get(fragmentMinutes);
    if (cached !== undefined) return cached;
    if (!Number.isInteger(fragmentMinutes) || fragmentMinutes < 0) return 0;

    if (fragmentMinutes > computedThrough) {
      const next = new Uint8Array(fragmentMinutes + 1);
      next.set(reachable);
      for (let minute = computedThrough + 1; minute <= fragmentMinutes; minute += 1) {
        next[minute] = Number(blockMinutes.some((block) => block <= minute && next[minute - block] === 1));
      }
      reachable = next;
      computedThrough = fragmentMinutes;
    }

    for (let minute = fragmentMinutes; minute >= 0; minute -= 1) {
      if (reachable[minute]) {
        results.set(fragmentMinutes, minute);
        return minute;
      }
    }
    results.set(fragmentMinutes, 0);
    return 0;
  };
}

function calculateOrphanMinutesFromPrepared(
  freeIntervals: readonly ScheduleInterval[],
  availability: readonly ScheduleInterval[],
  booked: readonly ScheduleInterval[],
  options: readonly ServiceBookingBlockOption[],
  maxUtilization: MaxInternalUtilization,
) {
  let orphanMinutes = 0;

  for (const fragment of freeIntervals) {
    const fragmentMinutes = (fragment.endsAt - fragment.startsAt) / MINUTE_MS;
    if (!Number.isInteger(fragmentMinutes) || fragmentMinutes < 0) return 0;
    const availabilityEdge = availability.some((interval) => interval.endsAt === fragment.endsAt);
    let utilized = maxUtilization(fragmentMinutes);

    if (availabilityEdge) {
      const nextBookingStart = booked.find((block) => block.startsAt >= fragment.endsAt)?.startsAt;
      const cleanupOverflowMinutes = nextBookingStart === undefined
        ? Number.POSITIVE_INFINITY
        : (nextBookingStart - fragment.endsAt) / MINUTE_MS;
      for (const last of options) {
        if (last.durationMinutes > fragmentMinutes || last.cleanupBlockMinutes > cleanupOverflowMinutes) continue;
        const beforeLast = maxUtilization(fragmentMinutes - last.durationMinutes);
        utilized = Math.max(utilized, beforeLast + last.durationMinutes);
      }
    }

    orphanMinutes += fragmentMinutes - utilized;
  }
  return orphanMinutes;
}

/**
 * Returns unavailable minutes after optimally packing future bookings. At a
 * published-availability edge only the final booking may let its cleanup run
 * past the edge, matching the authoritative coverage rule.
 */
export function calculateOrphanMinutes(input: {
  freeIntervals: ScheduleInterval[];
  availability: ScheduleInterval[];
  bookingBlocks: ScheduleInterval[];
  serviceBlockOptions?: readonly ServiceBookingBlockOption[];
}) {
  const options = validServiceOptions(input.serviceBlockOptions);
  if (!options) return 0;
  const availability = normalized(input.availability);
  const booked = normalized(input.bookingBlocks);
  return calculateOrphanMinutesFromPrepared(
    normalized(input.freeIntervals),
    availability,
    booked,
    options,
    createMaxInternalUtilization(options),
  );
}

type FragmentationInput = {
  freeIntervals: ScheduleInterval[];
  availability: ScheduleInterval[];
  bookingBlocks: ScheduleInterval[];
  serviceBlockOptions?: readonly ServiceBookingBlockOption[];
};

function measureFragmentationWithUtilization(input: FragmentationInput, maxUtilization?: MaxInternalUtilization): FragmentationMetrics {
  const free = normalized(input.freeIntervals);
  const availability = normalized(input.availability);
  const booked = normalized(input.bookingBlocks);
  const options = validServiceOptions(input.serviceBlockOptions);
  const minutes = (interval: ScheduleInterval) => (interval.endsAt - interval.startsAt) / MINUTE_MS;
  return {
    fragmentCount: free.length,
    largestFreeBlockMinutes: free.reduce((largest, interval) => Math.max(largest, minutes(interval)), 0),
    orphanMinutes: options
      ? calculateOrphanMinutesFromPrepared(
        free,
        availability,
        booked,
        options,
        maxUtilization ?? createMaxInternalUtilization(options),
      )
      : 0,
    bookingAdjacencyMinutes: free.filter((item) => booked.some((block) => block.endsAt === item.startsAt || block.startsAt === item.endsAt)).reduce((sum, item) => sum + minutes(item), 0),
    availabilityEdgeMinutes: free.filter((item) => availability.some((block) => block.startsAt === item.startsAt || block.endsAt === item.endsAt)).reduce((sum, item) => sum + minutes(item), 0),
  };
}

export function measureFragmentation(input: FragmentationInput): FragmentationMetrics {
  return measureFragmentationWithUtilization(input);
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

function compareEvaluatedSuggestedSlots<T>(left: EvaluatedSuggestedSlot<T>, right: EvaluatedSuggestedSlot<T>) {
  return [
    left.metrics.fragmentCount - right.metrics.fragmentCount,
    left.metrics.orphanMinutes - right.metrics.orphanMinutes,
    right.metrics.largestFreeBlockMinutes - left.metrics.largestFreeBlockMinutes,
    right.candidateAdjacency - left.candidateAdjacency,
    right.metrics.bookingAdjacencyMinutes - left.metrics.bookingAdjacencyMinutes,
    right.metrics.availabilityEdgeMinutes - left.metrics.availabilityEdgeMinutes,
    left.startsAt - right.startsAt,
    left.index - right.index,
  ].find((value) => value !== 0) ?? 0;
}

function hasSameRecommendationQuality(left: FragmentationMetrics, right: FragmentationMetrics) {
  return left.fragmentCount === right.fragmentCount
    && left.orphanMinutes === right.orphanMinutes
    && left.largestFreeBlockMinutes === right.largestFreeBlockMinutes;
}

function chronologicalSuggestedSlots<T extends SuggestedSlotCandidate>(candidates: readonly T[]) {
  return [...candidates].sort((left, right) => {
    const leftStartsAt = new Date(left.startsAt).getTime();
    const rightStartsAt = new Date(right.startsAt).getTime();
    return leftStartsAt - rightStartsAt;
  });
}

export function findBestAutoLunch(input: { active: boolean; availability: ScheduleInterval[]; lunchCandidates: LunchCandidate[]; bookedBlocks?: BookingBlock[] }) {
  if (!input.active) return null;
  const availability = normalized(input.availability);
  const bookedBlocks = normalized(input.bookedBlocks ?? []);
  const free = subtractNormalized(availability, bookedBlocks);
  const candidates = input.lunchCandidates.filter((candidate) => covered(candidate, free));
  const center = candidates.length ? (candidates[0].startsAt + candidates.at(-1)!.startsAt) / 2 : 0;
  let best: LunchCandidate | null = null;
  let bestMetrics: FragmentationMetrics | null = null;
  for (const candidate of candidates) {
    const booked = normalized([...bookedBlocks, candidate]);
    const metrics = measureFragmentationWithUtilization({
      freeIntervals: subtractNormalized(availability, booked),
      availability,
      bookingBlocks: booked,
    });
    if (!best || !bestMetrics || compare(candidate, metrics, best, bestMetrics, center) < 0) {
      best = candidate;
      bestMetrics = metrics;
    }
  }
  return best;
}

/**
 * Returns a date-first, in-memory ranking for an already valid set of public candidates.
 * It deliberately never filters or mutates the input array; any incomplete day context
 * falls back to the original chronological order for that day.
 */
function rankSuggestedSlotsWithQuality<T extends SuggestedSlotCandidate>(input: SuggestedSlotRankingInput<T>): RankedSuggestedSlots<T> {
  const chronological = [...input.candidates];
  const qualities = new Map<T, FragmentationMetrics | null>();
  if (input.capacity !== 1 || input.serviceDurationMinutes <= 0 || input.cleanupBlockMinutes < 0) {
    return { candidates: chronological, qualities };
  }

  const orphanOptions = input.supportsServiceAwareOrphans
    ? validServiceOptions(input.serviceBlockOptions)
    : null;
  const maxUtilization = orphanOptions ? createMaxInternalUtilization(orphanOptions) : undefined;

  const grouped = new Map<string, Array<{ candidate: T; index: number; startsAt: number }>>();
  for (const [index, candidate] of chronological.entries()) {
    const startsAt = new Date(candidate.startsAt).getTime();
    if (!Number.isFinite(startsAt)) return { candidates: chronological, qualities };
    const dateKey = getPragueLocalDate(new Date(startsAt));
    const group = grouped.get(dateKey) ?? [];
    group.push({ candidate, index, startsAt });
    grouped.set(dateKey, group);
  }

  const ranked = [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([localDate, candidates]) => {
      const nextDate = getNextCalendarDate(localDate);
      const dayStartsAt = resolvePragueLocalDateTime(localDate, "00:00")?.getTime();
      const dayEndsAt = nextDate ? resolvePragueLocalDateTime(nextDate, "00:00")?.getTime() : undefined;
      if (dayStartsAt === undefined || dayEndsAt === undefined) return candidates.map(({ candidate }) => candidate);

      const availability = intervalsForDay(input.availability, dayStartsAt, dayEndsAt);
      const bookedBlocks = intervalsForDay(input.bookedBlocks, dayStartsAt, dayEndsAt);
      if (availability.length === 0) return candidates.map(({ candidate }) => candidate);

      const active = shouldApplyAutoLunch({
        localDate,
        availability,
        bookedBlocks,
        globalAutoLunchEnabled: input.globalAutoLunchEnabled,
        dayLunchMode: input.dayLunchModes[localDate] ?? "AUTO",
      });
      const lunchCandidates = generateLunchCandidates({ localDate, availability });
      const blockDurationMs = (input.serviceDurationMinutes + input.cleanupBlockMinutes) * MINUTE_MS;
      const evaluated = candidates.map((entry) => {
        const hypotheticalBlock = { startsAt: entry.startsAt, endsAt: entry.startsAt + blockDurationMs };
        const lunch = findBestAutoLunch({
          active,
          availability,
          lunchCandidates,
          bookedBlocks: [...bookedBlocks, hypotheticalBlock],
        });
        if (active && !lunch) return null;
        const resultBlocks = [...bookedBlocks, hypotheticalBlock, ...(lunch ? [lunch] : [])];
        const metrics = measureFragmentationWithUtilization({
          freeIntervals: subtract(availability, resultBlocks),
          availability,
          bookingBlocks: resultBlocks,
          serviceBlockOptions: input.supportsServiceAwareOrphans ? input.serviceBlockOptions : undefined,
        }, maxUtilization);
        return {
          ...entry,
          candidateAdjacency: bookedBlocks.reduce(
            (count, block) => count + Number(
              block.endsAt === hypotheticalBlock.startsAt || block.startsAt === hypotheticalBlock.endsAt,
            ),
            0,
          ),
          metrics,
        };
      });
      if (evaluated.some((entry) => entry === null)) {
        for (const { candidate } of candidates) qualities.set(candidate, null);
        return candidates.map(({ candidate }) => candidate);
      }

      for (const entry of evaluated as EvaluatedSuggestedSlot<T>[]) {
        qualities.set(entry.candidate, entry.metrics);
      }

      return (evaluated as EvaluatedSuggestedSlot<T>[])
        .sort(compareEvaluatedSuggestedSlots)
        .map(({ candidate }) => candidate);
    });

  return { candidates: ranked, qualities };
}

export function rankSuggestedSlots<T extends SuggestedSlotCandidate>(input: SuggestedSlotRankingInput<T>): T[] {
  return rankSuggestedSlotsWithQuality(input).candidates;
}

/**
 * Selects the genuinely best qualitative class from each Prague day, then presents
 * that subset chronologically. Ranking chooses membership; it never dictates UI order.
 */
export function selectSuggestedSlots<T extends SuggestedSlotCandidate>(input: {
  candidates: readonly T[];
  availability: ScheduleInterval[];
  bookedBlocks: BookingBlock[];
  serviceDurationMinutes: number;
  cleanupBlockMinutes: number;
  capacity: number;
  globalAutoLunchEnabled: boolean;
  dayLunchModes: Record<string, DayLunchMode | undefined>;
  serviceBlockOptions?: readonly ServiceBookingBlockOption[];
  supportsServiceAwareOrphans?: boolean;
  limit?: number;
}): T[] {
  const limit = input.limit ?? 6;
  if (limit <= 0) return [];

  const chronological = chronologicalSuggestedSlots(input.candidates);
  if (input.capacity !== 1 || input.serviceDurationMinutes <= 0 || input.cleanupBlockMinutes < 0) {
    return chronological.slice(0, limit);
  }

  const rankedResult = rankSuggestedSlotsWithQuality(input);
  const ranked = rankedResult.candidates;
  const grouped = new Map<string, T[]>();
  for (const candidate of ranked) {
    const startsAt = new Date(candidate.startsAt).getTime();
    if (!Number.isFinite(startsAt)) return chronological.slice(0, limit);
    const dateKey = getPragueLocalDate(new Date(startsAt));
    const group = grouped.get(dateKey) ?? [];
    group.push(candidate);
    grouped.set(dateKey, group);
  }

  const selected = [...grouped.values()].flatMap((candidates) => {
    const best = candidates[0];
    if (!best) return [];
    const localDate = getPragueLocalDate(new Date(best.startsAt));
    const hasExistingBooking = input.bookedBlocks.some((block) => getPragueLocalDate(new Date(block.startsAt)) === localDate);
    if (!hasExistingBooking) return chronologicalSuggestedSlots(candidates).slice(0, limit);
    const bestQuality = rankedResult.qualities.get(best);
    if (!bestQuality) return chronologicalSuggestedSlots(candidates).slice(0, limit);
    const sameQuality = candidates.filter((candidate) => {
      const quality = rankedResult.qualities.get(candidate);
      return quality !== undefined && quality !== null && hasSameRecommendationQuality(quality, bestQuality);
    });
    return sameQuality.length === candidates.length
      ? chronologicalSuggestedSlots(candidates).slice(0, limit)
      : sameQuality;
  });

  return chronologicalSuggestedSlots(selected).slice(0, limit);
}
