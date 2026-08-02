import { z } from "zod";

const PRAGUE_TIME_ZONE = "Europe/Prague";
const dateInputPattern = /^\d{4}-\d{2}-\d{2}$/;
const pragueOffsetFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: PRAGUE_TIME_ZONE,
  timeZoneName: "longOffset",
});

type VoucherValidityBoundary = "start" | "end";

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

  return new Date(localDate.getTime() - signedOffsetMinutes * 60 * 1000);
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
