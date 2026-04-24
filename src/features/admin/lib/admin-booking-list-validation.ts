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
  "upcoming",
  "pending",
  "confirmed",
  "completed",
  "cancelled",
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
});

export type BookingListStatusValue = (typeof bookingListStatusValues)[number];
export type BookingListSourceValue = (typeof bookingListSourceValues)[number];
export type BookingListStatValue = (typeof bookingListStatValues)[number];
