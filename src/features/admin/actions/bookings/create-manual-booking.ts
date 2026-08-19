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

const createManualBookingSchema = z.object({
  area: z.enum(["owner", "salon"]),
  selectionMode: z.enum(["slot", "manual"]),
  selectedClientId: z.string().trim().max(64).optional().or(z.literal("")),
  serviceId: z.string().trim().min(1, "Vyberte službu.").max(64),
  slotId: z.string().trim().max(64).optional().or(z.literal("")),
  startsAt: z.string().trim().optional().or(z.literal("")),
  manualDate: z.string().trim().optional().or(z.literal("")),
  manualTime: z.string().trim().optional().or(z.literal("")),
  fullName: z
    .string()
    .trim()
    .min(3, "Zadejte jméno a příjmení klientky.")
    .max(120, "Jméno je příliš dlouhé."),
  email: z
    .string()
    .trim()
    .max(254, "E-mail je příliš dlouhý.")
    .refine((value) => value.length === 0 || z.email().safeParse(value).success, {
      message: "Zadejte platný e-mail.",
    }),
  phone: z
    .string()
    .trim()
    .max(32, "Telefon je příliš dlouhý.")
    .refine((value) => isValidClientPhoneInput(value), {
      message: CLIENT_PHONE_FORMAT_MESSAGE,
    })
    .optional()
    .or(z.literal("")),
  clientProfileNote: z.string().trim().max(500, "Poznámka ke klientce je příliš dlouhá.").optional().or(z.literal("")),
  clientNote: z.string().trim().max(600, "Poznámka pro rezervaci je příliš dlouhá.").optional().or(z.literal("")),
  internalNote: z.string().trim().max(1000, "Interní poznámka je příliš dlouhá.").optional().or(z.literal("")),
  source: z.nativeEnum(BookingSource),
  bookingStatus: z
    .string()
    .trim()
    .refine(
      (value): value is "PENDING" | "CONFIRMED" =>
        value === BookingStatus.PENDING || value === BookingStatus.CONFIRMED,
      "Vyberte stav rezervace.",
    ),
  includeCalendarAttachment: z.enum(["0", "1"]).optional().default("0"),
  submitMode: z.enum(["create", "create-and-send"]),
});


