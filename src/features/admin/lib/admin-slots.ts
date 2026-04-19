import {
  AvailabilitySlotServiceRestrictionMode,
  AvailabilitySlotStatus,
  BookingStatus,
  Prisma,
} from "@prisma/client";

import { type AdminArea } from "@/config/navigation";
import { prisma } from "@/lib/prisma";

const PRAGUE_TIME_ZONE = "Europe/Prague";
const HALF_HOUR_MINUTES = 30;
const PLANNER_START_HOUR = 6;
const PLANNER_END_HOUR = 20;
const PLANNER_START_MINUTES = PLANNER_START_HOUR * 60;
const DAY_MINUTES = (PLANNER_END_HOUR - PLANNER_START_HOUR) * 60;
const DAY_CELLS = DAY_MINUTES / HALF_HOUR_MINUTES;
const ACTIVE_BOOKING_STATUSES = [BookingStatus.PENDING, BookingStatus.CONFIRMED] as const;
const EDITABLE_SLOT_CAPACITY = 1;

const weekdayLongFormatter = new Intl.DateTimeFormat("cs-CZ", {
  weekday: "long",
  timeZone: PRAGUE_TIME_ZONE,
});

const weekdayShortFormatter = new Intl.DateTimeFormat("cs-CZ", {
  weekday: "short",
  timeZone: PRAGUE_TIME_ZONE,
});

const dateLabelFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "long",
  timeZone: PRAGUE_TIME_ZONE,
});

const dayNumberFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  timeZone: PRAGUE_TIME_ZONE,
});

const monthDayFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  timeZone: PRAGUE_TIME_ZONE,
});

const dateTimePartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: PRAGUE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const timeFormatter = new Intl.DateTimeFormat("cs-CZ", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: PRAGUE_TIME_ZONE,
});

const monthTitleFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: PRAGUE_TIME_ZONE,
});

function getDateTimeParts(date: Date) {
  const parts = dateTimePartsFormatter.formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find((part) => part.type === type)?.value;

    if (!value) {
      throw new Error(`Missing date part ${type}`);
    }

    return Number(value);
  };

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

function formatDateKey(date: Date) {
  const parts = getDateTimeParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function compareLocalParts(
  left: { year: number; month: number; day: number; hour: number; minute: number },
  right: { year: number; month: number; day: number; hour: number; minute: number },
) {
  const leftValue = Date.UTC(left.year, left.month - 1, left.day, left.hour, left.minute);
  const rightValue = Date.UTC(right.year, right.month - 1, right.day, right.hour, right.minute);

  return leftValue - rightValue;
}

function pragueLocalDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
) {
  let guess = new Date(Date.UTC(year, month - 1, day, hour, minute));

  for (let index = 0; index < 4; index += 1) {
    const parts = getDateTimeParts(guess);
    const delta = compareLocalParts(
      { year, month, day, hour, minute },
      {
        year: parts.year,
        month: parts.month,
        day: parts.day,
        hour: parts.hour,
        minute: parts.minute,
      },
    );

    if (delta === 0) {
      return guess;
    }

    guess = new Date(guess.getTime() + delta);
  }

  return guess;
}

