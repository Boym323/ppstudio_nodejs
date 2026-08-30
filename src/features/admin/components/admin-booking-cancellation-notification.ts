import { type AdminBookingActionValue } from "@/features/booking/domain/booking-status-transition";

export const DEFAULT_ADMIN_BOOKING_NOTIFY_CLIENT = true;

export function shouldShowAdminBookingCancellationNotification(
  selectedAction: AdminBookingActionValue | "",
) {
  return selectedAction === "CANCELLED";
}

export function hasCurrentClientEmail(clientEmail: string) {
  return clientEmail.trim().length > 0;
}
