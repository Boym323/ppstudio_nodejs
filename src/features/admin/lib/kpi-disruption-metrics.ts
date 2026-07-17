export type DisruptionBooking = {
  status: string;
  slotPublishedAt: Date | null;
  finalPriceCzk: number | null;
  servicePriceFromCzk: number | null;
};

const relevantStatuses = new Set(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]);

function price(booking: DisruptionBooking) {
  return booking.finalPriceCzk ?? booking.servicePriceFromCzk ?? 0;
}

/** Jmenovatel tvoří jen publikované, reálně plánované návštěvy. */
export function calculateDisruptionMetrics(bookings: DisruptionBooking[]) {
  const relevant = bookings.filter(
    (booking) => booking.slotPublishedAt !== null && relevantStatuses.has(booking.status),
  );
  const cancelled = relevant.filter((booking) => booking.status === "CANCELLED");
  const noShows = relevant.filter((booking) => booking.status === "NO_SHOW");

  return {
    relevantCount: relevant.length,
    cancellations: cancelled.length,
    cancellationRate: relevant.length ? (cancelled.length / relevant.length) * 100 : 0,
    cancellationValue: cancelled.reduce((sum, booking) => sum + price(booking), 0),
    noShows: noShows.length,
    noShowRate: relevant.length ? (noShows.length / relevant.length) * 100 : 0,
    noShowValue: noShows.reduce((sum, booking) => sum + price(booking), 0),
  };
}
