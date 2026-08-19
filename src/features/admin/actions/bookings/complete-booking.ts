"use server";

import { AdminRole, BookingActorType, BookingPaymentMethod, BookingStatus, Prisma, VoucherType } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";



import { type CompleteBookingVisitActionState } from "@/features/admin/actions/complete-booking-visit-action-state";







import {

  applyAdminBookingStatusChangeInTransaction,


} from "@/features/admin/lib/admin-booking";
import { getBookingStatusLabel } from "@/features/booking/lib/booking-status-presentation";
import {
  canApplyAdminBookingTransition,
  canCompleteBookingAt,

} from "@/features/booking/domain/booking-status-transition";
import {





} from "@/features/booking/lib/booking-public";
import {



} from "@/features/booking/lib/booking-rescheduling";

import {

  redeemVoucherForBookingInTransaction,
  VoucherRedemptionError,
  voucherRedemptionErrorCodes,
} from "@/features/vouchers/lib/voucher-redemption";
import { normalizeVoucherCode } from "@/features/vouchers/lib/voucher-code";
import { getBookingPaymentSummary } from "@/features/booking/payments/lib/booking-payment-summary";
import { createDirectBookingPayment } from "@/features/booking/payments/lib/booking-payment";
import { requireRole } from "@/lib/auth/session";
import { sendOwnerSystemErrorPushover } from "@/lib/notifications/pushover";
import { prisma } from "@/lib/prisma";


import {
  getVoucherRedemptionFormError,

  readFormString,
  revalidateBookingAdminPaths,




  resolveVoucherRedemptionActorUserId,
} from "./shared";

class CompletionPaymentError extends Error {}

const completeBookingVisitSchema = z
  .object({
    area: z.enum(["owner", "salon"]),
    bookingId: z.string().trim().min(1).max(64),
    completionMode: z.enum(["cash", "qr", "voucher", "combined", "no_payment", "settled"]),
    reason: z.string().trim().max(160, "Důvod je příliš dlouhý.").optional().or(z.literal("")),
    voucherCode: z.string().trim().max(64).optional().or(z.literal("")),
    voucherAmountCzk: z.preprocess(
      (value) => (value === "" || value === null ? undefined : value),
      z.coerce
        .number({ error: "Částka voucheru musí být celé číslo v Kč." })
        .int("Částka voucheru musí být celé číslo v Kč.")
        .min(1, "Částka voucheru musí být vyšší než 0.")
        .optional(),
    ),
    directAmountCzk: z.preprocess(
      (value) => (value === "" || value === null ? undefined : value),
      z.coerce
        .number({ error: "Částka platby musí být celé číslo v Kč." })
        .int("Částka platby musí být celé číslo v Kč.")
        .min(1, "Částka platby musí být vyšší než 0.")
        .optional(),
    ),
    directMethod: z.preprocess(
      (value) => (value === "" || value === null ? undefined : value),
      z.enum(["CASH", "BANK_TRANSFER"]).optional(),
    ),
    paymentNote: z.string().trim().max(500, "Poznámka je příliš dlouhá.").optional().or(z.literal("")),
    idempotencyKey: z.string().uuid("Neplatný identifikátor požadavku."),
  })
  .superRefine((value, ctx) => {
    if (value.completionMode === "no_payment" && !(value.reason ?? "").trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "Pro dokončení bez úhrady je povinný důvod.",
      });
    }

    if (
      (value.completionMode === "voucher" || value.completionMode === "combined")
      && !(value.voucherCode ?? "").trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["voucherCode"],
        message: "Zadejte kód voucheru.",
      });
    }

    if (value.completionMode === "combined" && !value.directMethod) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["directMethod"],
        message: "Vyberte způsob přímé platby.",
      });
    }

    if (
      (value.completionMode === "cash" || value.completionMode === "qr" || value.completionMode === "combined")
      && !value.directAmountCzk
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["directAmountCzk"],
        message: "Zadejte částku přímé platby.",
      });
    }
  });


