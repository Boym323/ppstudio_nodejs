import { z } from "zod";

export const serviceCategoryListSortValues = ["order", "name", "services"] as const;
export const serviceCategoryListStatusValues = ["all", "active", "inactive"] as const;
export const serviceCategoryIssueFilterValues = ["empty", "without-public", "warning"] as const;
export const pricingLayoutValues = ["LIST", "GRID"] as const;
export const pricingIconKeyValues = ["DROPLET", "EYE_LASHES", "LOTUS", "BRUSH", "LEAF", "LIPSTICK", "SPARK"] as const;

export const serviceCategoryListSearchParamsSchema = z.object({
  query: z.string().trim().max(120).optional(),
  status: z.enum(serviceCategoryListStatusValues).optional(),
  sort: z.enum(serviceCategoryListSortValues).optional(),
  flags: z.preprocess((value) => {
    if (typeof value !== "string" || value.trim().length === 0) {
      return undefined;
    }

    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }, z.array(z.enum(serviceCategoryIssueFilterValues)).max(3).optional()),
  categoryId: z.string().trim().max(64).optional(),
  mode: z.enum(["list", "create"]).optional(),
  mobileDetail: z.enum(["0", "1"]).optional(),
});

export const updateServiceCategorySchema = z.object({
  area: z.enum(["owner", "salon"]),
  categoryId: z.string().trim().min(1).max(64),
  returnTo: z.string().trim().min(1).max(400).optional(),
  intent: z.enum(["save", "save-close"]).optional(),
  name: z
    .string()
    .trim()
    .min(2, "Název kategorie musí mít alespoň 2 znaky.")
    .max(120, "Název kategorie je příliš dlouhý."),
  description: z
    .string()
    .trim()
    .max(1000, "Popis je příliš dlouhý.")
    .optional()
    .or(z.literal("")),
  pricingDescription: z
    .string()
    .trim()
    .max(240, "Popis pro ceník je příliš dlouhý.")
    .optional()
    .or(z.literal("")),
  pricingLayout: z.enum(pricingLayoutValues),
  pricingIconKey: z.enum(pricingIconKeyValues),
  sortOrder: z.coerce
    .number({ error: "Pořadí zadejte jako celé číslo." })
    .int("Pořadí musí být celé číslo.")
    .min(0, "Pořadí nesmí být záporné.")
    .max(9999, "Pořadí je příliš vysoké."),
  pricingSortOrder: z.coerce
    .number({ error: "Pořadí v ceníku zadejte jako celé číslo." })
    .int("Pořadí v ceníku musí být celé číslo.")
    .min(0, "Pořadí v ceníku nesmí být záporné.")
    .max(9999, "Pořadí v ceníku je příliš vysoké."),
  isActive: z.boolean(),
});

export const createServiceCategorySchema = z.object({
  area: z.enum(["owner", "salon"]),
  returnTo: z.string().trim().min(1).max(400).optional(),
  name: z
    .string()
    .trim()
    .min(2, "Název kategorie musí mít alespoň 2 znaky.")
    .max(120, "Název kategorie je příliš dlouhý."),
  description: z
    .string()
    .trim()
    .max(1000, "Popis je příliš dlouhý.")
    .optional()
    .or(z.literal("")),
  pricingDescription: z
    .string()
    .trim()
    .max(240, "Popis pro ceník je příliš dlouhý.")
    .optional()
    .or(z.literal("")),
  pricingLayout: z.enum(pricingLayoutValues),
  pricingIconKey: z.enum(pricingIconKeyValues),
  sortOrder: z.coerce
    .number({ error: "Pořadí zadejte jako celé číslo." })
    .int("Pořadí musí být celé číslo.")
    .min(0, "Pořadí nesmí být záporné.")
    .max(9999, "Pořadí je příliš vysoké."),
  pricingSortOrder: z.coerce
    .number({ error: "Pořadí v ceníku zadejte jako celé číslo." })
    .int("Pořadí v ceníku musí být celé číslo.")
    .min(0, "Pořadí v ceníku nesmí být záporné.")
    .max(9999, "Pořadí v ceníku je příliš vysoké."),
  isActive: z.boolean(),
});

export const deleteServiceCategorySchema = z.object({
  area: z.enum(["owner", "salon"]),
  categoryId: z.string().trim().min(1).max(64),
  currentPath: z.string().trim().min(1).max(200),
});

export type ServiceCategoryListSortValue = (typeof serviceCategoryListSortValues)[number];
export type ServiceCategoryListStatusValue = (typeof serviceCategoryListStatusValues)[number];
export type ServiceCategoryIssueFilterValue = (typeof serviceCategoryIssueFilterValues)[number];
