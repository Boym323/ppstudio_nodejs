export function formatBookingDateLabel(startsAt: Date, endsAt: Date) {
  const dateFormatter = new Intl.DateTimeFormat("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Prague",
  });

  const timeFormatter = new Intl.DateTimeFormat("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Prague",
  });

  return `${dateFormatter.format(startsAt)} od ${timeFormatter.format(startsAt)} do ${timeFormatter.format(endsAt)}`;
}
