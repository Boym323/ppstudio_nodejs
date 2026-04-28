import { z } from "zod";

const trimmedOptionalUrl = z
  .string()
  .trim()
  .max(300, "Odkaz je příliš dlouhý.")
  .optional()
  .or(z.literal(""))
  .transform((value) => value?.trim() ?? "");

export const updateSalonSettingsSchema = z.object({
  salonName: z.string().trim().min(2, "Zadejte název salonu.").max(120, "Název je příliš dlouhý."),
  addressLine: z.string().trim().min(3, "Zadejte ulici a číslo.").max(160, "Adresa je příliš dlouhá."),
  city: z.string().trim().min(2, "Zadejte město.").max(120, "Název města je příliš dlouhý."),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{3}\s?\d{2}$/, "PSČ zadejte ve tvaru 602 00.")
    .transform((value) => {
      const digits = value.replace(/\s+/g, "");
      return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    }),
  phone: z
    .string()
    .trim()
    .min(8, "Zadejte telefon pro klientky.")
    .max(32, "Telefon je příliš dlouhý.")
    .refine((value) => /^\+?[\d\s()-]{8,32}$/.test(value), {
      message: "Telefon zadejte v běžném formátu, například +420 777 000 000.",
    }),
  contactEmail: z.email("Zadejte platný kontaktní e-mail."),
  instagramUrl: trimmedOptionalUrl.refine(
    (value) => value.length === 0 || /^https?:\/\//.test(value),
    "Instagram odkaz musí začínat na http:// nebo https://.",
  ),
  voucherPdfLogoMediaId: z.string().trim().max(128, "Vybrané médium není platné.").optional().or(z.literal("")),
});

export const updateBookingSettingsSchema = z.object({
  bookingMinAdvanceHours: z.coerce
    .number()
    .int("Použijte celé hodiny.")
    .min(0, "Předstih nemůže být záporný.")
    .max(168, "Předstih držte maximálně na 168 hodin."),
  bookingMaxAdvanceDays: z.coerce
    .number()
    .int("Použijte celé dny.")
    .min(1, "Horizont musí být alespoň 1 den.")
    .max(365, "Horizont držte maximálně na 365 dní."),
  bookingCancellationHours: z.coerce
    .number()
    .int("Použijte celé hodiny.")
    .min(0, "Limit storna nemůže být záporný.")
    .max(336, "Limit storna držte maximálně na 336 hodin."),
}).superRefine((value, context) => {
  if (value.bookingMinAdvanceHours >= value.bookingMaxAdvanceDays * 24) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["bookingMaxAdvanceDays"],
      message: "Horizont dopředu musí být delší než minimální předstih rezervace.",
    });
  }
});

export const updateEmailSettingsSchema = z.object({
  notificationAdminEmail: z.email("Zadejte platný e-mail pro upozornění."),
  emailSenderName: z
    .string()
    .trim()
    .min(2, "Zadejte jméno odesílatele.")
    .max(120, "Jméno odesílatele je příliš dlouhé."),
  emailSenderEmail: z.email("Zadejte platný e-mail odesílatele."),
  emailFooterText: z
    .string()
    .trim()
    .max(600, "Patička je příliš dlouhá.")
    .optional()
    .or(z.literal("")),
});

export const updatePushoverSettingsSchema = z.object({
  pushoverUserKey: z.string().trim().max(128, "Pushover User Key je příliš dlouhý.").optional().or(z.literal("")),
  pushoverEnabled: z.boolean(),
  notifyNewBooking: z.boolean(),
  notifyBookingPending: z.boolean(),
  notifyBookingConfirmed: z.boolean(),
  notifyBookingCancelled: z.boolean(),
  notifyBookingRescheduled: z.boolean(),
  notifyEmailFailed: z.boolean(),
  notifyReminderFailed: z.boolean(),
  notifySystemErrors: z.boolean(),
});
