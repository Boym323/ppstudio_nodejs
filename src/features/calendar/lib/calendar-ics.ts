const PRAGUE_TIME_ZONE = "Europe/Prague";

const pragueDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: PRAGUE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const utcDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

type CalendarEventInput = {
  uid: string;
  summary: string;
  description?: string | null;
  location?: string | null;
  status: "CONFIRMED" | "CANCELLED" | "TENTATIVE";
  startsAt: Date;
  endsAt: Date;
  dtStamp: Date;
  lastModified?: Date | null;
  sequence?: number;
};

type CalendarDefinitionInput = {
  productId: string;
  name: string;
  description?: string;
  events: CalendarEventInput[];
};

function formatParts(formatter: Intl.DateTimeFormat, value: Date) {
  const parts = formatter.formatToParts(value);

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

export function formatCalendarUtcDateTime(value: Date) {
  const { year, month, day, hour, minute, second } = formatParts(utcDateTimeFormatter, value);
  return `${year}${month}${day}T${hour}${minute}${second}Z`;
}

export function formatCalendarPragueDateTime(value: Date) {
  const { year, month, day, hour, minute, second } = formatParts(pragueDateTimeFormatter, value);
  return `${year}${month}${day}T${hour}${minute}${second}`;
}

export function escapeCalendarText(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll(/\r\n|\r|\n/g, "\\n");
}

export function foldCalendarLine(line: string) {
  const encoder = new TextEncoder();
  const maxBytes = 75;

  if (encoder.encode(line).length <= maxBytes) {
    return line;
  }

  let currentLine = "";
  let currentBytes = 0;
  const foldedLines: string[] = [];

  for (const character of line) {
    const characterBytes = encoder.encode(character).length;
    const nextLimit = foldedLines.length === 0 ? maxBytes : maxBytes - 1;

    if (currentBytes + characterBytes > nextLimit) {
      foldedLines.push(currentLine);
      currentLine = character;
      currentBytes = characterBytes;
      continue;
    }

    currentLine += character;
    currentBytes += characterBytes;
  }

  if (currentLine.length > 0) {
    foldedLines.push(currentLine);
  }

  return foldedLines.join("\r\n ");
}

function buildCalendarProperty(name: string, value: string) {
  return foldCalendarLine(`${name}:${value}`);
}

function buildTimeZoneBlock() {
  return [
    "BEGIN:VTIMEZONE",
    "TZID:Europe/Prague",
    "X-LIC-LOCATION:Europe/Prague",
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:+0100",
    "TZOFFSETTO:+0200",
    "TZNAME:CEST",
    "DTSTART:19700329T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:+0200",
    "TZOFFSETTO:+0100",
    "TZNAME:CET",
    "DTSTART:19701025T030000",
    "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];
}

export function buildCalendarEvent(event: CalendarEventInput) {
  const lines = [
    "BEGIN:VEVENT",
    buildCalendarProperty("UID", event.uid),
    buildCalendarProperty("DTSTAMP", formatCalendarUtcDateTime(event.dtStamp)),
    buildCalendarProperty("DTSTART;TZID=Europe/Prague", formatCalendarPragueDateTime(event.startsAt)),
    buildCalendarProperty("DTEND;TZID=Europe/Prague", formatCalendarPragueDateTime(event.endsAt)),
    buildCalendarProperty("SUMMARY", escapeCalendarText(event.summary)),
    buildCalendarProperty("STATUS", event.status),
  ];

  if (typeof event.sequence === "number") {
    lines.push(buildCalendarProperty("SEQUENCE", String(event.sequence)));
  }

  if (event.lastModified) {
    lines.push(buildCalendarProperty("LAST-MODIFIED", formatCalendarUtcDateTime(event.lastModified)));
  }

  if (event.description) {
    lines.push(buildCalendarProperty("DESCRIPTION", escapeCalendarText(event.description)));
  }

  if (event.location) {
    lines.push(buildCalendarProperty("LOCATION", escapeCalendarText(event.location)));
  }

  lines.push("END:VEVENT");

  return lines.join("\r\n");
}

export function buildCalendarIcs(input: CalendarDefinitionInput) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    buildCalendarProperty("PRODID", input.productId),
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    buildCalendarProperty("X-WR-CALNAME", escapeCalendarText(input.name)),
    buildCalendarProperty("X-WR-TIMEZONE", PRAGUE_TIME_ZONE),
  ];

  if (input.description) {
    lines.push(buildCalendarProperty("X-WR-CALDESC", escapeCalendarText(input.description)));
  }

  lines.push(...buildTimeZoneBlock());
  lines.push(...input.events.map((event) => buildCalendarEvent(event)));
  lines.push("END:VCALENDAR");

  return `${lines.join("\r\n")}\r\n`;
}

export { PRAGUE_TIME_ZONE };
