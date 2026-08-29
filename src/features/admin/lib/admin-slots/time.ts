import { pragueLocalDateTimeToUtc } from "@/features/booking/lib/booking-local-time";

export const PLANNER_TIME_ZONE = "Europe/Prague";
export const PLANNER_START_HOUR = 6;
export const PLANNER_END_HOUR = 20;
export const PLANNER_GRID_MINUTES = 30;
export const PLANNER_FINE_STEP_MINUTES = 15;
export const PLANNER_CELL_COUNT = ((PLANNER_END_HOUR - PLANNER_START_HOUR) * 60) / PLANNER_GRID_MINUTES;

// Backwards-compatible aliases for the existing planner helpers.
export const PRAGUE_TIME_ZONE = PLANNER_TIME_ZONE;
const HALF_HOUR_MINUTES = PLANNER_GRID_MINUTES;

export const PLANNER_START_MINUTES = PLANNER_START_HOUR * 60;
export const DAY_MINUTES = (PLANNER_END_HOUR - PLANNER_START_HOUR) * 60;
export const DAY_CELLS = PLANNER_CELL_COUNT;

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

export const weekdayLongFormatter = new Intl.DateTimeFormat("cs-CZ", {
  weekday: "long",
  timeZone: PRAGUE_TIME_ZONE,
});

export const weekdayShortFormatter = new Intl.DateTimeFormat("cs-CZ", {
  weekday: "short",
  timeZone: PRAGUE_TIME_ZONE,
});

export const dateLabelFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "long",
  timeZone: PRAGUE_TIME_ZONE,
});

export const dayNumberFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  timeZone: PRAGUE_TIME_ZONE,
});

export const monthDayFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  timeZone: PRAGUE_TIME_ZONE,
});

export const monthOnlyFormatter = new Intl.DateTimeFormat("cs-CZ", {
  month: "numeric",
  timeZone: PRAGUE_TIME_ZONE,
});

export const timeFormatter = new Intl.DateTimeFormat("cs-CZ", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: PRAGUE_TIME_ZONE,
});

export const monthTitleFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: PRAGUE_TIME_ZONE,
});

export function getDateTimeParts(date: Date) {
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

export function formatDateKey(date: Date) {
  const parts = getDateTimeParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
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

function addCalendarDays(year: number, month: number, day: number, amount: number) {
  const date = new Date(Date.UTC(year, month - 1, day + amount));

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function resolvePragueDateTime(year: number, month: number, day: number, hour = 0, minute = 0) {
  const resolved = pragueLocalDateTimeToUtc(year, month, day, hour, minute);

  if (!resolved) {
    throw new Error("Invalid Prague local date time");
  }

  return resolved;
}

function resolvePragueDateTimeAtMinutes(year: number, month: number, day: number, minutes: number) {
  const dayOffset = Math.floor(minutes / (24 * 60));
  const minuteOfDay = minutes - dayOffset * 24 * 60;
  const localDate = addCalendarDays(year, month, day, dayOffset);

  return resolvePragueDateTime(
    localDate.year,
    localDate.month,
    localDate.day,
    Math.floor(minuteOfDay / 60),
    minuteOfDay % 60,
  );
}

export function isValidDateKey(dateKey: string) {
  try {
    const { year, month, day } = parseDateKey(dateKey);
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  } catch {
    return false;
  }
}

export function isDateKeyInWeek(dateKey: string, weekKey: string) {
  if (!isValidDateKey(dateKey) || !isValidDateKey(weekKey)) {
    return false;
  }

  const weekStart = resolveWeekStart(weekKey);
  const dateStart = getDayBounds(dateKey).startsAt;

  return dateStart >= weekStart && dateStart < addDays(weekStart, 7);
}

export function isCanonicalWeekKey(weekKey: string) {
  return isValidDateKey(weekKey) && formatDateKey(resolveWeekStart(weekKey)) === weekKey;
}

export function getDayBounds(dateKey: string) {
  const { year, month, day } = parseDateKey(dateKey);
  const nextDay = addCalendarDays(year, month, day, 1);
  const startsAt = resolvePragueDateTime(year, month, day, 0, 0);
  const endsAt = resolvePragueDateTime(nextDay.year, nextDay.month, nextDay.day, 0, 0);

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
    startsAt: resolvePragueDateTimeAtMinutes(year, month, day, startMinutes),
    endsAt: resolvePragueDateTimeAtMinutes(year, month, day, endMinutes),
  };
}

export function addDays(date: Date, amount: number) {
  const parts = getDateTimeParts(date);
  const next = addCalendarDays(parts.year, parts.month, parts.day, amount);
  return resolvePragueDateTime(next.year, next.month, next.day, parts.hour, parts.minute);
}

function getWeekStartForDate(date: Date) {
  const parts = getDateTimeParts(date);
  const startOfDay = resolvePragueDateTime(parts.year, parts.month, parts.day, 0, 0);
  const dayOfWeek = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  return addDays(startOfDay, mondayOffset);
}

export function resolveWeekStart(week?: string | null) {
  if (week && isValidDateKey(week)) {
    const parsed = parseDateKey(week);
    return getWeekStartForDate(resolvePragueDateTime(parsed.year, parsed.month, parsed.day, 0, 0));
  }

  return getWeekStartForDate(new Date());
}

export function dateToCellIndex(date: Date) {
  const parts = getDateTimeParts(date);
  const minutesFromMidnight = parts.hour * 60 + parts.minute;
  const plannerMinutes = minutesFromMidnight - PLANNER_START_MINUTES;
  return Math.max(0, Math.min(DAY_CELLS, plannerMinutes / HALF_HOUR_MINUTES));
}

export function getPlannerTimeLabels() {
  return Array.from({ length: DAY_CELLS }, (_, index) => {
    const minutes = PLANNER_START_MINUTES + index * HALF_HOUR_MINUTES;
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  });
}