export async function completeBookingVisitAction(
  _previousState: CompleteBookingVisitActionState,
  formData: FormData,
): Promise<CompleteBookingVisitActionState> {
  const parsed = completeBookingVisitSchema.safeParse({
    area: readFormString(formData, "area"),
    bookingId: readFormString(formData, "bookingId"),
    completionMode: readFormString(formData, "completionMode"),
    reason: readFormString(formData, "reason"),
    voucherCode: readFormString(formData, "voucherCode"),
    voucherAmountCzk: readFormString(formData, "voucherAmountCzk"),
    directAmountCzk: readFormString(formData, "directAmountCzk"),
    directMethod: readFormString(formData, "directMethod"),
    paymentNote: readFormString(formData, "paymentNote"),
    idempotencyKey: readFormString(formData, "idempotencyKey"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      status: "error",
      formError: "Dokončení návštěvy je potřeba doplnit nebo opravit.",
      fieldErrors: {
        completionMode: fieldErrors.completionMode?.[0],
        reason: fieldErrors.reason?.[0],
        voucherCode: fieldErrors.voucherCode?.[0],
        voucherAmountCzk: fieldErrors.voucherAmountCzk?.[0],
        directAmountCzk: fieldErrors.directAmountCzk?.[0],
        directMethod: fieldErrors.directMethod?.[0],
      },
    };
  }

  const session = await requireRole([AdminRole.OWNER, AdminRole.SALON]);
  const actorUserId = await resolveVoucherRedemptionActorUserId(session.email);
  const booking = await prisma.booking.findUnique({
    where: { id: parsed.data.bookingId },
    select: {
      id: true,
      serviceId: true,
      status: true,
      scheduledEndsAt: true,
      finalPriceCzk: true,
      servicePriceFromCzk: true,
      voucherRedemptions: { select: { amountCzk: true } },
      payments: { select: { amountCzk: true, status: true } },
      service: { select: { priceFromCzk: true } },
    },
  });

  if (!booking) {
    return { status: "error", formError: "Rezervaci se nepodařilo najít." };
  }

  if (!canApplyAdminBookingTransition(booking.status, BookingStatus.COMPLETED)) {
    return {
      status: "error",
      formError: `Rezervaci ve stavu „${getBookingStatusLabel(booking.status)}“ teď nejde dokončit.`,
    };
  }

  if (!canCompleteBookingAt(booking.scheduledEndsAt)) {
    return {
      status: "error",
      formError: "Rezervaci lze dokončit až po skončení naplánovaného termínu.",
    };
  }

  const paymentSummary = getBookingPaymentSummary({
    totalPriceCzk: booking.finalPriceCzk ?? booking.servicePriceFromCzk ?? booking.service.priceFromCzk ?? 0,
    voucherRedemptions: booking.voucherRedemptions,
    payments: booking.payments,
  });
  const remainingCzk = paymentSummary.remainingCzk;
  const mode = parsed.data.completionMode;
  const note = parsed.data.paymentNote?.trim() || null;
  const baseReason = parsed.data.reason?.trim() || undefined;

  if (remainingCzk > 0 && mode === "settled") {
    return {
      status: "error",
      formError: "Při doplatku je potřeba vybrat způsob úhrady nebo dokončení bez úhrady.",
      fieldErrors: { completionMode: "Vyberte způsob dokončení návštěvy." },
    };
  }

  const directAmountCzk =
    mode === "cash" || mode === "qr" || mode === "combined"
      ? parsed.data.directAmountCzk ?? remainingCzk
      : 0;
  let plannedVoucherAmountCzk = 0;
  let redeemedVoucherId: string | null = null;

  if ((mode === "voucher" || mode === "combined") && remainingCzk > 0) {
    const normalizedVoucherCode = normalizeVoucherCode(parsed.data.voucherCode ?? "");
    const voucher = await prisma.voucher.findUnique({
      where: { code: normalizedVoucherCode },
      select: {
        id: true,
        type: true,
        remainingValueCzk: true,
        serviceId: true,
        servicePriceSnapshotCzk: true,
      },
    });

    if (!voucher) {
      return {
        status: "error",
        formError: getVoucherRedemptionFormError(
          new VoucherRedemptionError(voucherRedemptionErrorCodes.voucherNotFound, "Voucher was not found."),
        ),
        fieldErrors: { voucherCode: "Voucher se nepodařilo najít." },
      };
    }

    if (voucher.type === VoucherType.VALUE) {
      const requestedVoucherAmountCzk =
        parsed.data.voucherAmountCzk ?? (mode === "voucher" ? remainingCzk : undefined);

      if (!requestedVoucherAmountCzk) {
        return {
          status: "error",
          formError: "U kombinované úhrady hodnotovým voucherem zadejte částku voucheru.",
          fieldErrors: { voucherAmountCzk: "Zadejte částku voucheru." },
        };
      }

      plannedVoucherAmountCzk = Math.min(requestedVoucherAmountCzk, voucher.remainingValueCzk ?? 0);
    } else {
      if (voucher.serviceId !== booking.serviceId) {
        return {
          status: "error",
          formError: getVoucherRedemptionFormError(
            new VoucherRedemptionError(voucherRedemptionErrorCodes.serviceMismatch, "Voucher service does not match booking."),
          ),
          fieldErrors: { voucherCode: "Voucher neodpovídá službě v rezervaci." },
        };
      }

      plannedVoucherAmountCzk =
        voucher.servicePriceSnapshotCzk ?? booking.servicePriceFromCzk ?? booking.service.priceFromCzk ?? 0;
    }
  }

  if (remainingCzk > 0 && mode !== "no_payment") {
    const plannedPaidCzk = directAmountCzk + plannedVoucherAmountCzk;

    if (plannedPaidCzk < remainingCzk) {
      return {
        status: "error",
        formError:
          "Zadaná úhrada nepokrývá celý doplatek. Doplňte platbu, nebo použijte „Bez platby“ s povinným důvodem.",
        fieldErrors:
          mode === "voucher" || mode === "combined"
            ? { voucherAmountCzk: "Úhrada musí pokrýt celý doplatek." }
            : { directAmountCzk: "Úhrada musí pokrýt celý doplatek." },
      };
    }
  }

  try {
    const transactionResult = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT "id" FROM "Booking" WHERE "id" = ${booking.id} FOR UPDATE
      `);
      const current = await tx.booking.findUnique({
        where: { id: booking.id },
        select: {
          id: true, status: true, scheduledEndsAt: true, finalPriceCzk: true, servicePriceFromCzk: true,
          service: { select: { priceFromCzk: true } },
          voucherRedemptions: { select: { amountCzk: true } },
          payments: { select: { amountCzk: true, status: true } },
        },
      });
      if (!current) throw new CompletionPaymentError("Rezervaci se nepodařilo najít.");
      if (!canApplyAdminBookingTransition(current.status, BookingStatus.COMPLETED)) {
        throw new CompletionPaymentError(`Rezervaci ve stavu „${getBookingStatusLabel(current.status)}“ teď nejde dokončit.`);
      }
      if (!canCompleteBookingAt(current.scheduledEndsAt)) {
        throw new CompletionPaymentError("Rezervaci lze dokončit až po skončení naplánovaného termínu.");
      }

      const currentSummary = getBookingPaymentSummary({
        totalPriceCzk: current.finalPriceCzk ?? current.servicePriceFromCzk ?? current.service.priceFromCzk ?? 0,
        voucherRedemptions: current.voucherRedemptions,
        payments: current.payments,
      });
      if (currentSummary.remainingCzk > 0 && mode === "settled") {
        throw new CompletionPaymentError("Při doplatku je potřeba vybrat způsob úhrady nebo dokončení bez úhrady.");
      }

      let voucherId: string | null = null;
      if (mode === "voucher" || mode === "combined") {
        const redemption = await redeemVoucherForBookingInTransaction(tx, {
          bookingId: current.id,
          voucherCode: parsed.data.voucherCode ?? "",
          amountCzk: parsed.data.voucherAmountCzk ?? (mode === "voucher" ? currentSummary.remainingCzk : undefined),
          redeemedByUserId: actorUserId,
          note: note ?? undefined,
        });
        voucherId = redemption.voucher.id;
        await tx.bookingStatusHistory.create({
          data: {
            bookingId: current.id, status: current.status, actorType: BookingActorType.USER, actorUserId,
            reason: "Voucher uplatněn při dokončení návštěvy",
            metadata: { source: "admin-booking-complete-flow-v1", amount: redemption.redemption.amountCzk, voucherCode: redemption.voucher.code },
          },
        });
      }

      if (mode === "cash" || mode === "qr" || mode === "combined") {
        const directMethod = mode === "cash" ? BookingPaymentMethod.CASH : mode === "qr"
          ? BookingPaymentMethod.BANK_TRANSFER
          : parsed.data.directMethod === "CASH" ? BookingPaymentMethod.CASH : BookingPaymentMethod.BANK_TRANSFER;
        const paymentResult = await createDirectBookingPayment(tx, {
          bookingId: current.id,
          amountCzk: parsed.data.directAmountCzk ?? currentSummary.remainingCzk,
          method: directMethod, paidAt: new Date(), note, idempotencyKey: parsed.data.idempotencyKey,
          actor: { area: parsed.data.area, email: session.email, role: session.role },
          audit: { reason: "Platba zapsána při dokončení návštěvy", source: "admin-booking-complete-flow-v1" },
        });
        if (paymentResult.status !== "created" && paymentResult.status !== "existing") {
          throw new CompletionPaymentError("Platbu se nepodařilo bezpečně zapsat.");
        }
      }

      const paidAfterCompletion = await tx.booking.findUniqueOrThrow({
        where: { id: current.id },
        select: { voucherRedemptions: { select: { amountCzk: true } }, payments: { select: { amountCzk: true, status: true } } },
      });
      const afterSummary = getBookingPaymentSummary({
        totalPriceCzk: current.finalPriceCzk ?? current.servicePriceFromCzk ?? current.service.priceFromCzk ?? 0,
        voucherRedemptions: paidAfterCompletion.voucherRedemptions,
        payments: paidAfterCompletion.payments,
      });
      if (mode !== "no_payment" && afterSummary.remainingCzk > 0) {
        throw new CompletionPaymentError("Zadaná úhrada nepokrývá celý doplatek.");
      }

      const completionReason = mode === "no_payment" && currentSummary.remainingCzk > 0
        ? `Rezervace označena jako hotová s neuhrazeným doplatkem. ${baseReason ?? ""}`.trim()
        : baseReason;
      const completion = await applyAdminBookingStatusChangeInTransaction(tx, {
        bookingId: current.id, targetStatus: BookingStatus.COMPLETED, actorUserId, reason: completionReason,
      });
      if (completion.status !== "success") throw new CompletionPaymentError("Stav rezervace se nepodařilo změnit.");
      return { voucherId };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    redeemedVoucherId = transactionResult.voucherId;
  } catch (error) {
    if (error instanceof VoucherRedemptionError) {
      return {
        status: "error",
        formError: getVoucherRedemptionFormError(error),
        fieldErrors:
          error.code === voucherRedemptionErrorCodes.voucherNotFound
            ? { voucherCode: getVoucherRedemptionFormError(error) }
            : error.code === voucherRedemptionErrorCodes.amountRequired
              || error.code === voucherRedemptionErrorCodes.insufficientRemainingValue
              ? { voucherAmountCzk: getVoucherRedemptionFormError(error) }
              : undefined,
      };
    }

    if (error instanceof CompletionPaymentError) {
      return { status: "error", formError: error.message };
    }

    console.error("Failed to register completion payment flow", error);

    await sendOwnerSystemErrorPushover({
      title: "PP Studio - systemova chyba",
      message: "Dokonceni navstevy nebo zapis uhrady selhal neocekavanou chybou.",
      context: {
        contextId: booking.id,
        bookingId: booking.id,
      },
      error,
    });

    return {
      status: "error",
      formError: "Úhradu se nepodařilo zapsat. Zkuste to prosím znovu.",
    };
  }

	  revalidateBookingAdminPaths(booking.id);
	  if (redeemedVoucherId) {
	    revalidatePath("/admin/vouchery");
	    revalidatePath("/admin/provoz/vouchery");
	    revalidatePath(`/admin/vouchery/${redeemedVoucherId}`);
	    revalidatePath(`/admin/provoz/vouchery/${redeemedVoucherId}`);
	  }

	  return {
    status: "success",
    successMessage:
      mode === "no_payment"
        ? "Návštěva je dokončená bez úhrady a důvod je uložený v historii."
        : "Úhrada je zapsaná a návštěva dokončená.",
  };
}
