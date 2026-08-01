"use server";

import { getPublicBookingCatalog } from "@/features/booking/lib/booking-public";
import { validateVoucherForBookingInput } from "@/features/vouchers/lib/voucher-validation";

export async function refreshPublicBookingCatalogAction(input: {
  serviceId: string;
  voucherCode: string;
}) {
  const catalog = await getPublicBookingCatalog();
  const voucherCode = input.voucherCode.trim();
  const voucher = voucherCode && input.serviceId
    ? await validateVoucherForBookingInput({ code: voucherCode, serviceId: input.serviceId })
    : null;

  return {
    catalog,
    voucherCode: voucher?.ok ? voucher.code : "",
  };
}
