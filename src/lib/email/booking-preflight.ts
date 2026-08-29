import {
  BookingStatus,
  EmailAudience,
  EmailLogType,
} from "@/generated/prisma/browser";

export type BookingEmailPreflightBooking = {
  status: BookingStatus;
  scheduledStartsAt: Date;
  scheduledEndsAt: Date;
};

export type BookingEmailPreflightResult = {
  shouldSend: boolean;
  reason?: string;
};

function readPayloadString(payload: unknown, key: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const value = key in payload ? payload[key as keyof typeof payload] : null;
  return typeof value === "string" ? value : null;
}

function matchesScheduledTime(payload: unknown, booking: BookingEmailPreflightBooking) {
  return (
    readPayloadString(payload, "scheduledStartsAt") === booking.scheduledStartsAt.toISOString()
    && readPayloadString(payload, "scheduledEndsAt") === booking.scheduledEndsAt.toISOString()
  );
}

function isClientBookingTemplate(templateKey: string) {
  return [
    "booking-confirmation-v1",
    "booking-approved-v1",
    "booking-rejected-v1",
    "booking-cancelled-v1",
    "booking-rescheduled-v1",
  ].includes(templateKey);
}

function isBookingPreflightType(type: EmailLogType) {
  return (
    type === EmailLogType.BOOKING_RECEIVED
    || type === EmailLogType.BOOKING_CONFIRMED
    || type === EmailLogType.BOOKING_CANCELLED
    || type === EmailLogType.BOOKING_RESCHEDULED
  );
}

/**
 * Ověří, že klientský booking e-mail ještě popisuje aktuální rezervaci.
 * Admin provozní zprávy jsou záměrně historické události a tuto kontrolu
 * nepoužívají.
 */
export function evaluateBookingEmailPreflight({
  type,
  audience,
  templateKey,
  payload,
  booking,
}: {
  type: EmailLogType;
  audience: EmailAudience;
  templateKey: string;
  payload: unknown;
  booking: BookingEmailPreflightBooking | null;
}): BookingEmailPreflightResult {
  if (
    audience !== EmailAudience.CLIENT
    || type === EmailLogType.BOOKING_REMINDER
    || (!isClientBookingTemplate(templateKey) && !isBookingPreflightType(type))
  ) {
    return { shouldSend: true };
  }

  if (!booking) {
    return {
      shouldSend: false,
      reason: "Booking no longer exists.",
    };
  }

  if (templateKey === "booking-approved-v1" || type === EmailLogType.BOOKING_CONFIRMED) {
    if (booking.status !== BookingStatus.CONFIRMED) {
      return {
        shouldSend: false,
        reason: "Booking is no longer confirmed.",
      };
    }

    if (!matchesScheduledTime(payload, booking)) {
      return {
        shouldSend: false,
        reason: "Booking term no longer matches the confirmation email.",
      };
    }
  }

  if (templateKey === "booking-confirmation-v1" || type === EmailLogType.BOOKING_RECEIVED) {
    if (booking.status !== BookingStatus.PENDING) {
      return {
        shouldSend: false,
        reason: "Booking is no longer pending for the received-booking email.",
      };
    }

    if (!matchesScheduledTime(payload, booking)) {
      return {
        shouldSend: false,
        reason: "Booking term no longer matches the received-booking email.",
      };
    }
  }

  if (templateKey === "booking-rescheduled-v1" || type === EmailLogType.BOOKING_RESCHEDULED) {
    if (
      booking.status !== BookingStatus.PENDING
      && booking.status !== BookingStatus.CONFIRMED
    ) {
      return {
        shouldSend: false,
        reason: "Booking is no longer active for the reschedule email.",
      };
    }

    if (!matchesScheduledTime(payload, booking)) {
      return {
        shouldSend: false,
        reason: "Booking term no longer matches the reschedule email.",
      };
    }
  }

  if (
    templateKey === "booking-rejected-v1"
    || templateKey === "booking-cancelled-v1"
    || type === EmailLogType.BOOKING_CANCELLED
  ) {
    if (booking.status !== BookingStatus.CANCELLED) {
      return {
        shouldSend: false,
        reason: "Booking is no longer cancelled.",
      };
    }
  }

  return { shouldSend: true };
}
