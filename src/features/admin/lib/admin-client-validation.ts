import { z } from "zod";

export const clientListSortValues = ["recent", "bookings", "name", "created"] as const;
export const clientListStatusValues = ["all", "active", "inactive"] as const;

export const clientListSearchParamsSchema = z.object({
  query: z.string().trim().max(120).optional(),
  status: z.enum(clientListStatusValues).optional(),
  sort: z.enum(clientListSortValues).optional(),
});

export const updateClientNoteSchema = z.object({
  area: z.enum(["owner", "salon"]),
  clientId: z.string().trim().min(1).max(64),
  internalNote: z
    .string()
    .trim()
    .max(1000, "Interní poznámka je příliš dlouhá.")
    .optional()
    .or(z.literal("")),
});

export type ClientListSortValue = (typeof clientListSortValues)[number];
export type ClientListStatusValue = (typeof clientListStatusValues)[number];
