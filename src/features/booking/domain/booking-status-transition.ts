import { BookingStatus } from "@/generated/prisma/client";

export type AdminBookingActionValue =
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export const allowedTransitions: Record<BookingStatus, AdminBookingActionValue[]> = {
  [BookingStatus.PENDING]: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
  [BookingStatus.CONFIRMED]: [
    BookingStatus.COMPLETED,
    BookingStatus.CANCELLED,
    BookingStatus.NO_SHOW,
  ],
  [BookingStatus.CANCELLED]: [],
  [BookingStatus.COMPLETED]: [],
  [BookingStatus.NO_SHOW]: [],
};

export function canCompleteBookingAt(scheduledEndsAt: Date, now = new Date()) {
  return scheduledEndsAt.getTime() <= now.getTime();
}

export function canApplyAdminBookingTransition(
  currentStatus: BookingStatus,
  targetStatus: AdminBookingActionValue,
) {
  return allowedTransitions[currentStatus].includes(targetStatus);
}
