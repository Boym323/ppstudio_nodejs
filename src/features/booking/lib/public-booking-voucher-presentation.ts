import { VoucherType } from "@prisma/client";

type ValidBookingVoucher = {
  code: string;
  type: VoucherType;
  serviceNameSnapshot?: string;
};

/** Bezpečný DTO pro veřejný formulář: nikdy neodhaluje hodnotu voucheru. */
export function toPublicBookingVoucherValidationSuccess(voucher: ValidBookingVoucher) {
  return {
    ok: true as const,
    code: voucher.code,
    displayLabel: voucher.type === VoucherType.VALUE
      ? "Hodnotový poukaz"
      : voucher.serviceNameSnapshot
        ? `Poukaz na službu – ${voucher.serviceNameSnapshot}`
        : "Poukaz na službu",
  };
}
