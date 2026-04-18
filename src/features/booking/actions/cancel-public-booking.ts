"use server";

import { cancelPublicBookingByToken } from "@/features/booking/lib/booking-cancellation";

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

export type CancelPublicBookingActionState = {
  status: "idle" | "success" | "error";
  formError?: string;
  result?: {
    referenceCode: string;
    serviceName: string;
    clientName: string;
    scheduledAtLabel: string;
    emailDeliveryStatus: "sent" | "failed" | "skipped";
  };
};

export const initialCancelPublicBookingActionState: CancelPublicBookingActionState = {
  status: "idle",
};

export async function cancelPublicBookingAction(
  _previousState: CancelPublicBookingActionState,
  formData: FormData,
): Promise<CancelPublicBookingActionState> {
  const token = readFormString(formData, "token").trim();

  if (!token) {
    return {
      status: "error",
      formError: "Storno odkaz je neplatný.",
    };
  }

  const result = await cancelPublicBookingByToken(token);

  if (result.status !== "cancelled") {
    return {
      status: "error",
      formError: result.message,
    };
  }

  return {
    status: "success",
    result,
  };
}
