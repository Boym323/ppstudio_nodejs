"use server";

import { revalidatePath } from "next/cache";

import { type ManagePublicBookingActionState } from "@/features/booking/actions/manage-public-booking-action-state";
import {
  bookingRescheduleErrorCodes,
  BookingRescheduleError,
} from "@/features/booking/lib/booking-rescheduling";
import { reschedulePublicBookingByToken } from "@/features/booking/lib/booking-management";

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function revalidateBookingPaths(bookingId: string, token: string) {
  revalidatePath(`/rezervace/sprava/${token}`);
  revalidatePath("/admin");
  revalidatePath("/admin/rezervace");
  revalidatePath(`/admin/rezervace/${bookingId}`);
  revalidatePath("/admin/provoz");
  revalidatePath("/admin/provoz/rezervace");
  revalidatePath(`/admin/provoz/rezervace/${bookingId}`);
}

export async function managePublicBookingAction(
  _previousState: ManagePublicBookingActionState,
  formData: FormData,
): Promise<ManagePublicBookingActionState> {
  const token = readFormString(formData, "token").trim();
  const slotId = readFormString(formData, "slotId").trim();
  const newStartAt = readFormString(formData, "newStartAt").trim();
  const expectedUpdatedAt = readFormString(formData, "expectedUpdatedAt").trim();

  if (!token) {
    return {
      status: "error",
      formError: "Odkaz pro správu rezervace je neplatný.",
    };
  }

  if (!slotId || !newStartAt) {
    return {
      status: "error",
      formError: "Vyberte prosím nový termín a potvrďte změnu.",
      fieldErrors: {
        slotId: "Vyberte prosím nový termín.",
      },
    };
  }

  if (!expectedUpdatedAt) {
    return {
      status: "error",
      formError: "Rezervace se mezitím změnila. Obnovte prosím stránku.",
    };
  }

  try {
    const result = await reschedulePublicBookingByToken({
      token,
      slotId,
      newStartAt,
      expectedUpdatedAt,
    });

    if (result.status !== "rescheduled") {
      return {
        status: "error",
        formError: result.message,
      };
    }

    revalidateBookingPaths(result.bookingId, token);

    return {
      status: "success",
      result,
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
          || error.code === bookingRescheduleErrorCodes.sameTerm
            ? {
                slotId: error.message,
              }
            : undefined,
      };
    }

    console.error("Failed to reschedule booking via self-service flow", error);

    return {
      status: "error",
      formError: "Změnu termínu se teď nepodařilo uložit. Zkuste to prosím znovu.",
    };
  }
}
