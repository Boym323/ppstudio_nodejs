export type ExpectedRevenueBooking = {
  status: string;
  scheduledStartsAt: Date;
  slotIsPublished: boolean;
  finalPriceCzk: number | null;
  servicePriceFromCzk: number | null;
};

export function getExpectedRevenueBookingValue(booking: ExpectedRevenueBooking) {
  return booking.finalPriceCzk ?? booking.servicePriceFromCzk;
}

export function calculateExpectedRevenue(
  bookings: ExpectedRevenueBooking[],
  range: { start: Date; end: Date } | null,
) {
  if (!range) return { amount: 0, bookingCount: 0, missingPriceCount: 0 };

  let amount = 0;
  let bookingCount = 0;
  let missingPriceCount = 0;
  for (const booking of bookings) {
    if (
      booking.status !== "CONFIRMED" ||
      !booking.slotIsPublished ||
      booking.scheduledStartsAt < range.start ||
      booking.scheduledStartsAt >= range.end
    ) continue;

    const value = getExpectedRevenueBookingValue(booking);
    if (value === null) {
      missingPriceCount += 1;
      continue;
    }
    bookingCount += 1;
    amount += value;
  }

  return { amount, bookingCount, missingPriceCount };
}