export async function createManualBookingAction(
  _previousState: CreateManualBookingActionState,
  formData: FormData,
): Promise<CreateManualBookingActionState> {
  const parsed = createManualBookingSchema.safeParse({
    area: readFormString(formData, "area"),
    selectionMode: readFormString(formData, "selectionMode"),
    selectedClientId: readFormString(formData, "selectedClientId"),
    serviceId: readFormString(formData, "serviceId"),
    slotId: readFormString(formData, "slotId"),
    startsAt: readFormString(formData, "startsAt"),
    manualDate: readFormString(formData, "manualDate"),
    manualTime: readFormString(formData, "manualTime"),
    fullName: readFormString(formData, "fullName"),
    email: readFormString(formData, "email"),
    phone: readFormString(formData, "phone"),
    clientProfileNote: readFormString(formData, "clientProfileNote"),
    clientNote: readFormString(formData, "clientNote"),
    internalNote: readFormString(formData, "internalNote"),
    source: readFormString(formData, "source"),
    bookingStatus: readFormString(formData, "bookingStatus"),
    includeCalendarAttachment: readFormString(formData, "includeCalendarAttachment") || "0",
    submitMode: readFormString(formData, "submitMode"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      formError: "Formulář potřebuje doplnit nebo opravit.",
      fieldErrors: {
        serviceId: fieldErrors.serviceId?.[0],
        slotId: fieldErrors.slotId?.[0],
        manualDate: fieldErrors.manualDate?.[0],
        manualTime: fieldErrors.manualTime?.[0],
        fullName: fieldErrors.fullName?.[0],
        email: fieldErrors.email?.[0],
        phone: fieldErrors.phone?.[0],
        source: fieldErrors.source?.[0],
        bookingStatus: fieldErrors.bookingStatus?.[0],
      },
    };
  }

  const area = parsed.data.area as AdminArea;
  const actorUserId = await resolveBookingActorUserId(area);
  const startsAt =
    parsed.data.selectionMode === "slot"
      ? parsed.data.startsAt
      : resolveManualStartsAt(parsed.data.manualDate || "", parsed.data.manualTime || "")?.toISOString() ?? "";

  if (!startsAt) {
    return {
      status: "error",
      formError:
        parsed.data.selectionMode === "slot"
          ? "Vyberte konkrétní slot z dostupných termínů."
          : "Vyplňte datum a čas začátku rezervace.",
      fieldErrors:
        parsed.data.selectionMode === "slot"
          ? {
              slotId: "Vyberte konkrétní slot z dostupných termínů.",
            }
          : {
              manualDate: !parsed.data.manualDate ? "Vyberte datum." : undefined,
              manualTime: !parsed.data.manualTime ? "Vyberte čas." : undefined,
            },
    };
  }

  try {
    const result = await createManualBooking({
      serviceId: parsed.data.serviceId,
      slotId: parsed.data.selectionMode === "slot" ? parsed.data.slotId || undefined : undefined,
      allowManualOverride: parsed.data.selectionMode === "manual",
      startsAt,
      selectedClientId: parsed.data.selectedClientId || undefined,
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      phone: normalizeClientPhone(parsed.data.phone || undefined),
      clientProfileNote: parsed.data.clientProfileNote || undefined,
      clientNote: parsed.data.clientNote || undefined,
      internalNote: parsed.data.internalNote || undefined,
      source: parsed.data.source,
      status: parsed.data.bookingStatus as "PENDING" | "CONFIRMED",
      actorUserId,
      sendClientEmail: parsed.data.submitMode === "create-and-send",
      includeCalendarAttachment:
        parsed.data.submitMode === "create-and-send"
        && parsed.data.includeCalendarAttachment === "1",
      deliverEmailImmediately: parsed.data.submitMode === "create-and-send",
    });
    const booking = await prisma.booking.findUnique({
      where: {
        id: result.bookingId,
      },
      select: {
        clientId: true,
      },
    });

    revalidateManualBookingPaths(result.bookingId, booking?.clientId);

    return {
      status: "success",
      createdBookingId: result.bookingId,
      successMessage:
        parsed.data.submitMode === "create-and-send"
          ? result.emailDeliveryStatus === "skipped"
            ? "Rezervace je vytvořená, ale potvrzovací e-mail jsme přeskočili, protože u klientky chybí e-mail."
            : "Rezervace je vytvořená a navazující potvrzení se propsalo do emailového flow."
          : "Rezervace je vytvořená bez odbočení mimo hlavní booking engine.",
      manualOverrideWarning: result.manualOverride
        ? "Termín nebyl ve veřejné dostupnosti, takže rezervace byla uložená jako interní výjimka."
        : undefined,
    };
  } catch (error) {
    if (error instanceof PublicBookingError) {
      return {
        status: "error",
        formError: error.message,
        fieldErrors:
          error.suggestedStep === 2
            ? {
                slotId:
                  parsed.data.selectionMode === "slot"
                    ? error.message
                    : undefined,
                manualDate:
                  parsed.data.selectionMode === "manual"
                    ? error.message
                    : undefined,
                manualTime:
                  parsed.data.selectionMode === "manual"
                    ? error.message
                    : undefined,
              }
            : error.suggestedStep === 3
              ? {
                  email: error.message,
                  phone: error.message,
                }
              : undefined,
      };
    }

    console.error("Failed to create manual booking", error);

    await sendOwnerSystemErrorPushover({
      title: "PP Studio - systemova chyba",
      message: "Rucni vytvoreni rezervace v adminu selhalo neocekavanou chybou.",
      context: {
        contextId:
          (parsed.data.selectionMode === "slot" ? parsed.data.slotId : startsAt)
          || parsed.data.serviceId
          || "admin-manual-booking",
      },
      error,
    });

    return {
      status: "error",
      formError: "Rezervaci se teď nepodařilo vytvořit. Zkuste to prosím znovu.",
    };
  }
}