function parseDateKey(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);

  if (!match) {
    throw new Error("Invalid date key");
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function getDayBounds(dateKey: string) {
  const { year, month, day } = parseDateKey(dateKey);
  const startsAt = pragueLocalDateTimeToUtc(year, month, day, 0, 0);
  const endsAt = pragueLocalDateTimeToUtc(year, month, day + 1, 0, 0);

  return {
    startsAt,
    endsAt,
  };
}

export function getCellRangeBounds(dateKey: string, startCell: number, endCell: number) {
  const { year, month, day } = parseDateKey(dateKey);
  const startMinutes = PLANNER_START_MINUTES + startCell * HALF_HOUR_MINUTES;
  const endMinutes = PLANNER_START_MINUTES + endCell * HALF_HOUR_MINUTES;

  return {
    startsAt: pragueLocalDateTimeToUtc(
      year,
      month,
      day,
      Math.floor(startMinutes / 60),
      startMinutes % 60,
    ),
    endsAt: pragueLocalDateTimeToUtc(
      year,
      month,
      day,
      Math.floor(endMinutes / 60),
      endMinutes % 60,
    ),
  };
}

function addDays(date: Date, amount: number) {
  const parts = getDateTimeParts(date);
  return pragueLocalDateTimeToUtc(parts.year, parts.month, parts.day + amount, parts.hour, parts.minute);
}

function getWeekStartForDate(date: Date) {
  const parts = getDateTimeParts(date);
  const startOfDay = pragueLocalDateTimeToUtc(parts.year, parts.month, parts.day, 0, 0);
  const dayOfWeek = startOfDay.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  return addDays(startOfDay, mondayOffset);
}

export function resolveWeekStart(week?: string | null) {
  if (week) {
    const parsed = parseDateKey(week);
    return getWeekStartForDate(pragueLocalDateTimeToUtc(parsed.year, parsed.month, parsed.day, 0, 0));
  }

  return getWeekStartForDate(new Date());
}

function clampIntervalToDay(interval: TimeRange, dayStart: Date, dayEnd: Date): TimeRange | null {
  const startsAt = new Date(Math.max(interval.startsAt.getTime(), dayStart.getTime()));
  const endsAt = new Date(Math.min(interval.endsAt.getTime(), dayEnd.getTime()));

  if (endsAt <= startsAt) {
    return null;
  }

  return { startsAt, endsAt };
}

export function dateToCellIndex(date: Date) {
  const parts = getDateTimeParts(date);
  const minutesFromMidnight = parts.hour * 60 + parts.minute;
  const plannerMinutes = minutesFromMidnight - PLANNER_START_MINUTES;
  return Math.max(0, Math.min(DAY_CELLS, plannerMinutes / HALF_HOUR_MINUTES));
}

function intervalToCellRange(interval: TimeRange) {
  return {
    startCell: dateToCellIndex(interval.startsAt),
    endCell: dateToCellIndex(interval.endsAt),
  };
}

function formatTimeRange(startsAt: Date, endsAt: Date) {
  return `${timeFormatter.format(startsAt)} - ${timeFormatter.format(endsAt)}`;
}

function mergeIntervals(intervals: TimeRange[]) {
  const sorted = [...intervals]
    .filter((interval) => interval.endsAt > interval.startsAt)
    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());

  const merged: TimeRange[] = [];

  for (const interval of sorted) {
    const previous = merged.at(-1);

    if (!previous) {
      merged.push({ ...interval });
      continue;
    }

    if (previous.endsAt.getTime() >= interval.startsAt.getTime()) {
      previous.endsAt = new Date(Math.max(previous.endsAt.getTime(), interval.endsAt.getTime()));
      continue;
    }

    merged.push({ ...interval });
  }

  return merged;
}

function subtractIntervals(intervals: TimeRange[], remove: TimeRange) {
  const result: TimeRange[] = [];

  for (const interval of intervals) {
    if (remove.endsAt <= interval.startsAt || remove.startsAt >= interval.endsAt) {
      result.push(interval);
      continue;
    }

    if (remove.startsAt > interval.startsAt) {
      result.push({ startsAt: interval.startsAt, endsAt: remove.startsAt });
    }

    if (remove.endsAt < interval.endsAt) {
      result.push({ startsAt: remove.endsAt, endsAt: interval.endsAt });
    }
  }

  return result;
}

function intersectsAny(interval: TimeRange, blocked: TimeRange[]) {
  return blocked.some(
    (blockedInterval) => interval.startsAt < blockedInterval.endsAt && interval.endsAt > blockedInterval.startsAt,
  );
}

function buildCellsMap(dayIntervals: Array<{ startCell: number; endCell: number }>) {
  const cells = Array.from({ length: DAY_CELLS }, () => false);

  for (const interval of dayIntervals) {
    for (let cell = interval.startCell; cell < interval.endCell; cell += 1) {
      cells[cell] = true;
    }
  }

  return cells;
}

function isPlainEditableSlot(slot: {
  capacity: number;
  publicNote: string | null;
  internalNote: string | null;
  serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode;
  allowedServices: Array<{ serviceId: string }>;
  bookings: Array<{ id: string }>;
}) {
  return (
    slot.capacity === EDITABLE_SLOT_CAPACITY &&
    slot.publicNote === null &&
    slot.internalNote === null &&
    slot.serviceRestrictionMode === AvailabilitySlotServiceRestrictionMode.ANY &&
    slot.allowedServices.length === 0 &&
    slot.bookings.length === 0
  );
}

function isPastInterval(interval: { endCell: number }, nowCell: number, isPastDay: boolean) {
  return isPastDay || interval.endCell <= nowCell;
}

