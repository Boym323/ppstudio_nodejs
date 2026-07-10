const dateTimePartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Prague",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
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
  };
}

function compareLocalParts(
  left: { year: number; month: number; day: number; hour: number; minute: number },
  right: { year: number; month: number; day: number; hour: number; minute: number },
) {
  return (
    Date.UTC(left.year, left.month - 1, left.day, left.hour, left.minute)
    - Date.UTC(right.year, right.month - 1, right.day, right.hour, right.minute)
  );
}

function areSameLocalParts(
  left: { year: number; month: number; day: number; hour: number; minute: number },
  right: { year: number; month: number; day: number; hour: number; minute: number },
) {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute
  );
}

function isValidCalendarDate(year: number, month: number, day: number) {
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1) {
    return false;
  }

  const daysInMonth = [31, (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];

  return day <= daysInMonth;
}

function chooseEarlierPragueOccurrence(
  guess: Date,
  requested: { year: number; month: number; day: number; hour: number; minute: number },
) {
  let earliest = guess;

  // DST overlaps are normally one hour, but check a wider bounded window so
  // the policy remains explicit if zone rules ever use another offset.
  for (let minutes = 1; minutes <= 180; minutes += 1) {
    const candidate = new Date(guess.getTime() - minutes * 60_000);

    if (areSameLocalParts(requested, getDateTimeParts(candidate))) {
      earliest = candidate;
    }
  }

  return earliest;
}

export function pragueLocalDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
) {
  if (
    !isValidCalendarDate(year, month, day) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  // Salon time follows Europe/Prague DST rules, so fixed +1/+2 offsets would
  // break around March/October transitions and for future tz database changes.
  let guess = new Date(Date.UTC(year, month - 1, day, hour, minute));

  for (let index = 0; index < 4; index += 1) {
    const parts = getDateTimeParts(guess);
    const delta = compareLocalParts(
      { year, month, day, hour, minute },
      parts,
    );

    if (delta === 0 && areSameLocalParts({ year, month, day, hour, minute }, parts)) {
      // The earlier matching instant is retained for an ambiguous autumn
      // time. A spring-forward wall-clock time never reaches this branch.
      return chooseEarlierPragueOccurrence(guess, { year, month, day, hour, minute });
    }

    guess = new Date(guess.getTime() + delta);
  }

  return null;
}

export function resolvePragueLocalDateTime(dateValue: string, timeValue: string) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeValue);

  if (!dateMatch || !timeMatch) {
    return null;
  }

  return pragueLocalDateTimeToUtc(
    Number(dateMatch[1]),
    Number(dateMatch[2]),
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
  );
}
