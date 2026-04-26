export function formatBookingDateLabel(startsAt: Date, endsAt: Date) {
  const dateFormatter = getBookingDateFormatter();
  const timeFormatter = getBookingTimeFormatter();

  return `${dateFormatter.format(startsAt)} od ${timeFormatter.format(startsAt)} do ${timeFormatter.format(endsAt)}`;
}

export function formatBookingCalendarDate(startsAt: Date) {
  return getBookingDateFormatter().format(startsAt);
}

export function formatBookingTimeRange(startsAt: Date, endsAt: Date) {
  const timeFormatter = getBookingTimeFormatter();

  return `${timeFormatter.format(startsAt)} – ${timeFormatter.format(endsAt)}`;
}

function getBookingDateFormatter() {
  return new Intl.DateTimeFormat("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Prague",
  });
}

function getBookingTimeFormatter() {
  return new Intl.DateTimeFormat("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Prague",
  });
}
