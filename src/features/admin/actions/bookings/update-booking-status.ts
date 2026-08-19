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

const updateBookingStatusSchema = z.object({
  area: z.enum(["owner", "salon"]),
  bookingId: z.string().trim().min(1).max(64),
  targetStatus: z
    .string()
    .trim()
    .min(1, "Vyberte, co se má s rezervací stát.")
    .refine(
      (value): value is AdminBookingActionValue =>
        [
          BookingStatus.CONFIRMED,
          BookingStatus.COMPLETED,
          BookingStatus.CANCELLED,
          BookingStatus.NO_SHOW,
        ].includes(value as AdminBookingActionValue),
      "Vyberte platnou akci pro rezervaci.",
    ),
  reason: z.string().trim().max(160, "Důvod je příliš dlouhý.").optional().or(z.literal("")),
  internalNote: z
    .string()
    .trim()
    .max(1000, "Interní poznámka je příliš dlouhá.")
    .optional()
    .or(z.literal("")),
});


export async function updateBookingStatusAction(
  _previousState: UpdateBookingStatusActionState,
  formData: FormData,
): Promise<UpdateBookingStatusActionState> {
  const parsed = updateBookingStatusSchema.safeParse({
    area: readFormString(formData, "area"),
    bookingId: readFormString(formData, "bookingId"),
    targetStatus: readFormString(formData, "targetStatus"),
    reason: readFormString(formData, "reason"),
    internalNote: readFormString(formData, "internalNote"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      formError: "Formulář potřebuje doplnit nebo opravit.",
      fieldErrors: {
        targetStatus: fieldErrors.targetStatus?.[0],
        reason: fieldErrors.reason?.[0],
      },
    };
  }

  const area = parsed.data.area as AdminArea;
  const actorUserId = await resolveBookingActorUserId(area);
  const booking = await prisma.booking.findUnique({
    where: { id: parsed.data.bookingId },
    select: {
      id: true,
      status: true,
    },
  });

  if (!booking) {
    return {
      status: "error",
      formError: "Rezervaci se nepodařilo najít.",
    };
  }

  if (!canApplyAdminBookingTransition(booking.status, parsed.data.targetStatus)) {
    const availableActions = getAdminBookingActionOptions(booking.status);

    return {
      status: "error",
      formError:
        availableActions.length > 0
          ? `Z této rezervace teď můžeš udělat jen: ${availableActions
              .map((action) => action.label.toLowerCase())
              .join(", ")}.`
          : `Rezervace je ve stavu „${getBookingStatusLabel(booking.status)}“ a další změna už není dostupná.`,
    };
  }

  const result = await applyAdminBookingStatusChange({
    bookingId: parsed.data.bookingId,
    targetStatus: parsed.data.targetStatus as AdminBookingActionValue,
    actorUserId,
    reason: parsed.data.reason || undefined,
    internalNote: parsed.data.internalNote || undefined,
  });

  if (result.status === "not-found") {
    return {
      status: "error",
      formError: "Rezervaci se nepodařilo najít.",
    };
  }

  if (result.status === "invalid-transition") {
    return {
      status: "error",
      formError: `Rezervace už mezitím přešla do stavu „${getBookingStatusLabel(result.currentStatus)}“.`,
    };
  }

  if (result.status === "completion-too-early") {
    return {
      status: "error",
      formError: "Rezervaci lze označit jako hotovou až po skončení naplánovaného termínu.",
    };
  }

  if (
    parsed.data.targetStatus === BookingStatus.CONFIRMED
    || parsed.data.targetStatus === BookingStatus.CANCELLED
  ) {
    dispatchBookingStatusNotificationNonBlocking({
      type:
        parsed.data.targetStatus === BookingStatus.CONFIRMED
          ? "BOOKING_CONFIRMED"
          : "BOOKING_CANCELLED",
      bookingId: parsed.data.bookingId,
      sourceLabel: "Admin",
    });
  }

  revalidateBookingAdminPaths(parsed.data.bookingId);

  return {
    status: "success",
    successMessage: "Změna byla uložená a propsala se i do historie rezervace.",
  };
}

