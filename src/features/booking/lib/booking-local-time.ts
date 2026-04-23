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

export function pragueLocalDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
) {
  let guess = new Date(Date.UTC(year, month - 1, day, hour, minute));

  for (let index = 0; index < 4; index += 1) {
    const parts = getDateTimeParts(guess);
    const delta = compareLocalParts(
      { year, month, day, hour, minute },
      parts,
    );

    if (delta === 0) {
      return guess;
    }

    guess = new Date(guess.getTime() + delta);
  }

  return guess;
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
