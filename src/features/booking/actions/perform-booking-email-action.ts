"use server";

import { headers } from "next/headers";

import { type BookingEmailActionActionState } from "@/features/booking/actions/booking-email-action-state";
import { type BookingEmailActionIntent } from "@/features/booking/lib/booking-action-tokens";
import { performBookingEmailAction } from "@/features/booking/lib/booking-email-actions";

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function isIntent(value: string): value is BookingEmailActionIntent {
  return value === "approve" || value === "reject";
}

export async function performBookingEmailActionAction(
  _previousState: BookingEmailActionActionState,
  formData: FormData,
): Promise<BookingEmailActionActionState> {
  const token = readFormString(formData, "token").trim();
  const intent = readFormString(formData, "intent").trim();

  if (!token || !isIntent(intent)) {
    return {
      status: "error",
      formError: "Akční odkaz je neplatný.",
    };
  }

  const requestHeaders = await headers();
  const ipAddress = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = requestHeaders.get("user-agent");
  const result = await performBookingEmailAction(intent, token, {
    ipAddress,
    userAgent,
  });

  if (result.status !== "completed") {
    return {
      status: "error",
      formError: result.message,
      result,
      intent,
    };
  }

  return {
    status: "success",
    result,
    intent,
  };
}
