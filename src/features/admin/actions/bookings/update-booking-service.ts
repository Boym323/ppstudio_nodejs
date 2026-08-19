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

const updateBookingServiceSchema = z.object({
  area: z.enum(["owner", "salon"]),
  bookingId: z.string().trim().min(1).max(64),
  serviceId: z.string().trim().min(1, "Vyberte novou službu.").max(64),
  expectedUpdatedAt: z.string().trim().min(1).max(64),
  reason: z.string().trim().max(300, "Důvod změny je příliš dlouhý.").optional().or(z.literal("")),
});


export async function updateBookingServiceAction(
  _previousState: UpdateBookingServiceActionState,
  formData: FormData,
): Promise<UpdateBookingServiceActionState> {
  const parsed = updateBookingServiceSchema.safeParse({
    area: readFormString(formData, "area"),
    bookingId: readFormString(formData, "bookingId"),
    serviceId: readFormString(formData, "serviceId"),
    expectedUpdatedAt: readFormString(formData, "expectedUpdatedAt"),
    reason: readFormString(formData, "reason"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      formError: "Změnu služby je potřeba doplnit nebo opravit.",
      fieldErrors: {
        serviceId: fieldErrors.serviceId?.[0],
        reason: fieldErrors.reason?.[0],
      },
    };
  }

  const area = parsed.data.area as AdminArea;
  const actorUserId = await resolveBookingActorUserId(area);
  const result = await updateAdminBookingService({
    bookingId: parsed.data.bookingId,
    serviceId: parsed.data.serviceId,
    actorUserId,
    expectedUpdatedAt: parsed.data.expectedUpdatedAt,
    reason: parsed.data.reason || null,
  });

  if (result.status === "not-found") {
    return {
      status: "error",
      formError: "Rezervaci se nepodařilo najít.",
    };
  }

  if (result.status === "status-not-allowed") {
    return {
      status: "error",
      formError: `Službu lze měnit jen u čekajících a potvrzených rezervací. Aktuální stav je „${getBookingStatusLabel(result.currentStatus)}“.`,
    };
  }

  if (result.status === "concurrent-modification") {
    return {
      status: "error",
      formError: "Rezervace se mezitím změnila v jiném okně. Obnovte detail a zkuste to znovu.",
    };
  }

  if (result.status === "same-service") {
    return {
      status: "error",
      formError: "Vybraná služba je stejná jako ta aktuální.",
      fieldErrors: {
        serviceId: "Vyberte jinou službu.",
      },
    };
  }

  if (result.status === "service-not-found") {
    return {
      status: "error",
      formError: "Vybranou službu se nepodařilo načíst. Zkuste detail obnovit.",
      fieldErrors: {
        serviceId: "Vybraná služba už není dostupná.",
      },
    };
  }

  if (result.status === "voucher-conflict") {
    return {
      status: "error",
      formError: result.message,
    };
  }

  if (result.status === "slot-too-short") {
    return {
      status: "error",
      formError: "Nová služba se do stávajícího termínu nevejde nebo pro ni slot není povolený. Nejprve upravte termín rezervace.",
      fieldErrors: {
        serviceId: "Vybraná služba vyžaduje jiný termín nebo jiný povolený slot.",
      },
    };
  }

  if (result.status === "conflict") {
    return {
      status: "error",
      formError: "Po změně služby by termín kolidoval s jinou aktivní rezervací.",
      fieldErrors: {
        serviceId: "Vybraná služba se v tomto čase nevejde kvůli kolizi.",
      },
    };
  }

  revalidateBookingAdminPaths(parsed.data.bookingId);
  revalidatePath(`/admin/klienti/${result.clientId}`);
  revalidatePath(`/admin/provoz/klienti/${result.clientId}`);

  const durationChanged = result.previousScheduledEndsAt.getTime() !== result.nextScheduledEndsAt.getTime();
  const cleanupChanged = result.previousCleanupBlockMinutes !== result.nextCleanupBlockMinutes;
  const keptPriceNotice = result.keptFinalPriceCzk !== null
    ? " Individuální finální cena rezervace zůstala beze změny."
    : "";

  return {
    status: "success",
    successMessage:
      `Služba byla změněná z „${result.previousServiceName}“ na „${result.nextServiceName}“.`
      + `${durationChanged || cleanupChanged ? " Termín rezervace byl přepočítaný podle nové délky služby." : ""}`
      + keptPriceNotice,
  };
}

