import { z } from "zod";

const PRAGUE_TIME_ZONE = "Europe/Prague";
const dateInputPattern = /^\d{4}-\d{2}-\d{2}$/;
const pragueCalendarDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: PRAGUE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const pragueOffsetFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: PRAGUE_TIME_ZONE,
  timeZoneName: "longOffset",
});

type VoucherValidityBoundary = "start" | "end";

type PragueCalendarDateParts = {
  year: number;
  month: number;
  day: number;
};

function getPragueCalendarDateParts(value: Date): PragueCalendarDateParts {
  const parts = pragueCalendarDateFormatter.formatToParts(value);
  const getPart = (type: "year" | "month" | "day") => {
    const part = parts.find((item) => item.type === type)?.value;

    if (!part) {
      throw new RangeError("Unable to resolve Prague calendar " + type + ".");
    }

    return Number(part);
  };

  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
  };
}

function formatCalendarDate({ year, month, day }: PragueCalendarDateParts) {
  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number) {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** Vrátí kalendářní datum voucheru v časové zóně studia. */
export function getVoucherPragueCalendarDate(value: Date) {
  return pragueCalendarDateFormatter.format(value);
}

/** Převede okamžik na začátek nebo konec jeho kalendářního dne v Praze. */
export function getVoucherPragueDateBoundary(value: Date, boundary: VoucherValidityBoundary) {
  return convertPragueDateInput(getVoucherPragueCalendarDate(value), boundary);
}

/** Přičte měsíce a zachová poslední platný den cílového měsíce. */
export function addVoucherValidityMonths(
  value: Date,
  months: number,
  boundary: VoucherValidityBoundary = "start",
) {
  if (!Number.isInteger(months)) {
    throw new RangeError("Voucher validity months must be an integer.");
  }

  const sourceDate = getPragueCalendarDateParts(value);
  const targetMonthIndex = sourceDate.month - 1 + months;
  const targetYear = sourceDate.year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12 + 1;
  const targetDate = {
    year: targetYear,
    month: targetMonth,
    day: Math.min(sourceDate.day, daysInMonth(targetYear, targetMonth)),
  };

  return convertPragueDateInput(formatCalendarDate(targetDate), boundary);
}

function convertPragueDateInput(value: string, boundary: VoucherValidityBoundary) {
  const [year, month, day] = value.split("-").map(Number);
  const localDate = new Date(0);
  localDate.setUTCFullYear(year, month - 1, day);
  localDate.setUTCHours(0, 0, 0, 0);

  if (
    localDate.getUTCFullYear() !== year
    || localDate.getUTCMonth() !== month - 1
    || localDate.getUTCDate() !== day
  ) {
    throw new RangeError("Invalid ISO date.");
  }

  if (boundary === "end") {
    localDate.setUTCDate(localDate.getUTCDate() + 1);
  }

  const offset = pragueOffsetFormatter.formatToParts(localDate).find((part) => part.type === "timeZoneName")?.value;
  const offsetMatch = offset?.match(/^GMT([+-])(\d{2}):(\d{2})$/);

  if (!offsetMatch) {
    throw new RangeError("Unable to resolve Prague offset.");
  }

  const offsetMinutes = Number(offsetMatch[2]) * 60 + Number(offsetMatch[3]);
  const signedOffsetMinutes = offsetMatch[1] === "+" ? offsetMinutes : -offsetMinutes;

  return new Date(localDate.getTime() - signedOffsetMinutes * 60 * 1000 - (boundary === "end" ? 1 : 0));
}

export function optionalVoucherValidityDate(boundary: VoucherValidityBoundary) {
  return z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z
      .union([
        z.date(),
        z
          .string({ error: "Datum platnosti není platné." })
          .regex(dateInputPattern, "Datum platnosti není platné.")
          .transform((value, ctx) => {
            try {
              return convertPragueDateInput(value, boundary);
            } catch {
              ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Datum platnosti není platné." });
              return z.NEVER;
            }
          }),
      ])
      .optional(),
  );
}
