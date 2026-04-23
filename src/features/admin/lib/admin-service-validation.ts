import { z } from "zod";

export const serviceListSortValues = ["category", "name", "duration", "price", "order"] as const;
export const serviceListStatusValues = ["all", "active", "inactive"] as const;
export const serviceListBookableValues = ["all", "public", "private"] as const;
export const pricingBadgeSuggestions = [
  "PRO PRVNÍ NÁVŠTĚVU",
  "DELŠÍ VARIANTA",
  "CÍLENĚJŠÍ PÉČE",
  "INTENZIVNÍ PÉČE",
  "REGENERACE",
] as const;

export const serviceListSearchParamsSchema = z.object({
  query: z.string().trim().max(120).optional(),
  status: z.enum(serviceListStatusValues).optional(),
  bookable: z.enum(serviceListBookableValues).optional(),
  sort: z.enum(serviceListSortValues).optional(),
  category: z.string().trim().max(64).optional(),
  serviceId: z.string().trim().max(64).optional(),
  mode: z.enum(["list", "create"]).optional(),
  mobileDetail: z.enum(["0", "1"]).optional(),
});

export const updateServiceSchema = z.object({
  area: z.enum(["owner", "salon"]),
  serviceId: z.string().trim().min(1).max(64),
  returnTo: z.string().trim().min(1).max(400).optional(),
  intent: z.enum(["save", "save-close"]).optional(),
  categoryId: z.string().trim().min(1, "Vyberte kategorii služby.").max(64),
  name: z.string().trim().min(2, "Název služby musí mít alespoň 2 znaky.").max(120, "Název služby je příliš dlouhý."),
  publicName: z.string().trim().max(120, "Veřejný název je příliš dlouhý.").optional().or(z.literal("")),
  description: z.string().trim().max(4000, "Detailní popis je příliš dlouhý.").optional().or(z.literal("")),
  publicIntro: z.string().trim().max(400, "Veřejný úvod je příliš dlouhý.").optional().or(z.literal("")),
  seoDescription: z.string().trim().max(240, "SEO popis je příliš dlouhý.").optional().or(z.literal("")),
  pricingShortDescription: z
    .string()
    .trim()
    .max(240, "Krátký popis do ceníku je příliš dlouhý.")
    .optional()
    .or(z.literal("")),
  pricingBadge: z.string().trim().max(40, "Badge je příliš dlouhý.").optional().or(z.literal("")),
  durationMinutes: z.coerce
    .number({ error: "Délku zadejte v minutách." })
    .int("Délka musí být celé číslo.")
    .min(5, "Délka služby musí být alespoň 5 minut.")
    .max(480, "Délka služby je neobvykle dlouhá. Zkontrolujte prosím hodnotu."),
  priceFromCzk: z.union([
    z.literal(""),
    z.coerce
      .number({ error: "Cenu zadejte jako celé číslo v Kč." })
      .int("Cena musí být celé číslo v Kč.")
      .min(0, "Cena nesmí být záporná.")
      .max(50000, "Cena je neobvykle vysoká. Zkontrolujte prosím hodnotu."),
  ]),
  sortOrder: z.coerce
    .number({ error: "Pořadí zadejte jako celé číslo." })
    .int("Pořadí musí být celé číslo.")
    .min(0, "Pořadí nesmí být záporné.")
    .max(9999, "Pořadí je příliš vysoké."),
  isActive: z.boolean(),
  isPubliclyBookable: z.boolean(),
}).superRefine((value, ctx) => {
  if (value.isPubliclyBookable && (!value.publicIntro || value.publicIntro.trim().length < 12)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["publicIntro"],
      message: "Veřejně rezervovatelná služba potřebuje srozumitelný veřejný úvod (alespoň 12 znaků).",
    });
  }
});

export const createServiceSchema = z.object({
  area: z.enum(["owner", "salon"]),
  returnTo: z.string().trim().min(1).max(400).optional(),
  categoryId: z.string().trim().min(1, "Vyberte kategorii služby.").max(64),
  name: z.string().trim().min(2, "Název služby musí mít alespoň 2 znaky.").max(120, "Název služby je příliš dlouhý."),
  publicName: z.string().trim().max(120, "Veřejný název je příliš dlouhý.").optional().or(z.literal("")),
  description: z.string().trim().max(4000, "Detailní popis je příliš dlouhý.").optional().or(z.literal("")),
  publicIntro: z.string().trim().max(400, "Veřejný úvod je příliš dlouhý.").optional().or(z.literal("")),
  seoDescription: z.string().trim().max(240, "SEO popis je příliš dlouhý.").optional().or(z.literal("")),
  pricingShortDescription: z
    .string()
    .trim()
    .max(240, "Krátký popis do ceníku je příliš dlouhý.")
    .optional()
    .or(z.literal("")),
  pricingBadge: z.string().trim().max(40, "Badge je příliš dlouhý.").optional().or(z.literal("")),
  durationMinutes: z.coerce
    .number({ error: "Délku zadejte v minutách." })
    .int("Délka musí být celé číslo.")
    .min(5, "Délka služby musí být alespoň 5 minut.")
    .max(480, "Délka služby je neobvykle dlouhá. Zkontrolujte prosím hodnotu."),
  priceFromCzk: z.union([
    z.literal(""),
    z.coerce
      .number({ error: "Cenu zadejte jako celé číslo v Kč." })
      .int("Cena musí být celé číslo v Kč.")
      .min(0, "Cena nesmí být záporná.")
      .max(50000, "Cena je neobvykle vysoká. Zkontrolujte prosím hodnotu."),
  ]),
  isActive: z.boolean(),
  isPubliclyBookable: z.boolean(),
}).superRefine((value, ctx) => {
  if (value.isPubliclyBookable && (!value.publicIntro || value.publicIntro.trim().length < 12)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["publicIntro"],
      message: "Veřejně rezervovatelná služba potřebuje srozumitelný veřejný úvod (alespoň 12 znaků).",
    });
  }
});

export type ServiceListSortValue = (typeof serviceListSortValues)[number];
export type ServiceListStatusValue = (typeof serviceListStatusValues)[number];
export type ServiceListBookableValue = (typeof serviceListBookableValues)[number];
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;