function isSameDateKey(left: string, right: string) {
  return left === right;
}

export type TimeRange = {
  startsAt: Date;
  endsAt: Date;
};

export type PlannerInterval = {
  id: string;
  startCell: number;
  endCell: number;
  label: string;
  status: "available" | "booked" | "inactive" | "locked";
  bookingCount: number;
  canEdit: boolean;
  detail: string;
};

export type PlannerBooking = {
  id: string;
  startCell: number;
  endCell: number;
  label: string;
  clientName: string;
  serviceName: string;
  status: BookingStatus;
};

export type PlannerDay = {
  dateKey: string;
  isoDate: string;
  label: string;
  shortLabel: string;
  dayNumber: string;
  monthDayLabel: string;
  isToday: boolean;
  isPast: boolean;
  availableIntervals: Array<{ startCell: number; endCell: number; label: string }>;
  lockedIntervals: Array<{ startCell: number; endCell: number; label: string }>;
  bookings: PlannerBooking[];
  intervals: PlannerInterval[];
  cells: {
    available: boolean[];
    booked: boolean[];
    inactive: boolean[];
    locked: boolean[];
    past: boolean[];
  };
  summary: {
    availableLabel: string;
    bookingLabel: string;
    note: string;
  };
};

export type PlannerWeekData = {
  area: AdminArea;
  baseHref: string;
  title: string;
  subtitle: string;
  weekKey: string;
  previousWeekKey: string;
  nextWeekKey: string;
  weekRangeLabel: string;
  todayKey: string;
  days: PlannerDay[];
  legend: Array<{ tone: PlannerInterval["status"] | "past"; label: string }>;
};

export type PlannerMutationResult = {
  ok: boolean;
  message: string;
  weekKey: string;
};

function getBaseHref(area: AdminArea) {
  return area === "owner" ? "/admin/volne-terminy" : "/admin/provoz/volne-terminy";
}

function getAreaTitle(area: AdminArea) {
  return area === "owner" ? "Týdenní plán dostupností" : "Týdenní plán termínů";
}

function getAreaSubtitle(area: AdminArea) {
  return area === "owner"
    ? "Volné intervaly upravujete přímo v týdenním kalendáři. Rozhraní samo skládá půlhodiny do souvislých oken kompatibilních s booking flow."
    : "Termíny upravujete přímo v týdnu. Stačí kliknout nebo táhnout přes půlhodiny a rozhraní uloží souvislé volné úseky.";
}

function getSummaryNote(day: PlannerDay) {
  if (day.bookings.length > 0) {
    return day.availableIntervals.length > 0
      ? "Den kombinuje rezervace a další volné okno."
      : "Den je svázaný s rezervacemi a dostupnost se proto nedá plně vyčistit.";
  }

  if (day.availableIntervals.length > 0) {
    return "Dostupnost lze upravit přímo v mřížce.";
  }

  if (day.lockedIntervals.length > 0) {
    return "Obsahuje omezené nebo technicky uzamčené intervaly.";
  }

  return day.isPast ? "Minulý den už jen slouží pro orientaci." : "Den je prázdný a připravený k doplnění.";
}

