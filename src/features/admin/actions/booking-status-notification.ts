import { BookingStatus } from "@prisma/client";

import { sendOwnerBookingPushover } from "@/lib/notifications/pushover";

export function dispatchBookingStatusNotificationNonBlocking(input: {
  type: "BOOKING_CONFIRMED" | "BOOKING_CANCELLED";
  bookingId: string;
  sourceLabel?: string;
}, dispatcher: typeof sendOwnerBookingPushover = sendOwnerBookingPushover) {
  void dispatcher(input).catch((error) => {
    console.error("Owner booking Pushover dispatch failed in updateBookingStatusAction", {
      bookingId: input.bookingId,
      targetStatus: input.type === "BOOKING_CONFIRMED" ? BookingStatus.CONFIRMED : BookingStatus.CANCELLED,
      error,
    });
  });
}
