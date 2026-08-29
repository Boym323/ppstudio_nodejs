"use server";

import { AdminRole, BookingStatus } from "@/generated/prisma/client";
import { z } from "zod";

import { type RedeemBookingVoucherActionState } from "@/features/admin/actions/redeem-booking-voucher-action-state";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

import { readFormString } from "./shared";

const redeemBookingVoucherSchema = z.object({
  area: z.enum(["owner", "salon"]),
  bookingId: z.string().trim().min(1).max(64),
  voucherCode: z.string().trim().min(1, "Zadejte kód voucheru.").max(64, "Kód voucheru je příliš dlouhý."),
  amountCzk: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.coerce
      .number({ error: "Částku zadejte jako celé číslo v Kč." })
      .int("Částka musí být celé číslo v Kč.")
      .min(1, "Částka musí být vyšší než 0.")
      .optional(),
  ),
  note: z.string().trim().max(2000, "Poznámka je příliš dlouhá.").optional().or(z.literal("")),
});

/**
 * Compatibility guard for old callers. Actual voucher redemption belongs to
 * completeBookingVisitAction, where the booking is completed atomically with
 * the financial event.
 */
export async function redeemBookingVoucherAction(
  _previousState: RedeemBookingVoucherActionState,
  formData: FormData,
): Promise<RedeemBookingVoucherActionState> {
  const parsed = redeemBookingVoucherSchema.safeParse({
    area: readFormString(formData, "area"),
    bookingId: readFormString(formData, "bookingId"),
    voucherCode: readFormString(formData, "voucherCode"),
    amountCzk: readFormString(formData, "amountCzk"),
    note: readFormString(formData, "note"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      formError: "Voucher je potřeba ještě doplnit nebo opravit.",
      fieldErrors: {
        voucherCode: fieldErrors.voucherCode?.[0],
        amountCzk: fieldErrors.amountCzk?.[0],
        note: fieldErrors.note?.[0],
      },
    };
  }

  await requireRole([AdminRole.OWNER, AdminRole.SALON]);

  const booking = await prisma.booking.findUnique({
    where: { id: parsed.data.bookingId },
    select: { status: true },
  });

  if (!booking) {
    return { status: "error", formError: "Rezervaci se nepodařilo najít." };
  }

  if (booking.status !== BookingStatus.COMPLETED) {
    return {
      status: "error",
      formError: "Voucher lze skutečně uplatnit pouze při dokončení návštěvy. Použijte akci „Dokončit návštěvu“.",
    };
  }

  return {
    status: "error",
    formError: "Samostatné uplatnění voucheru není dostupné. Voucher se uplatňuje pouze v rámci dokončení návštěvy.",
  };
}
