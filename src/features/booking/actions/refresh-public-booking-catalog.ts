"use server";

import { getPublicBookingCatalog } from "@/features/booking/lib/booking-public";

export async function refreshPublicBookingCatalogAction(input: {
  serviceId: string;
  voucherCode: string;
}) {
  const catalog = await getPublicBookingCatalog();

  return {
    catalog,
    // Ověření voucheru má vlastní akci. Obnovení termínů nesmí měnit rozepsaný
    // ani již bezpečně aplikovaný voucher.
    voucherCode: input.voucherCode,
  };
}
