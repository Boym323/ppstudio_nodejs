import { AvailabilitySlotStatus } from "@/generated/prisma/browser";

import { getBookingPolicySettings } from "@/lib/site-settings";

import type { BookingAvailabilityCatalogOptions } from "./booking-availability-core";

export type BookingAvailabilityCatalogPolicyOptions = Pick<
  BookingAvailabilityCatalogOptions,
  "includeServices" | "excludeBookingId"
>;

/** Aktuální rozsah termínů sdílený veřejnou a interní správou rezervací. */
export async function getCurrentBookingAvailabilityPolicy(
  options: BookingAvailabilityCatalogPolicyOptions,
): Promise<BookingAvailabilityCatalogOptions> {
  const now = new Date();
  const bookingPolicy = await getBookingPolicySettings();

  return {
    ...options,
    bookingWindowStart: new Date(
      now.getTime() + bookingPolicy.minAdvanceHours * 60 * 60 * 1000,
    ),
    bookingWindowEnd: new Date(
      now.getTime() + bookingPolicy.maxAdvanceDays * 24 * 60 * 60 * 1000,
    ),
    availabilitySlotStatus: AvailabilitySlotStatus.PUBLISHED,
    serviceWhere: {
      isActive: true,
      isPubliclyBookable: true,
      category: { is: { isActive: true } },
    },
  };
}
