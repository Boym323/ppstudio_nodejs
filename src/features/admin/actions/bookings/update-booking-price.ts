"use server";

import { AdminRole, BookingActorType, Prisma, } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";








import { type UpdateBookingPriceActionState } from "@/features/admin/actions/update-booking-price-action-state";


import {




} from "@/features/admin/lib/admin-booking";
import {


} from "@/features/admin/lib/booking/booking-display";
import {



} from "@/features/booking/domain/booking-status-transition";
import {





} from "@/features/booking/lib/booking-public";
import {



} from "@/features/booking/lib/booking-rescheduling";

import {




} from "@/features/vouchers/lib/voucher-redemption";

import { getBookingPaymentSummary } from "@/features/booking/payments/lib/booking-payment-summary";

import { requireRole } from "@/lib/auth/session";


import { runSerializableTransaction } from "@/lib/serializable-transaction";

import {


  readFormString,
  revalidateBookingAdminPaths,




  resolveVoucherRedemptionActorUserId,
} from "./shared";

const updateBookingPriceSchema = z.object({
  area: z.enum(["owner", "salon"]),
  bookingId: z.string().trim().min(1).max(64),
  finalPriceCzk: z.preprocess(
    (value) => (value === "" || value === null ? null : value),
    z.coerce
      .number({ error: "Cenu zadejte jako celé číslo v Kč." })
      .int("Cena musí být celé číslo v Kč.")
      .min(0, "Cena nesmí být záporná.")
      .max(100_000, "Cena je mimo běžný rozsah.")
      .nullable(),
  ),
  priceAdjustmentReason: z.string().trim().max(500, "Důvod je příliš dlouhý.").optional().or(z.literal("")),
  confirmOverpayment: z.enum(["true", ""]).optional(),
});


export async function updateBookingPriceAction(
  _previousState: UpdateBookingPriceActionState,
  formData: FormData,
): Promise<UpdateBookingPriceActionState> {
  const parsed = updateBookingPriceSchema.safeParse({
    area: readFormString(formData, "area"),
    bookingId: readFormString(formData, "bookingId"),
    finalPriceCzk: readFormString(formData, "finalPriceCzk"),
    priceAdjustmentReason: readFormString(formData, "priceAdjustmentReason"),
    confirmOverpayment: readFormString(formData, "confirmOverpayment"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      formError: "Cenu rezervace je potřeba doplnit nebo opravit.",
      fieldErrors: {
        finalPriceCzk: fieldErrors.finalPriceCzk?.[0],
        priceAdjustmentReason: fieldErrors.priceAdjustmentReason?.[0],
      },
    };
  }

  const session = await requireRole([AdminRole.OWNER, AdminRole.SALON]);
  const nextFinalPriceCzk = parsed.data.finalPriceCzk;
  const normalizedReason = parsed.data.priceAdjustmentReason?.trim() ?? "";
  const actorUserId = await resolveVoucherRedemptionActorUserId(session.email);
  const result = await runSerializableTransaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "Booking" WHERE "id" = ${parsed.data.bookingId} FOR UPDATE
    `);
    const currentBooking = await tx.booking.findUnique({
      where: { id: parsed.data.bookingId },
      select: {
        id: true,
        clientId: true,
        status: true,
        servicePriceFromCzk: true,
        finalPriceCzk: true,
        priceAdjustmentReason: true,
        priceAdjustedAt: true,
        priceAdjustedByUserId: true,
        service: { select: { priceFromCzk: true } },
        voucherRedemptions: { select: { amountCzk: true } },
        payments: { select: { amountCzk: true, status: true } },
      },
    });

    if (!currentBooking) return { status: "not-found" as const };

    const basePriceCzk = Math.max(0, currentBooking.servicePriceFromCzk ?? currentBooking.service.priceFromCzk ?? 0);
    const clearsAdjustment = nextFinalPriceCzk === null || nextFinalPriceCzk === basePriceCzk;
    if (!clearsAdjustment && normalizedReason.length === 0) {
      return { status: "reason-required" as const };
    }

    const nextPaymentSummary = getBookingPaymentSummary({
      totalPriceCzk: clearsAdjustment ? basePriceCzk : nextFinalPriceCzk,
      voucherRedemptions: currentBooking.voucherRedemptions,
      payments: currentBooking.payments,
    });
    if (nextPaymentSummary.overpaidCzk > 0 && parsed.data.confirmOverpayment !== "true") {
      return { status: "overpayment-confirmation-required" as const, overpaidCzk: nextPaymentSummary.overpaidCzk };
    }

    const nextStoredPrice = clearsAdjustment ? null : nextFinalPriceCzk;
    const nextStoredReason = clearsAdjustment ? null : normalizedReason;
    if (
      currentBooking.finalPriceCzk === nextStoredPrice
      && currentBooking.priceAdjustmentReason === nextStoredReason
    ) return { status: "unchanged" as const, bookingId: currentBooking.id, clientId: currentBooking.clientId, clearsAdjustment };

    const changedAt = new Date();
    await tx.booking.update({
      where: { id: currentBooking.id },
      data: clearsAdjustment
        ? {
            finalPriceCzk: null,
            priceAdjustmentReason: null,
            priceAdjustedAt: null,
            priceAdjustedByUserId: null,
          }
        : {
            finalPriceCzk: nextFinalPriceCzk,
            priceAdjustmentReason: normalizedReason,
            priceAdjustedAt: changedAt,
            priceAdjustedByUserId: actorUserId,
          },
    });
    await tx.bookingStatusHistory.create({
      data: {
        bookingId: currentBooking.id,
        status: currentBooking.status,
        actorType: BookingActorType.USER,
        actorUserId,
        reason: clearsAdjustment ? "Individuální cena zrušena" : "Individuální cena upravena",
        metadata: {
          source: "admin-booking-price-update-v1",
          before: {
            finalPriceCzk: currentBooking.finalPriceCzk,
            priceAdjustmentReason: currentBooking.priceAdjustmentReason,
            priceAdjustedAt: currentBooking.priceAdjustedAt?.toISOString() ?? null,
            priceAdjustedByUserId: currentBooking.priceAdjustedByUserId,
          },
          after: {
            finalPriceCzk: nextStoredPrice,
            priceAdjustmentReason: nextStoredReason,
            priceAdjustedAt: clearsAdjustment ? null : changedAt.toISOString(),
            priceAdjustedByUserId: clearsAdjustment ? null : actorUserId,
          },
        },
      },
    });
    return { status: "updated" as const, bookingId: currentBooking.id, clientId: currentBooking.clientId, clearsAdjustment };
  });

  if (result.status === "not-found") {
    return { status: "error", formError: "Rezervaci se nepodařilo najít." };
  }
  if (result.status === "reason-required") {
    return {
      status: "error",
      formError: "Upravená cena potřebuje krátký důvod.",
      fieldErrors: { priceAdjustmentReason: "Doplňte důvod úpravy ceny." },
    };
  }
  if (result.status === "overpayment-confirmation-required") {
    return {
      status: "error",
      formError: `Po změně vznikne přeplatek ${result.overpaidCzk} Kč. Potvrďte, že chcete cenu uložit.`,
    };
  }

  revalidateBookingAdminPaths(result.bookingId);
  revalidatePath(`/admin/klienti/${result.clientId}`);
  revalidatePath(`/admin/provoz/klienti/${result.clientId}`);

  return {
    status: "success",
    successMessage: result.clearsAdjustment
      ? "Individuální cena byla zrušená, rezervace znovu používá ceníkovou cenu."
      : "Individuální cena rezervace je uložená.",
  };
}

