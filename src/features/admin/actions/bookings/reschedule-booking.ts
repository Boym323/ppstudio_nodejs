"use server";



import { z } from "zod";

import { type AdminArea } from "@/config/navigation";




import { type RescheduleBookingActionState } from "@/features/admin/actions/reschedule-booking-action-state";




import {




} from "@/features/admin/lib/admin-booking";
import {


} from "@/features/admin/lib/booking/booking-display";
import {



} from "@/features/booking/domain/booking-status-transition";
import {





} from "@/features/booking/lib/booking-public";
import {
  bookingRescheduleErrorCodes,
  BookingRescheduleError,
  rescheduleBooking,
} from "@/features/booking/lib/booking-rescheduling";

import {




} from "@/features/vouchers/lib/voucher-redemption";




import { sendOwnerSystemErrorPushover } from "@/lib/notifications/pushover";



import {


  readFormString,
  revalidateBookingAdminPaths,


  resolveBookingActorUserId,
  resolveManualStartsAt,

} from "./shared";

const rescheduleBookingSchema = z.object({
  area: z.enum(["owner", "salon"]),
  bookingId: z.string().trim().min(1).max(64),
  selectionMode: z.enum(["slot", "manual"]),
  slotId: z.string().trim().max(64).optional().or(z.literal("")),
  startsAt: z.string().trim().optional().or(z.literal("")),
  manualDate: z.string().trim().optional().or(z.literal("")),
  manualTime: z.string().trim().optional().or(z.literal("")),
  expectedUpdatedAt: z.string().trim().min(1).max(64),
  reason: z.string().trim().max(300, "Důvod změny je příliš dlouhý.").optional().or(z.literal("")),
  notifyClient: z.enum(["0", "1"]).optional().default("1"),
  includeCalendarAttachment: z.enum(["0", "1"]).optional().default("1"),
});


export async function rescheduleBookingAction(
  _previousState: RescheduleBookingActionState,
  formData: FormData,
): Promise<RescheduleBookingActionState> {
  const parsed = rescheduleBookingSchema.safeParse({
    area: readFormString(formData, "area"),
    bookingId: readFormString(formData, "bookingId"),
    selectionMode: readFormString(formData, "selectionMode"),
    slotId: readFormString(formData, "slotId"),
    startsAt: readFormString(formData, "startsAt"),
    manualDate: readFormString(formData, "manualDate"),
    manualTime: readFormString(formData, "manualTime"),
    expectedUpdatedAt: readFormString(formData, "expectedUpdatedAt"),
    reason: readFormString(formData, "reason"),
    notifyClient: readFormString(formData, "notifyClient") || "1",
    includeCalendarAttachment: readFormString(formData, "includeCalendarAttachment") || "1",
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      formError: "Formulář potřebuje doplnit nebo opravit.",
      fieldErrors: {
        slotId: fieldErrors.slotId?.[0],
        manualDate: fieldErrors.manualDate?.[0],
        manualTime: fieldErrors.manualTime?.[0],
        reason: fieldErrors.reason?.[0],
      },
    };
  }

  const startsAt =
    parsed.data.selectionMode === "slot"
      ? parsed.data.startsAt
      : resolveManualStartsAt(parsed.data.manualDate || "", parsed.data.manualTime || "")?.toISOString() ?? "";

  if (!startsAt) {
    return {
      status: "error",
      formError:
        parsed.data.selectionMode === "slot"
          ? "Vyberte konkrétní nový slot."
          : "Vyplňte nové datum a čas rezervace.",
      fieldErrors:
        parsed.data.selectionMode === "slot"
          ? {
              slotId: "Vyberte konkrétní nový slot.",
            }
          : {
              manualDate: !parsed.data.manualDate ? "Vyberte datum." : undefined,
              manualTime: !parsed.data.manualTime ? "Vyberte čas." : undefined,
            },
    };
  }

  const area = parsed.data.area as AdminArea;
  const actorUserId = await resolveBookingActorUserId(area);

  try {
    const result = await rescheduleBooking({
      bookingId: parsed.data.bookingId,
      slotId: parsed.data.selectionMode === "slot" ? parsed.data.slotId || undefined : undefined,
      allowManualOverride: parsed.data.selectionMode === "manual",
      newStartAt: startsAt,
      reason: parsed.data.reason || null,
      changedByUserId: actorUserId,
      notifyClient: parsed.data.notifyClient === "1",
      includeCalendarAttachment: parsed.data.includeCalendarAttachment === "1",
      expectedUpdatedAt: parsed.data.expectedUpdatedAt,
    });

    revalidateBookingAdminPaths(parsed.data.bookingId);

    return {
      status: "success",
      successMessage: `Termín jsme přesunuli z „${result.previousScheduledAtLabel}“ na „${result.scheduledAtLabel}“.`,
      warningMessage: [
        result.notificationStatus === "skipped" && parsed.data.notifyClient === "1"
          ? "Termín je přesunutý, ale klientce jsme neposílali e-mail, protože u rezervace chybí použitelný e-mail."
          : null,
        result.manualOverride
          ? "Nový termín nebyl ve veřejné dostupnosti, takže jsme ho uložili jako interní výjimku."
          : null,
      ].filter(Boolean).join(" ") || undefined,
    };
  } catch (error) {
    if (error instanceof BookingRescheduleError) {
      return {
        status: "error",
        formError: error.message,
        fieldErrors:
          error.code === bookingRescheduleErrorCodes.slotUnavailable
          || error.code === bookingRescheduleErrorCodes.slotNotAllowed
          || error.code === bookingRescheduleErrorCodes.slotTooShort
          || error.code === bookingRescheduleErrorCodes.conflict
            ? parsed.data.selectionMode === "slot"
              ? {
                  slotId: error.message,
                }
              : {
                  manualDate: error.message,
                  manualTime: error.message,
                }
            : error.code === bookingRescheduleErrorCodes.sameTerm
              || error.code === bookingRescheduleErrorCodes.invalidDateTime
                ? {
                    manualDate: parsed.data.selectionMode === "manual" ? error.message : undefined,
                    manualTime: error.message,
                  }
                : undefined,
      };
    }

    console.error("Failed to reschedule booking", error);

    await sendOwnerSystemErrorPushover({
      title: "PP Studio - systemova chyba",
      message: "Admin presun rezervace selhal neocekavanou chybou.",
      context: {
        contextId: parsed.data.bookingId,
        bookingId: parsed.data.bookingId,
      },
      error,
    });

    return {
      status: "error",
      formError: "Přesun termínu se teď nepodařilo uložit. Zkuste to prosím znovu.",
    };
  }
}
