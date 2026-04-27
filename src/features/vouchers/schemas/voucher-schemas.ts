import { VoucherType } from "@prisma/client";
import { z } from "zod";

const optionalText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .or(z.literal(""))
    .transform((value) => value || undefined);

const optionalDate = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.date().optional(),
);

const commonCreateVoucherFields = {
  purchaserName: optionalText(160),
  purchaserEmail: optionalText(240).pipe(z.string().email("E-mail kupujícího není platný.").optional()),
  recipientName: optionalText(160),
  message: optionalText(1200),
  validFrom: optionalDate,
  validUntil: optionalDate,
  internalNote: optionalText(2000),
};

export const createVoucherSchema = z
  .discriminatedUnion("type", [
    z.object({
      type: z.literal(VoucherType.VALUE),
      ...commonCreateVoucherFields,
      originalValueCzk: z.coerce
        .number({ error: "Hodnotu voucheru zadejte jako celé číslo v Kč." })
        .int("Hodnota voucheru musí být celé číslo.")
        .min(1, "Hodnota voucheru musí být vyšší než 0."),
      serviceId: z.undefined().optional(),
    }),
    z.object({
      type: z.literal(VoucherType.SERVICE),
      ...commonCreateVoucherFields,
      serviceId: z.string().trim().min(1, "Vyberte službu.").max(64),
      originalValueCzk: z.undefined().optional(),
    }),
  ])
  .superRefine((value, ctx) => {
    if (
      value.validUntil &&
      value.validFrom &&
      value.validUntil.getTime() <= value.validFrom.getTime()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["validUntil"],
        message: "Platnost do musí být po datu začátku platnosti.",
      });
    }
  });

export const validateVoucherCodeSchema = z.object({
  code: z.string().trim().min(1, "Zadejte kód voucheru.").max(64),
  serviceId: z.string().trim().min(1, "Vyberte službu.").max(64),
});

export const redeemVoucherSchema = z.object({
  voucherCode: z.string().trim().min(1, "Zadejte kód voucheru.").max(64),
  bookingId: z.string().trim().min(1, "Vyberte rezervaci.").max(64),
  amountCzk: z.coerce
    .number({ error: "Částku zadejte jako celé číslo v Kč." })
    .int("Částka musí být celé číslo v Kč.")
    .min(1, "Částka musí být vyšší než 0.")
    .optional(),
  redeemedByUserId: z.string().trim().min(1).max(64).optional().nullable(),
  note: optionalText(2000),
});

export type CreateVoucherInput = z.infer<typeof createVoucherSchema>;
export type ValidateVoucherCodeInput = z.infer<typeof validateVoucherCodeSchema>;
export type RedeemVoucherInput = z.infer<typeof redeemVoucherSchema>;
