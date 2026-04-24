const PRAGUE_TIME_ZONE = "Europe/Prague";
const HALF_HOUR_MINUTES = 30;
const PLANNER_START_HOUR = 6;
const PLANNER_END_HOUR = 20;

export const PLANNER_START_MINUTES = PLANNER_START_HOUR * 60;
export const DAY_MINUTES = (PLANNER_END_HOUR - PLANNER_START_HOUR) * 60;
export const DAY_CELLS = DAY_MINUTES / HALF_HOUR_MINUTES;

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

export function addDays(date: Date, amount: number) {
  const parts = getDateTimeParts(date);
  return pragueLocalDateTimeToUtc(parts.year, parts.month, parts.day + amount, parts.hour, parts.minute);
}

function getWeekStartForDate(date: Date) {
  const parts = getDateTimeParts(date);
  const startOfDay = pragueLocalDateTimeToUtc(parts.year, parts.month, parts.day, 0, 0);
  const dayOfWeek = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
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
