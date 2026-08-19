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

const updateBookingNoteSchema = z.object({
  area: z.enum(["owner", "salon"]),
  bookingId: z.string().trim().min(1).max(64),
  internalNote: z.string().trim().max(1000, "Interní poznámka je příliš dlouhá."),
});


export async function updateBookingNoteAction(
  _previousState: UpdateBookingNoteActionState,
  formData: FormData,
): Promise<UpdateBookingNoteActionState> {
  const parsed = updateBookingNoteSchema.safeParse({
    area: readFormString(formData, "area"),
    bookingId: readFormString(formData, "bookingId"),
    internalNote: readFormString(formData, "internalNote"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      formError: "Poznámku se nepodařilo uložit.",
      fieldErrors: {
        internalNote: fieldErrors.internalNote?.[0],
      },
    };
  }

  const area = parsed.data.area as AdminArea;
  const actorUserId = await resolveBookingActorUserId(area);
  const result = await updateAdminBookingInternalNote({
    bookingId: parsed.data.bookingId,
    actorUserId,
    internalNote: parsed.data.internalNote || null,
  });

  if (result.status === "not-found") {
    return {
      status: "error",
      formError: "Rezervaci se nepodařilo najít.",
    };
  }

  revalidateBookingAdminPaths(parsed.data.bookingId);

  return {
    status: "success",
    successMessage: parsed.data.internalNote
      ? "Interní poznámka je uložená."
      : "Interní poznámka byla odstraněná.",
  };
}