export async function getAdminPlannerWeek(area: AdminArea, week?: string | null): Promise<PlannerWeekData> {
  const weekStart = resolveWeekStart(week);
  const weekEnd = addDays(weekStart, 7);
  const now = new Date();
  const todayKey = formatDateKey(now);

  const [slots, bookings] = await Promise.all([
    prisma.availabilitySlot.findMany({
      where: {
        startsAt: {
          lt: weekEnd,
        },
        endsAt: {
          gt: weekStart,
        },
      },
      orderBy: [{ startsAt: "asc" }],
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        capacity: true,
        status: true,
        publicNote: true,
        internalNote: true,
        serviceRestrictionMode: true,
        allowedServices: {
          select: {
            serviceId: true,
          },
        },
        bookings: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    }),
    prisma.booking.findMany({
      where: {
        scheduledStartsAt: {
          lt: weekEnd,
        },
        scheduledEndsAt: {
          gt: weekStart,
        },
        status: {
          not: BookingStatus.CANCELLED,
        },
      },
      orderBy: [{ scheduledStartsAt: "asc" }],
      select: {
        id: true,
        scheduledStartsAt: true,
        scheduledEndsAt: true,
        status: true,
        clientNameSnapshot: true,
        serviceNameSnapshot: true,
      },
    }),
  ]);

  const days: PlannerDay[] = [];

  for (let index = 0; index < 7; index += 1) {
    const dayStart = addDays(weekStart, index);
    const dayEnd = addDays(dayStart, 1);
    const dateKey = formatDateKey(dayStart);
    const nowCell = dateToCellIndex(now);
    const isToday = isSameDateKey(dateKey, todayKey);
    const isPast = dayEnd <= now;

    const daySlots = slots.filter((slot) => slot.startsAt < dayEnd && slot.endsAt > dayStart);
    const dayBookings = bookings
      .filter((booking) => booking.scheduledStartsAt < dayEnd && booking.scheduledEndsAt > dayStart)
      .map((booking) => {
        const clipped = clampIntervalToDay(
          { startsAt: booking.scheduledStartsAt, endsAt: booking.scheduledEndsAt },
          dayStart,
          dayEnd,
        );

        if (!clipped) {
          return null;
        }

        const cells = intervalToCellRange(clipped);
        if (cells.endCell <= cells.startCell) {
          return null;
        }

        return {
          id: booking.id,
          startCell: cells.startCell,
          endCell: cells.endCell,
          label: formatTimeRange(clipped.startsAt, clipped.endsAt),
          clientName: booking.clientNameSnapshot,
          serviceName: booking.serviceNameSnapshot,
          status: booking.status,
        } satisfies PlannerBooking;
      })
      .filter((booking): booking is PlannerBooking => booking !== null);

    const intervals: PlannerInterval[] = daySlots
      .map((slot) => {
        const clipped = clampIntervalToDay(
          { startsAt: slot.startsAt, endsAt: slot.endsAt },
          dayStart,
          dayEnd,
        );

        if (!clipped) {
          return null;
        }

        const cells = intervalToCellRange(clipped);
        if (cells.endCell <= cells.startCell) {
          return null;
        }
        const activeBookings = slot.bookings.filter((booking) =>
          ACTIVE_BOOKING_STATUSES.includes(booking.status as (typeof ACTIVE_BOOKING_STATUSES)[number]),
        );
        const plainEditable = slot.status === AvailabilitySlotStatus.PUBLISHED && isPlainEditableSlot(slot);

        let status: PlannerInterval["status"];
        let detail: string;
        let canEdit = false;

        if (slot.status !== AvailabilitySlotStatus.PUBLISHED) {
          status = "inactive";
          detail = "Neaktivní nebo interní interval";
        } else if (activeBookings.length > 0) {
          status = "booked";
          detail = `${activeBookings.length} rezervace`; 
        } else if (plainEditable) {
          status = "available";
          detail = "Běžná dostupnost";
          canEdit = true;
        } else {
          status = "locked";
          detail = slot.allowedServices.length > 0
            ? "Omezeno na vybrané služby"
            : slot.capacity !== EDITABLE_SLOT_CAPACITY
              ? `Kapacita ${slot.capacity}`
              : slot.publicNote ?? slot.internalNote ?? "Vyžaduje detailní správu";
        }

        return {
          id: slot.id,
          startCell: cells.startCell,
          endCell: cells.endCell,
          label: formatTimeRange(clipped.startsAt, clipped.endsAt),
          status,
          bookingCount: activeBookings.length,
          canEdit,
          detail,
        } satisfies PlannerInterval;
      })
      .filter((interval): interval is PlannerInterval => interval !== null)
      .sort((left, right) => left.startCell - right.startCell);

    const availableIntervals = intervals
      .filter((interval) => interval.status === "available")
      .map((interval) => ({
        startCell: interval.startCell,
        endCell: interval.endCell,
        label: interval.label,
      }));

    const lockedIntervals = intervals
      .filter((interval) => interval.status === "locked" || interval.status === "inactive")
      .map((interval) => ({
        startCell: interval.startCell,
        endCell: interval.endCell,
        label: interval.label,
      }));

    const bookedCells = buildCellsMap(dayBookings);
    const availableCells = buildCellsMap(availableIntervals);
    const inactiveCells = buildCellsMap(intervals.filter((interval) => interval.status === "inactive"));
    const lockedCells = buildCellsMap(intervals.filter((interval) => interval.status === "locked"));
    const pastCells = Array.from({ length: DAY_CELLS }, (_, cellIndex) => isPastInterval({ endCell: cellIndex + 1 }, nowCell, isPast || (isToday && cellIndex + 1 <= nowCell)));

    const day: PlannerDay = {
      dateKey,
      isoDate: dayStart.toISOString(),
      label: `${weekdayLongFormatter.format(dayStart)} ${dateLabelFormatter.format(dayStart)}`,
      shortLabel: weekdayShortFormatter.format(dayStart),
      dayNumber: dayNumberFormatter.format(dayStart),
      monthDayLabel: monthDayFormatter.format(dayStart),
      isToday,
      isPast,
      availableIntervals,
      lockedIntervals,
      bookings: dayBookings,
      intervals,
      cells: {
        available: availableCells,
        booked: bookedCells,
        inactive: inactiveCells,
        locked: lockedCells,
        past: pastCells,
      },
      summary: {
        availableLabel:
          availableIntervals.length > 0
            ? `${availableIntervals.length} volná ${availableIntervals.length === 1 ? "okna" : "okna"}`
            : "Bez volné dostupnosti",
        bookingLabel:
          dayBookings.length > 0
            ? `${dayBookings.length} ${dayBookings.length === 1 ? "rezervace" : dayBookings.length < 5 ? "rezervace" : "rezervací"}`
            : "Bez rezervací",
        note: "",
      },
    };

    day.summary.note = getSummaryNote(day);
    days.push(day);
  }

  const weekKey = formatDateKey(weekStart);
  const weekEndInclusive = addDays(weekStart, 6);

  return {
    area,
    baseHref: getBaseHref(area),
    title: getAreaTitle(area),
    subtitle: getAreaSubtitle(area),
    weekKey,
    previousWeekKey: formatDateKey(addDays(weekStart, -7)),
    nextWeekKey: formatDateKey(addDays(weekStart, 7)),
    weekRangeLabel: `${monthTitleFormatter.format(weekStart)} - ${monthTitleFormatter.format(weekEndInclusive)}`,
    todayKey,
    days,
    legend: [
      { tone: "available", label: "Dostupnost" },
      { tone: "booked", label: "Rezervace" },
      { tone: "locked", label: "Omezené" },
      { tone: "inactive", label: "Neaktivní" },
      { tone: "past", label: "Minulý čas" },
    ],
  };
}

