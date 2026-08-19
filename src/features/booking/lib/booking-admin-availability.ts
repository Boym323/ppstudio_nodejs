import {
  getBookingAvailabilityCatalog,
  type BookingAvailabilityCatalog,
} from "./booking-availability-core";
import { getCurrentBookingAvailabilityPolicy } from "./booking-availability-policy";

type AdminBookingAvailabilityCatalogOptions = {
  includeServices?: boolean;
  excludeBookingId?: string;
};

/** Dostupnost pro interní ruční rezervace a přesuny; zachovává dosavadní rozsah katalogu. */
export async function getAdminBookingAvailabilityCatalog(
  options: AdminBookingAvailabilityCatalogOptions = {},
): Promise<BookingAvailabilityCatalog> {
  return getBookingAvailabilityCatalog(await getCurrentBookingAvailabilityPolicy({
    includeServices: options.includeServices ?? true,
    excludeBookingId: options.excludeBookingId,
  }));
}
