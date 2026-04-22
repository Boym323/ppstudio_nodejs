import type { PerformBookingEmailActionResult } from "@/features/booking/lib/booking-email-actions";
import type { BookingEmailActionIntent } from "@/features/booking/lib/booking-action-tokens";

export type BookingEmailActionActionState = {
  status: "idle" | "success" | "error";
  formError?: string;
  result?: PerformBookingEmailActionResult;
  intent?: BookingEmailActionIntent;
};

export const initialBookingEmailActionActionState: BookingEmailActionActionState = {
  status: "idle",
};
