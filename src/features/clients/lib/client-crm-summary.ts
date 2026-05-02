import { BookingStatus } from "@prisma/client";

import { getBookingPaymentSummary } from "@/features/bookings/lib/booking-payment-summary";

const ACTIVE_BOOKING_STATUSES = new Set<BookingStatus>([
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
]);

type ClientCrmSummaryPaymentItem = {
  amountCzk?: number | null;
};

export type ClientCrmSummaryBookingInput = {
  id: string;
  status: BookingStatus;
  serviceNameSnapshot: string;
  servicePriceFromCzk?: number | null;
  scheduledStartsAt: Date;
  scheduledEndsAt: Date;
  voucherRedemptions?: ClientCrmSummaryPaymentItem[];
  payments?: ClientCrmSummaryPaymentItem[];
};

export type ClientCrmSummaryVisit = {
  id: string;
  serviceName: string;
  scheduledStartsAt: Date;
  scheduledEndsAt: Date;
};

export type ClientCrmSummary = {
  lastVisit: ClientCrmSummaryVisit | null;
  nextVisit: ClientCrmSummaryVisit | null;
  servicesValueCzk: number;
  paidCzk: number;
  unpaidCzk: number;
  totalBookings: number;
  completedBookings: number;
  activeBookings: number;
  cancelledBookings: number;
  noShowBookings: number;
};

export function getClientCrmSummary(
  bookings: ClientCrmSummaryBookingInput[],
  options: { now?: Date } = {},
): ClientCrmSummary {
  const now = options.now ?? new Date();
  const sortedCompletedPastBookings = bookings
    .filter((booking) => booking.status === BookingStatus.COMPLETED && booking.scheduledStartsAt < now)
    .toSorted((a, b) => b.scheduledStartsAt.getTime() - a.scheduledStartsAt.getTime());
  const sortedFutureActiveBookings = bookings
    .filter((booking) => ACTIVE_BOOKING_STATUSES.has(booking.status) && booking.scheduledStartsAt >= now)
    .toSorted((a, b) => a.scheduledStartsAt.getTime() - b.scheduledStartsAt.getTime());

  const paymentTotals = bookings.reduce(
    (totals, booking) => {
      const paymentSummary = getBookingPaymentSummary({
        totalPriceCzk: booking.servicePriceFromCzk,
        voucherRedemptions: booking.voucherRedemptions,
        payments: booking.payments,
      });

      return {
        paidCzk: totals.paidCzk + paymentSummary.paidTotalCzk,
        unpaidCzk: totals.unpaidCzk + (isUnpaidRelevantBooking(booking, now) ? paymentSummary.remainingCzk : 0),
      };
    },
    { paidCzk: 0, unpaidCzk: 0 },
  );

  return {
    lastVisit: toCrmVisit(sortedCompletedPastBookings[0]),
    nextVisit: toCrmVisit(sortedFutureActiveBookings[0]),
    servicesValueCzk: bookings.reduce(
      (total, booking) => total + (booking.status === BookingStatus.COMPLETED ? Math.max(0, booking.servicePriceFromCzk ?? 0) : 0),
      0,
    ),
    paidCzk: paymentTotals.paidCzk,
    unpaidCzk: paymentTotals.unpaidCzk,
    totalBookings: bookings.length,
    completedBookings: countStatus(bookings, BookingStatus.COMPLETED),
    activeBookings: bookings.filter((booking) => ACTIVE_BOOKING_STATUSES.has(booking.status)).length,
    cancelledBookings: countStatus(bookings, BookingStatus.CANCELLED),
    noShowBookings: countStatus(bookings, BookingStatus.NO_SHOW),
  };
}

function toCrmVisit(booking: ClientCrmSummaryBookingInput | undefined): ClientCrmSummaryVisit | null {
  if (!booking) {
    return null;
  }

  return {
    id: booking.id,
    serviceName: booking.serviceNameSnapshot,
    scheduledStartsAt: booking.scheduledStartsAt,
    scheduledEndsAt: booking.scheduledEndsAt,
  };
}

function countStatus(bookings: ClientCrmSummaryBookingInput[], status: BookingStatus) {
  return bookings.filter((booking) => booking.status === status).length;
}

function isUnpaidRelevantBooking(booking: ClientCrmSummaryBookingInput, now: Date) {
  if (booking.status === BookingStatus.COMPLETED) {
    return true;
  }

  return ACTIVE_BOOKING_STATUSES.has(booking.status) && booking.scheduledStartsAt < now;
}