export class PlannerMutationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlannerMutationError";
  }
}

async function getEditableDayState(tx: Prisma.TransactionClient, dateKey: string) {
  const { startsAt: dayStart, endsAt: dayEnd } = getDayBounds(dateKey);
  const slots = await tx.availabilitySlot.findMany({
    where: {
      startsAt: {
        lt: dayEnd,
      },
      endsAt: {
        gt: dayStart,
      },
    },
    orderBy: [{ startsAt: "asc" }],
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      status: true,
      capacity: true,
      publicNote: true,
      internalNote: true,
      serviceRestrictionMode: true,
      allowedServices: {
        select: {
          serviceId: true,
        },
      },
      bookings: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  const editableSlots = slots.filter(
    (slot) => slot.status === AvailabilitySlotStatus.PUBLISHED && isPlainEditableSlot(slot),
  );
  const lockedIntervals = slots
    .filter((slot) => {
      if (slot.status !== AvailabilitySlotStatus.PUBLISHED && slot.status !== AvailabilitySlotStatus.DRAFT) {
        return false;
      }

      return !editableSlots.some((editableSlot) => editableSlot.id === slot.id);
    })
    .map((slot) => ({ startsAt: slot.startsAt, endsAt: slot.endsAt }));
  const editableIntervals = editableSlots.map((slot) => ({ startsAt: slot.startsAt, endsAt: slot.endsAt }));

  return {
    dayStart,
    dayEnd,
    editableSlots,
    editableIntervals,
    lockedIntervals,
  };
}

function ensureHalfHourCellIndex(cell: number) {
  if (!Number.isInteger(cell) || cell < 0 || cell > DAY_CELLS) {
    throw new PlannerMutationError("Vybraný čas v kalendáři není platný.");
  }
}

export async function applyAvailabilitySelection(
  area: AdminArea,
  input: {
    weekKey: string;
    dateKey: string;
    startCell: number;
    endCell: number;
    mode: "add" | "remove";
    actorUserId: string;
  },
): Promise<PlannerMutationResult> {
  ensureHalfHourCellIndex(input.startCell);
  ensureHalfHourCellIndex(input.endCell);

  if (input.endCell <= input.startCell) {
    throw new PlannerMutationError("Vyberte aspoň jednu půlhodinu.");
  }

  const selection = getCellRangeBounds(input.dateKey, input.startCell, input.endCell);

  await prisma.$transaction(async (tx) => {
    const state = await getEditableDayState(tx, input.dateKey);

    if (intersectsAny(selection, state.lockedIntervals)) {
      throw new PlannerMutationError(
        "Vybraný úsek zasahuje do rezervace nebo omezeného intervalu. Tenhle čas je potřeba nechat beze změny.",
      );
    }

    const baseIntervals = mergeIntervals(state.editableIntervals);
    const nextIntervals =
      input.mode === "add"
        ? mergeIntervals([...baseIntervals, selection])
        : mergeIntervals(subtractIntervals(baseIntervals, selection));

    if (nextIntervals.some((interval) => intersectsAny(interval, state.lockedIntervals))) {
      throw new PlannerMutationError("Změna by vytvořila kolizi s uzamčeným intervalem.");
    }

    if (state.editableSlots.length > 0) {
      await tx.availabilitySlot.deleteMany({
        where: {
          id: {
            in: state.editableSlots.map((slot) => slot.id),
          },
        },
      });
    }

    if (nextIntervals.length > 0) {
      await tx.availabilitySlot.createMany({
        data: nextIntervals.map((interval) => ({
          startsAt: interval.startsAt,
          endsAt: interval.endsAt,
          capacity: EDITABLE_SLOT_CAPACITY,
          status: AvailabilitySlotStatus.PUBLISHED,
          serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
          publishedAt: new Date(),
          createdByUserId: input.actorUserId,
        })),
      });
    }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });

  return {
    ok: true,
    message:
      input.mode === "add"
        ? "Dostupnost byla upravená a sousední půlhodiny jsme spojili do souvislých oken."
        : "Dostupnost byla odebraná. Zbylé úseky zůstaly uložené jako čisté souvislé intervaly.",
    weekKey: input.weekKey,
  };
}

export async function clearPlannerDay(
  area: AdminArea,
  input: {
    weekKey: string;
    dateKey: string;
  },
): Promise<PlannerMutationResult> {
  await prisma.$transaction(async (tx) => {
    const state = await getEditableDayState(tx, input.dateKey);

    if (state.editableSlots.length > 0) {
      await tx.availabilitySlot.deleteMany({
        where: {
          id: {
            in: state.editableSlots.map((slot) => slot.id),
          },
        },
      });
    }
  });

  return {
    ok: true,
    message: "Den je nastavený jako zavřeno. Rezervace a omezené intervaly zůstaly beze změny.",
    weekKey: input.weekKey,
  };
}

async function replaceDayWithIntervals(
  tx: Prisma.TransactionClient,
  actorUserId: string,
  dateKey: string,
  intervals: TimeRange[],
) {
  const state = await getEditableDayState(tx, dateKey);

  if (intervals.some((interval) => intersectsAny(interval, state.lockedIntervals))) {
    throw new PlannerMutationError(
      "Kopírovaný rozvrh zasahuje do rezervací nebo omezených intervalů v cílovém dni.",
    );
  }

  if (state.editableSlots.length > 0) {
    await tx.availabilitySlot.deleteMany({
      where: {
        id: {
          in: state.editableSlots.map((slot) => slot.id),
        },
      },
    });
  }

  const merged = mergeIntervals(intervals);

  if (merged.length > 0) {
    await tx.availabilitySlot.createMany({
      data: merged.map((interval) => ({
        startsAt: interval.startsAt,
        endsAt: interval.endsAt,
        capacity: EDITABLE_SLOT_CAPACITY,
        status: AvailabilitySlotStatus.PUBLISHED,
        serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
        publishedAt: new Date(),
        createdByUserId: actorUserId,
      })),
    });
  }
}

async function readEditableIntervalsForDate(tx: Prisma.TransactionClient, dateKey: string) {
  const state = await getEditableDayState(tx, dateKey);
  return mergeIntervals(state.editableIntervals);
}

export async function copyPlannerDay(
  area: AdminArea,
  input: {
    weekKey: string;
    sourceDateKey: string;
    targetDateKey: string;
    actorUserId: string;
  },
): Promise<PlannerMutationResult> {
  await prisma.$transaction(async (tx) => {
    const sourceIntervals = await readEditableIntervalsForDate(tx, input.sourceDateKey);
    const { startsAt: sourceDayStart } = getDayBounds(input.sourceDateKey);
    const { startsAt: targetDayStart } = getDayBounds(input.targetDateKey);
    const shiftMs = targetDayStart.getTime() - sourceDayStart.getTime();

    await replaceDayWithIntervals(
      tx,
      input.actorUserId,
      input.targetDateKey,
      sourceIntervals.map((interval) => ({
        startsAt: new Date(interval.startsAt.getTime() + shiftMs),
        endsAt: new Date(interval.endsAt.getTime() + shiftMs),
      })),
    );
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });

  return {
    ok: true,
    message: "Rozvrh dne jsme zkopírovali. Přenesla se jen běžná dostupnost bez rezervací a omezených intervalů.",
    weekKey: input.weekKey,
  };
}

export async function copyPlannerWeek(
  area: AdminArea,
  input: {
    sourceWeekKey: string;
    targetWeekKey: string;
    actorUserId: string;
  },
): Promise<PlannerMutationResult> {
  const sourceWeekStart = resolveWeekStart(input.sourceWeekKey);
  const targetWeekStart = resolveWeekStart(input.targetWeekKey);

  await prisma.$transaction(async (tx) => {
    for (let index = 0; index < 7; index += 1) {
      const sourceDateKey = formatDateKey(addDays(sourceWeekStart, index));
      const targetDateKey = formatDateKey(addDays(targetWeekStart, index));
      const sourceIntervals = await readEditableIntervalsForDate(tx, sourceDateKey);
      const shiftMs = getDayBounds(targetDateKey).startsAt.getTime() - getDayBounds(sourceDateKey).startsAt.getTime();

      await replaceDayWithIntervals(
        tx,
        input.actorUserId,
        targetDateKey,
        sourceIntervals.map((interval) => ({
          startsAt: new Date(interval.startsAt.getTime() + shiftMs),
          endsAt: new Date(interval.endsAt.getTime() + shiftMs),
        })),
      );
    }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });

  return {
    ok: true,
    message: "Celý týden jsme přenesli do cílového týdne. Kopírují se jen běžné volné intervaly, ne rezervace.",
    weekKey: input.targetWeekKey,
  };
}

export type WeeklyTemplateInput = Array<{
  weekday: number;
  intervals: Array<{
    startCell: number;
    endCell: number;
  }>;
}>;

export async function applyWeeklyTemplate(
  area: AdminArea,
  input: {
    weekKey: string;
    template: WeeklyTemplateInput;
    actorUserId: string;
  },
): Promise<PlannerMutationResult> {
  const weekStart = resolveWeekStart(input.weekKey);

  await prisma.$transaction(async (tx) => {
    for (const dayTemplate of input.template) {
      if (dayTemplate.weekday < 0 || dayTemplate.weekday > 6) {
        throw new PlannerMutationError("Šablona týdne obsahuje neplatný den.");
      }

      const dateKey = formatDateKey(addDays(weekStart, dayTemplate.weekday));
      const intervals = dayTemplate.intervals.map((interval) => {
        ensureHalfHourCellIndex(interval.startCell);
        ensureHalfHourCellIndex(interval.endCell);

        if (interval.endCell <= interval.startCell) {
          throw new PlannerMutationError("Šablona týdne obsahuje prázdný interval.");
        }

        return getCellRangeBounds(dateKey, interval.startCell, interval.endCell);
      });

      await replaceDayWithIntervals(tx, input.actorUserId, dateKey, intervals);
    }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });

  return {
    ok: true,
    message: "Týdenní šablona byla použitá na právě otevřený týden.",
    weekKey: input.weekKey,
  };
}

export function getPlannerTimeLabels() {
  return Array.from({ length: DAY_CELLS }, (_, index) => {
    const minutes = PLANNER_START_MINUTES + index * HALF_HOUR_MINUTES;
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  });
}

export function getWeekdayTemplateFromDays(days: PlannerDay[]) {
  return days.map((day, weekday) => ({
    weekday,
    intervals: day.availableIntervals.map((interval) => ({
      startCell: interval.startCell,
      endCell: interval.endCell,
    })),
  }));
}

export async function findSlotWeekContext(slotId: string) {
  const slot = await prisma.availabilitySlot.findUnique({
    where: { id: slotId },
    select: { startsAt: true },
  });

  if (!slot) {
    return null;
  }

  return {
    weekKey: formatDateKey(getWeekStartForDate(slot.startsAt)),
    dateKey: formatDateKey(slot.startsAt),
  };
}
