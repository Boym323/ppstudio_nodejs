import { z } from "zod";

export const bookingListStatusValues = [
  "all",
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
] as const;

export const bookingListSourceValues = [
  "all",
  "web",
  "phone",
  "instagram",
  "in_person",
  "other",
] as const;

export const bookingListStatValues = [
  "needs_closure",
  "upcoming",
  "pending",
  "confirmed",
  "completed",
  "cancelled",
] as const;

export const bookingListGroupValues = [
  "needs_closure",
  "pending",
  "upcoming",
  "past",
] as const;

const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional();

export const bookingListSearchParamsSchema = z.object({
  query: z.string().trim().max(120).optional(),
  status: z.enum(bookingListStatusValues).optional(),
  source: z.enum(bookingListSourceValues).optional(),
  stat: z.enum(bookingListStatValues).optional(),
  dateFrom: isoDateSchema,
  dateTo: isoDateSchema,
  showPast: z.enum(["0", "1"]).optional(),
  needsClosureLimit: z.coerce.number().int().min(1).max(200).optional(),
  pendingLimit: z.coerce.number().int().min(1).max(200).optional(),
  upcomingLimit: z.coerce.number().int().min(1).max(200).optional(),
  pastLimit: z.coerce.number().int().min(1).max(200).optional(),
});

export type BookingListStatusValue = (typeof bookingListStatusValues)[number];
export type BookingListSourceValue = (typeof bookingListSourceValues)[number];
export type BookingListStatValue = (typeof bookingListStatValues)[number];
export type BookingListGroupValue = (typeof bookingListGroupValues)[number];
