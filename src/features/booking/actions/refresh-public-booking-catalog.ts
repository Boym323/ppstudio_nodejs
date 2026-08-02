"use server";

import { getPublicBookingCatalog } from "@/features/booking/lib/booking-public";

export async function refreshPublicBookingCatalogAction() {
  const catalog = await getPublicBookingCatalog();

  return { catalog };
}
