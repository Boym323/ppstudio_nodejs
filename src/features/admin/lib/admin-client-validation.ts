import { z } from "zod";

export const clientListSortValues = ["recent", "bookings", "name", "created"] as const;
export const clientListStatusValues = ["all", "active", "inactive"] as const;
export const clientListQuickFilterValues = [
  "all",
  "with_booking",
  "without_booking",
  "no_contact",
  "noted",
  "new_30",
] as const;

export const clientListSearchParamsSchema = z.object({
  query: z.string().trim().max(120).optional(),
  status: z.enum(clientListStatusValues).optional(),
  sort: z.enum(clientListSortValues).optional(),
  quick: z.enum(clientListQuickFilterValues).optional(),
  retention: z.enum(["8_11", "12_15", "16_plus"]).optional(),
  retentionAt: z.string().regex(/^\d{13}$/).optional(),
  page: z.string().optional(),
});

export function normalizeClientListPage(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) {
    return 1;
  }

  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

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

export const updateClientContactSchema = z.object({
  area: z.enum(["owner", "salon"]),
  clientId: z.string().trim().min(1).max(64),
  email: z
    .string()
    .trim()
    .max(254, "E-mail je příliš dlouhý.")
    .refine((value) => value.length === 0 || z.email().safeParse(value).success, {
      message: "Zadejte platný e-mail.",
    }),
  phone: z.string().trim().max(32, "Telefon je příliš dlouhý.").optional().or(z.literal("")),
});

export type ClientListSortValue = (typeof clientListSortValues)[number];
export type ClientListStatusValue = (typeof clientListStatusValues)[number];
export type ClientListQuickFilterValue = (typeof clientListQuickFilterValues)[number];
