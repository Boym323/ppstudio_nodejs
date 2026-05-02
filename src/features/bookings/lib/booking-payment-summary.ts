import { BookingPaymentMethod } from "@prisma/client";

export type BookingPaymentStatus =
  | "UNPAID"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERPAID";

export type BookingPaymentSummary = {
  totalPriceCzk: number;
  voucherPaidCzk: number;
  directPaidCzk: number;
  paidTotalCzk: number;
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
  voucherRedemptions?: Array<{ amountCzk?: number | null }>;
  payments?: Array<{ amountCzk?: number | null }>;
};

export function getBookingPaymentSummary({
  totalPriceCzk,
  voucherRedemptions = [],
  payments = [],
}: BookingPaymentSummaryInput): BookingPaymentSummary {
  const normalizedTotalPriceCzk = Math.max(0, totalPriceCzk ?? 0);
  const voucherPaidCzk = sumCzk(voucherRedemptions);
  const directPaidCzk = sumCzk(payments);
  const paidTotalCzk = voucherPaidCzk + directPaidCzk;
  const remainingCzk = Math.max(0, normalizedTotalPriceCzk - paidTotalCzk);
  const overpaidCzk = Math.max(0, paidTotalCzk - normalizedTotalPriceCzk);
  const status = getPaymentStatus({
    totalPriceCzk: normalizedTotalPriceCzk,
    paidTotalCzk,
  });

  return {
    totalPriceCzk: normalizedTotalPriceCzk,
    voucherPaidCzk,
    directPaidCzk,
    paidTotalCzk,
    remainingCzk,
    overpaidCzk,
    status,
  };
}

function sumCzk(items: Array<{ amountCzk?: number | null }>) {
  return items.reduce((total, item) => total + Math.max(0, item.amountCzk ?? 0), 0);
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
