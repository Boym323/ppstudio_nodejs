import type { PublicBookingCatalog } from "@/features/booking/lib/booking-public";

const BOOKING_START_STEP_MINUTES = 30;

export type TimeSlotOption = {
  key: string;
  slotId: string;
  startsAt: string;
  endsAt: string;
  publicNote: string | null;
  isDisabled: boolean;
};

type DayPeriodKey = "morning" | "lateMorning" | "afternoon" | "evening";

export type TimeSlotGroupData = {
  key: DayPeriodKey | "all-day";
  label: string | null;
  slots: TimeSlotOption[];
};

function getSlotSegments(slot: PublicBookingCatalog["slots"][number]) {
  return slot.segments?.length
    ? slot.segments
    : [{
        id: slot.id,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
      }];
}

function resolveSlotIdForStart(
  slot: PublicBookingCatalog["slots"][number],
  startsAtMs: number,
) {
  const slotSegments = getSlotSegments(slot);
  const matchingSegment = slotSegments.find((segment) => {
    const segmentStartsAtMs = new Date(segment.startsAt).getTime();
    const segmentEndsAtMs = new Date(segment.endsAt).getTime();

    return startsAtMs >= segmentStartsAtMs && startsAtMs < segmentEndsAtMs;
  });

  return matchingSegment?.id ?? slot.id;
}

function getSlotStartTime(value: string) {
  return new Date(value).getTime();
}

function getDayPeriod(startsAt: string): DayPeriodKey {
  const date = new Date(startsAt);
  const pragueHour = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    timeZone: "Europe/Prague",
  }).format(date);
  const hour = Number(pragueHour);

  if (hour < 9) {
    return "morning";
  }

  if (hour < 12) {
    return "lateMorning";
  }

  if (hour < 17) {
    return "afternoon";
  }

  return "evening";
}

function getDayPeriodLabel(period: DayPeriodKey) {
  switch (period) {
    case "morning":
      return "Ráno";
    case "lateMorning":
      return "Dopoledne";
    case "afternoon":
      return "Odpoledne";
    case "evening":
      return "Večer";
    default:
      return null;
  }
}

export function buildSlotTimeOptions(
  slot: PublicBookingCatalog["slots"][number],
  serviceDurationMinutes: number,
): TimeSlotOption[] {
  const slotStartsAtMs = new Date(slot.startsAt).getTime();
  const slotEndsAtMs = new Date(slot.endsAt).getTime();
  const serviceDurationMs = serviceDurationMinutes * 60 * 1000;
  const stepMs = BOOKING_START_STEP_MINUTES * 60 * 1000;
  const latestStartMs = slotEndsAtMs - serviceDurationMs;

  if (latestStartMs < slotStartsAtMs) {
    return [];
  }

  const options: TimeSlotOption[] = [];
  const bookingStartsSorted = slot.bookedIntervals
    .map((booking) => new Date(booking.startsAt).getTime())
    .sort((left, right) => left - right);
  const bookingEndsSorted = slot.bookedIntervals
    .map((booking) => new Date(booking.endsAt).getTime())
    .sort((left, right) => left - right);
  let startsPointer = 0;
  let endsPointer = 0;
  let activeOverlaps = 0;

  for (let startsAtMs = slotStartsAtMs; startsAtMs <= latestStartMs; startsAtMs += stepMs) {
    const endsAtMs = startsAtMs + serviceDurationMs;

    while (startsPointer < bookingStartsSorted.length && bookingStartsSorted[startsPointer] < endsAtMs) {
      activeOverlaps += 1;
      startsPointer += 1;
    }

    while (endsPointer < bookingEndsSorted.length && bookingEndsSorted[endsPointer] <= startsAtMs) {
      activeOverlaps -= 1;
      endsPointer += 1;
    }

    const remainingCapacity = Math.max(slot.capacity - activeOverlaps, 0);
    const startsAt = new Date(startsAtMs).toISOString();
    const endsAt = new Date(endsAtMs).toISOString();
    const slotId = resolveSlotIdForStart(slot, startsAtMs);

    options.push({
      key: `${slotId}:${startsAt}`,
      slotId,
      startsAt,
      endsAt,
      publicNote: slot.publicNote,
      isDisabled: remainingCapacity < 1,
    });
  }

  return options;
}

export function groupSlotsByDayPeriod(slots: TimeSlotOption[]): TimeSlotGroupData[] {
  const sortedSlots = [...slots].sort((left, right) => getSlotStartTime(left.startsAt) - getSlotStartTime(right.startsAt));

  if (sortedSlots.length === 0) {
    return [];
  }

  const grouped = new Map<DayPeriodKey, TimeSlotOption[]>();

  for (const slot of sortedSlots) {
    const period = getDayPeriod(slot.startsAt);
    const current = grouped.get(period) ?? [];
    current.push(slot);
    grouped.set(period, current);
  }

  const orderedPeriods = ["morning", "lateMorning", "afternoon", "evening"] as const satisfies readonly DayPeriodKey[];

  const orderedGroups: TimeSlotGroupData[] = orderedPeriods
    .flatMap((period) => {
      const periodSlots = grouped.get(period);

      if (!periodSlots || periodSlots.length === 0) {
        return [];
      }

      return [{
        key: period,
        label: getDayPeriodLabel(period),
        slots: periodSlots,
      }];
    });

  if (orderedGroups.length <= 1) {
    return [
      {
        key: "all-day",
        label: null,
        slots: sortedSlots,
      },
    ];
  }

  return orderedGroups;
}
