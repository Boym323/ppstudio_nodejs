import { BookingPaymentMethod, BookingPaymentStatus as BookingPaymentRecordStatus } from "@/generated/prisma/browser";

export type BookingPaymentStatus =
  | "UNPAID"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERPAID";

export type BookingPaymentSummary = {
  totalPriceCzk: number;
  voucherPaidCzk: number;
  voucherRedemptionCzk: number;
  directPaidCzk: number;
  paidTotalCzk: number;
  accountingPaidTotalCzk: number;
  remainingCzk: number;
  overpaidCzk: number;
  status: BookingPaymentStatus;
};

export const BOOKING_PAYMENT_STATUS_LABELS: Record<BookingPaymentStatus, string> = {
  UNPAID: "Neuhrazeno",
  PARTIALLY_PAID: "Částečně uhrazeno",
  PAID: "Uhrazeno",
  OVERPAID: "Přeplaceno",
};

export const BOOKING_PAYMENT_METHOD_LABELS: Record<BookingPaymentMethod, string> = {
  [BookingPaymentMethod.CASH]: "Hotově",
  [BookingPaymentMethod.CARD]: "Kartou",
  [BookingPaymentMethod.BANK_TRANSFER]: "Převodem / QR",
  [BookingPaymentMethod.OTHER]: "Jiné",
};

type BookingPaymentSummaryInput = {
  totalPriceCzk?: number | null;
  serviceId?: string | null;
  servicePriceCzk?: number | null;
  voucherRedemptions?: Array<{
    amountCzk?: number | null;
    serviceId?: string | null;
    voucher?: { type?: "VALUE" | "SERVICE" | null } | null;
  }>;
  payments?: Array<{ amountCzk?: number | null; status?: BookingPaymentRecordStatus }>;
};

export function getBookingPaymentSummary({
  totalPriceCzk,
  serviceId,
  servicePriceCzk,
  voucherRedemptions = [],
  payments = [],
}: BookingPaymentSummaryInput): BookingPaymentSummary {
  const normalizedTotalPriceCzk = Math.max(0, totalPriceCzk ?? 0);
  const voucherPaidCzk = sumVoucherCzk(voucherRedemptions, {
    totalPriceCzk: normalizedTotalPriceCzk,
    serviceId,
    servicePriceCzk,
  });
  const voucherRedemptionCzk = voucherRedemptions.reduce((total, redemption) => total + Math.max(0, redemption.amountCzk ?? 0), 0);
  const directPaidCzk = sumCzk(payments);
  const paidTotalCzk = voucherPaidCzk + directPaidCzk;
  const accountingPaidTotalCzk = voucherRedemptionCzk + directPaidCzk;
  const remainingCzk = Math.max(0, normalizedTotalPriceCzk - paidTotalCzk);
  const overpaidCzk = Math.max(0, paidTotalCzk - normalizedTotalPriceCzk);
  const status = getPaymentStatus({
    totalPriceCzk: normalizedTotalPriceCzk,
    paidTotalCzk,
  });

  return {
    totalPriceCzk: normalizedTotalPriceCzk,
    voucherPaidCzk,
    voucherRedemptionCzk,
    directPaidCzk,
    paidTotalCzk,
    accountingPaidTotalCzk,
    remainingCzk,
    overpaidCzk,
    status,
  };
}

function sumVoucherCzk(
  redemptions: NonNullable<BookingPaymentSummaryInput["voucherRedemptions"]>,
  context: { totalPriceCzk: number; serviceId?: string | null; servicePriceCzk?: number | null },
) {
  const valueVoucherPaidCzk = redemptions.reduce(
    (total, redemption) => total + (redemption.voucher?.type === "SERVICE" ? 0 : Math.max(0, redemption.amountCzk ?? 0)),
    0,
  );
  // SERVICE redemption settles the booked service once at its booking price.
  // Its stored redemption amount remains the issuance-time accounting snapshot.
  const hasMatchingServiceVoucher = Boolean(context.serviceId)
    && redemptions.some((redemption) => redemption.voucher?.type === "SERVICE" && redemption.serviceId === context.serviceId);
  const serviceVoucherPaidCzk = hasMatchingServiceVoucher && context.servicePriceCzk != null
    ? Math.min(context.totalPriceCzk, Math.max(0, context.servicePriceCzk))
    : 0;
  return valueVoucherPaidCzk + serviceVoucherPaidCzk;
}

function sumCzk(items: Array<{ amountCzk?: number | null; status?: BookingPaymentRecordStatus }>) {
  return items.reduce(
    (total, item) => total + (item.status === BookingPaymentRecordStatus.VOIDED ? 0 : Math.max(0, item.amountCzk ?? 0)),
    0,
  );
}

function getPaymentStatus({
  totalPriceCzk,
  paidTotalCzk,
}: {
  totalPriceCzk: number;
  paidTotalCzk: number;
}): BookingPaymentStatus {
  if (totalPriceCzk === 0 && paidTotalCzk === 0) {
    return "PAID";
  }

  if (paidTotalCzk <= 0) {
    return "UNPAID";
  }

  if (paidTotalCzk < totalPriceCzk) {
    return "PARTIALLY_PAID";
  }

  if (paidTotalCzk === totalPriceCzk) {
    return "PAID";
  }

  return "OVERPAID";
}
