"use server";

"use server";

import { AdminRole, BookingActorType, BookingPaymentMethod, BookingSource, BookingStatus, Prisma, VoucherType } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { type AdminArea } from "@/config/navigation";
import { type CreateManualBookingActionState } from "@/features/admin/actions/create-manual-booking-action-state";
import { type CompleteBookingVisitActionState } from "@/features/admin/actions/complete-booking-visit-action-state";
import { dispatchBookingStatusNotificationNonBlocking } from "@/features/admin/actions/booking-status-notification";
import { type RedeemBookingVoucherActionState } from "@/features/admin/actions/redeem-booking-voucher-action-state";
import { type RescheduleBookingActionState } from "@/features/admin/actions/reschedule-booking-action-state";
import { type UpdateBookingNoteActionState } from "@/features/admin/actions/update-booking-note-action-state";
import { type UpdateBookingPriceActionState } from "@/features/admin/actions/update-booking-price-action-state";
import { type UpdateBookingServiceActionState } from "@/features/admin/actions/update-booking-service-action-state";
import { type UpdateBookingStatusActionState } from "@/features/admin/actions/update-booking-status-action-state";
import {
  applyAdminBookingStatusChange,
  applyAdminBookingStatusChangeInTransaction,
  updateAdminBookingService,
  updateAdminBookingInternalNote,
} from "@/features/admin/lib/admin-booking";
import {
  getAdminBookingActionOptions,
  getBookingStatusLabel,
} from "@/features/admin/lib/booking/booking-display";
import {
  canApplyAdminBookingTransition,
  canCompleteBookingAt,
  type AdminBookingActionValue,
} from "@/features/booking/domain/booking-status-transition";
import {
  CLIENT_PHONE_FORMAT_MESSAGE,
  createManualBooking,
  isValidClientPhoneInput,
  normalizeClientPhone,
  PublicBookingError,
} from "@/features/booking/lib/booking-public";
import {
  bookingRescheduleErrorCodes,
  BookingRescheduleError,
  rescheduleBooking,
} from "@/features/booking/lib/booking-rescheduling";
import { resolvePragueLocalDateTime } from "@/features/booking/lib/booking-local-time";
import {
  redeemVoucherForBooking,
  redeemVoucherForBookingInTransaction,
  VoucherRedemptionError,
  voucherRedemptionErrorCodes,
} from "@/features/vouchers/lib/voucher-redemption";
import { normalizeVoucherCode } from "@/features/vouchers/lib/voucher-code";
import { getBookingPaymentSummary } from "@/features/booking/payments/lib/booking-payment-summary";
import { createDirectBookingPayment } from "@/features/booking/payments/lib/booking-payment";
import { requireAdminArea, requireRole } from "@/lib/auth/session";
import { sendOwnerSystemErrorPushover } from "@/lib/notifications/pushover";
import { prisma } from "@/lib/prisma";
import { runSerializableTransaction } from "@/lib/serializable-transaction";

import {
  getVoucherRedemptionFormError,
  getVoucherRedemptionSuccessMessage,
  readFormString,
  revalidateBookingAdminPaths,
  revalidateManualBookingPaths,
  resolveActionArea,
  resolveBookingActorUserId,
  resolveManualStartsAt,
  resolveVoucherRedemptionActorUserId,
} from "./shared";

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

  const session = await requireRole([AdminRole.OWNER, AdminRole.SALON]);
  const area = resolveActionArea(session.role, parsed.data.area as AdminArea);
  const actorUserId = await resolveVoucherRedemptionActorUserId(session.email);

  let redeemedVoucherId: string | null = null;
  let redeemedAmountCzk: number | null = null;

  try {
    const result = await redeemVoucherForBooking({
      bookingId: parsed.data.bookingId,
      voucherCode: parsed.data.voucherCode,
      amountCzk: parsed.data.amountCzk,
      redeemedByUserId: actorUserId,
      note: parsed.data.note || undefined,
    });

    redeemedVoucherId = result.voucher.id;
    redeemedAmountCzk = result.redemption.amountCzk;
  } catch (error) {
    if (error instanceof VoucherRedemptionError) {
      return {
        status: "error",
        formError: getVoucherRedemptionFormError(error),
        fieldErrors:
          error.code === voucherRedemptionErrorCodes.amountRequired ||
          error.code === voucherRedemptionErrorCodes.insufficientRemainingValue ||
          error.code === voucherRedemptionErrorCodes.bookingAlreadyRedeemed
            ? { amountCzk: getVoucherRedemptionFormError(error) }
            : error.code === voucherRedemptionErrorCodes.voucherNotFound
              ? { voucherCode: getVoucherRedemptionFormError(error) }
              : undefined,
      };
    }

    console.error("Failed to redeem voucher for booking", error);

    await sendOwnerSystemErrorPushover({
      title: "PP Studio - systemova chyba",
      message: "Uplatneni voucheru na rezervaci selhalo neocekavanou chybou.",
      context: {
        contextId: parsed.data.bookingId,
        bookingId: parsed.data.bookingId,
      },
      error,
    });

    return {
      status: "error",
      formError: "Voucher se teď nepodařilo uplatnit. Zkuste to prosím znovu.",
    };
  }

  revalidateBookingAdminPaths(parsed.data.bookingId);
  revalidatePath("/admin/vouchery");
  revalidatePath("/admin/provoz/vouchery");

  if (redeemedVoucherId) {
    revalidatePath(`/admin/vouchery/${redeemedVoucherId}`);
    revalidatePath(`/admin/provoz/vouchery/${redeemedVoucherId}`);
  }

  return {
    status: "success",
    successMessage: getVoucherRedemptionSuccessMessage(
      area,
      parsed.data.amountCzk,
      redeemedAmountCzk,
    ),
  };
}

