import { z } from "zod";

import { type KpiDateRange, type KpiPeriod } from "@/features/admin/types/kpi-dashboard";

const periods = ["this_month", "last_month", "next_month", "last_30_days", "this_year", "custom"] as const;
export const kpiSearchParamsSchema = z.object({
  period: z.enum(periods).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export function getPragueDateParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)])) as Record<"year" | "month" | "day", number>;
}

export function getPragueMidnight(year: number, month: number, day: number) {
  const utc = Date.UTC(year, month - 1, day);
  const offset = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Prague", timeZoneName: "longOffset" }).formatToParts(new Date(utc)).find((part) => part.type === "timeZoneName")?.value ?? "GMT+00:00";
  const match = offset.match(/GMT([+-])(\d{2}):(\d{2})/);
  const minutes = match ? (Number(match[2]) * 60 + Number(match[3])) * (match[1] === "+" ? 1 : -1) : 0;
  return new Date(utc - minutes * 60_000);
}

export function addPragueCalendarDays(value: Date, days: number) {
  const parts = getPragueDateParts(value);
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return getPragueMidnight(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function getPragueCalendarDayCount(start: Date, end: Date) {
  const startParts = getPragueDateParts(start);
  const endParts = getPragueDateParts(end);
  return Math.round((
    Date.UTC(endParts.year, endParts.month - 1, endParts.day)
    - Date.UTC(startParts.year, startParts.month - 1, startParts.day)
  ) / 86_400_000);
}

export function usesMonthlyKpiBuckets(range: Pick<KpiDateRange, "start" | "end">) {
  return getPragueCalendarDayCount(range.start, range.end) > 62;
}

function isCompletePragueCalendarMonth(range: Pick<KpiDateRange, "start" | "end">) {
  const start = getPragueDateParts(range.start);
  return range.start.getTime() === getPragueMidnight(start.year, start.month, 1).getTime()
    && range.end.getTime() === getPragueMidnight(start.year, start.month + 1, 1).getTime();
}

function range(start: Date, end: Date, label: string, period: KpiPeriod): KpiDateRange {
  return { start, end, label, period };
}

function parseCalendarDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return { year, month, day };
}

export function getKpiDateRanges(input: unknown, now = new Date()) {
  const parsed = kpiSearchParamsSchema.safeParse(input);
  const params = parsed.success ? parsed.data : {};
  const period = params.period ?? "this_month";
  const today = getPragueDateParts(now);
  const todayStart = getPragueMidnight(today.year, today.month, today.day);
  let current: KpiDateRange;

  if (period === "last_month") {
    const start = getPragueMidnight(today.year, today.month - 1, 1);
    current = range(start, getPragueMidnight(today.year, today.month, 1), "Minulý měsíc", period);
  } else if (period === "next_month") {
    const start = getPragueMidnight(today.year, today.month + 1, 1);
    current = range(start, getPragueMidnight(today.year, today.month + 2, 1), "Příští měsíc", period);
  } else if (period === "last_30_days") {
    current = range(addPragueCalendarDays(todayStart, -29), addPragueCalendarDays(todayStart, 1), "Posledních 30 dní", period);
  } else if (period === "this_year") {
    current = range(getPragueMidnight(today.year, 1, 1), addPragueCalendarDays(todayStart, 1), "Tento rok", period);
  } else if (period === "custom" && params.dateFrom && params.dateTo) {
    const from = parseCalendarDate(params.dateFrom);
    const to = parseCalendarDate(params.dateTo);
    const start = from ? getPragueMidnight(from.year, from.month, from.day) : null;
    const end = to ? addPragueCalendarDays(getPragueMidnight(to.year, to.month, to.day), 1) : null;
    current = start && end && end > start ? range(start, end, "Vlastní období", period) : range(getPragueMidnight(today.year, today.month, 1), addPragueCalendarDays(todayStart, 1), "Tento měsíc", "this_month");
  } else {
    current = range(getPragueMidnight(today.year, today.month, 1), addPragueCalendarDays(todayStart, 1), "Tento měsíc", "this_month");
  }

  const calendarDays = getPragueCalendarDayCount(current.start, current.end);
  const currentStart = getPragueDateParts(current.start);
  const previousStart = isCompletePragueCalendarMonth(current)
    ? getPragueMidnight(currentStart.year, currentStart.month - 1, 1)
    : addPragueCalendarDays(current.start, -calendarDays);
  return { current, previous: range(previousStart, current.start, "Předchozí srovnatelné období", current.period) };
}

export function getKpiPercentChange(value: number, previousValue: number) {
  return previousValue === 0 ? null : ((value - previousValue) / previousValue) * 100;
}

export function getKpiDateKey(value: Date, monthly: boolean) {
  return new Intl.DateTimeFormat("cs-CZ", monthly ? { month: "short", year: "numeric", timeZone: "Europe/Prague" } : { day: "numeric", month: "numeric", year: "numeric", timeZone: "Europe/Prague" }).format(value);
}

export function getKpiPeriodStart(value: Date, monthly: boolean) {
  const parts = getPragueDateParts(value);
  return getPragueMidnight(parts.year, parts.month, monthly ? 1 : parts.day);
}

export function getKpiSeriesPeriodStarts(range: KpiDateRange, monthly: boolean) {
  const periods: Date[] = [];
  let cursor = getKpiPeriodStart(range.start, monthly);
  while (cursor < range.end) {
    periods.push(cursor);
    const parts = getPragueDateParts(cursor);
    cursor = monthly
      ? getPragueMidnight(parts.year, parts.month + 1, 1)
      : addPragueCalendarDays(cursor, 1);
  }
  return periods;
}

/** Interval očekávaných tržeb je průnik zvoleného období a budoucnosti. */
export function getKpiExpectedRevenueRange(range: KpiDateRange, now = new Date()) {
  const parts = getPragueDateParts(now);
  let end = range.end;

  if (range.period === "this_month") {
    end = getPragueMidnight(parts.year, parts.month + 1, 1);
  }
  if (range.period === "this_year") {
    end = getPragueMidnight(parts.year + 1, 1, 1);
  }

  const start = new Date(Math.max(range.start.getTime(), now.getTime()));
  return end > start ? { start, end } : null;
}
