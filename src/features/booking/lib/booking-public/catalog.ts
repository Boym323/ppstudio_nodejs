import { getBookingAvailabilityCatalog } from "../booking-availability-core";
import { getCurrentBookingAvailabilityPolicy } from "../booking-availability-policy";
import type { PublicBookingCatalog } from "./shared";

type PublicBookingCatalogOptions = {
  includeServices?: boolean;
  excludeBookingId?: string;
};

export async function getPublicBookingCatalog(
  options: PublicBookingCatalogOptions = {},
): Promise<PublicBookingCatalog> {
  return getBookingAvailabilityCatalog(await getCurrentBookingAvailabilityPolicy({
    includeServices: options.includeServices ?? true,
    excludeBookingId: options.excludeBookingId,
  }));
}
