import {
  BookingAcquisitionSource,
  BookingSource,
  BookingStatus,
} from "@/generated/prisma/client";

import { type AdminArea } from "@/config/navigation";
import {
  allowedTransitions,
  canCompleteBookingAt,
  canMarkBookingNoShowAt,
  type AdminBookingActionValue,
} from "@/features/booking/domain/booking-status-transition";
import { type BookingPaymentStatus, BOOKING_PAYMENT_STATUS_LABELS } from "@/features/booking/payments/lib/booking-payment-summary";

const formatDateTime = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Prague",
});

export type AdminBookingActionOption = {
  value: AdminBookingActionValue;
  label: string;
  description: string;
};

export type AdminBookingPaymentStatus = BookingPaymentStatus;

type AdminBookingActionContext = {
  scheduledStartsAt?: Date | null;
  scheduledEndsAt?: Date | null;
  now?: Date;
};

export function getAdminBookingHref(area: AdminArea, bookingId: string) {
  return area === "owner"
    ? `/admin/rezervace/${bookingId}`
    : `/admin/provoz/rezervace/${bookingId}`;
}

export function getBookingSourceLabel(source: BookingSource): string {
  switch (source) {
    case BookingSource.WEB:
      return "Web";
    case BookingSource.PHONE:
      return "Telefon";
    case BookingSource.INSTAGRAM:
      return "Instagram";
    case BookingSource.IN_PERSON:
      return "Osobně";
    case BookingSource.OTHER:
      return "Jiný původ";
  }

  return String(source);
}

export function getBookingAcquisitionLabel(source: BookingAcquisitionSource | null): string | null {
  if (!source) {
    return null;
  }

  switch (source) {
    case "DIRECT":
      return "Direct / bez kampaně";
    case "FACEBOOK":
      return "Facebook";
    case "GOOGLE":
      return "Google";
    case "INSTAGRAM":
      return "Instagram";
    case "FIRMY_CZ":
      return "Firmy.cz / Seznam";
    case "OTHER":
      return "Jiný akviziční zdroj";
  }

  return String(source);
}

export function getAdminBookingActionOptions(
  status: BookingStatus,
  context: AdminBookingActionContext = {},
): AdminBookingActionOption[] {
  const now = context.now ?? new Date();

  return allowedTransitions[status].filter((value) => {
    if (value === BookingStatus.COMPLETED && context.scheduledEndsAt) {
      return canCompleteBookingAt(context.scheduledEndsAt, now);
    }

    if (value === BookingStatus.NO_SHOW && context.scheduledStartsAt) {
      return canMarkBookingNoShowAt(context.scheduledStartsAt, now);
    }

    return true;
  }).map((value) => {
    switch (value) {
      case BookingStatus.CONFIRMED:
        return { value, label: "Potvrdit rezervaci", description: "Přesune rezervaci mezi potvrzené termíny." };
      case BookingStatus.COMPLETED:
        return { value, label: "Označit jako hotové", description: "Uzavře rezervaci jako hotovou." };
      case BookingStatus.CANCELLED:
        return { value, label: "Zrušit rezervaci", description: "Uvolní termín a přesune rezervaci mezi zrušené." };
      case BookingStatus.NO_SHOW:
        return { value, label: "Označit jako nedorazila", description: "Uzavře rezervaci jako nedorazila." };
      default:
        return { value, label: value, description: "" };
    }
  });
}

export function formatDateTimeLabel(value: Date | null | undefined) {
  if (!value) {
    return "Bez času";
  }

  return formatDateTime.format(value);
}

export function formatTimeLabel(value: Date | null | undefined) {
  if (!value) {
    return "Bez času";
  }

  return new Intl.DateTimeFormat("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Prague",
  }).format(value);
}

export function buildBookingCleanupMetadata(input: {
  cleanupBlockMinutes?: number | null;
  blockedUntil?: Date | null;
  scheduledEndsAt: Date;
}) {
  const cleanupBlockMinutes = Math.max(0, input.cleanupBlockMinutes ?? 0);
  const blockedUntil = input.blockedUntil ?? input.scheduledEndsAt;

  return {
    cleanupBlockMinutes,
    cleanupLabel: cleanupBlockMinutes > 0 ? `${cleanupBlockMinutes} min` : "Bez úklidové blokace",
    blockedUntilLabel: formatTimeLabel(blockedUntil),
  };
}

export function formatAdminBookingDateLabel(startsAt: Date, endsAt: Date) {
  return `${formatDateTimeLabel(startsAt)} - ${formatTimeLabel(endsAt)}`;
}

export function getAdminBookingPaymentStatusLabel(status: AdminBookingPaymentStatus): string {
  return BOOKING_PAYMENT_STATUS_LABELS[status];
}
