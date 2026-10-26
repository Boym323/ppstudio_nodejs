import { Prisma } from "@/generated/prisma/client";

export const voucherCompletionAuditReason = "Voucher uplatněn při dokončení návštěvy";
export const voucherCompletionAuditSource = "admin-booking-complete-flow-v1";

export type VoucherCompletionBookingAudit = {
  bookingId: string;
  reason: string | null;
  metadata: Prisma.JsonValue | null;
};

export type CanonicalVoucherRedemption = {
  bookingId: string | null;
  voucher: { code: string } | null;
};

export function getBookingHistorySource(metadata: Prisma.JsonValue | null): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  return typeof metadata.source === "string" ? metadata.source : null;
}

export function getBookingHistoryVoucherCode(metadata: Prisma.JsonValue | null): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  return typeof metadata.voucherCode === "string" ? metadata.voucherCode : null;
}

/** Potlačí jen booking audit, pro který existuje stejná kanonická voucher redemption operace. */
export function filterDuplicateVoucherCompletionAudits<T extends VoucherCompletionBookingAudit>(
  history: T[],
  redemptions: CanonicalVoucherRedemption[],
) {
  const canonicalOperations = new Set(redemptions.flatMap((redemption) => (
    redemption.bookingId && redemption.voucher
      ? [`${redemption.bookingId}\u0000${redemption.voucher.code}`]
      : []
  )));

  return history.filter((entry) => {
    if (entry.reason !== voucherCompletionAuditReason || getBookingHistorySource(entry.metadata) !== voucherCompletionAuditSource) return true;
    const voucherCode = getBookingHistoryVoucherCode(entry.metadata);
    return !voucherCode || !canonicalOperations.has(`${entry.bookingId}\u0000${voucherCode}`);
  });
}
