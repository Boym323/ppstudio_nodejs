export type RetentionBand = "8_11" | "12_15" | "16_plus";

function pragueDay(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)])) as Record<"year" | "month" | "day", number>;
  return Date.UTC(values.year, values.month - 1, values.day);
}

export function getWeeksWithoutVisit(lastVisitAt: Date | null, now = new Date()) {
  if (!lastVisitAt || lastVisitAt >= now) return null;
  return Math.floor((pragueDay(now) - pragueDay(lastVisitAt)) / (7 * 24 * 60 * 60 * 1000));
}

export function getRetentionBand(lastVisitAt: Date | null, now = new Date()): RetentionBand | null {
  const elapsedWeeks = getWeeksWithoutVisit(lastVisitAt, now);
  if (elapsedWeeks === null) return null;
  if (elapsedWeeks >= 16) return "16_plus";
  if (elapsedWeeks >= 12) return "12_15";
  if (elapsedWeeks >= 8) return "8_11";
  return null;
}

export function getRetentionBandLabel(band: RetentionBand) {
  return ({ "8_11": "Bez návštěvy 8–11 týdnů", "12_15": "Bez návštěvy 12–15 týdnů", "16_plus": "Bez návštěvy 16+ týdnů" })[band];
}
