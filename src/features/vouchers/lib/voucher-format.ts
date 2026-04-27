import { VoucherStatus, VoucherType } from "@prisma/client";

const czkFormatter = new Intl.NumberFormat("cs-CZ", {
  maximumFractionDigits: 0,
  style: "currency",
  currency: "CZK",
});

export function formatVoucherType(type: VoucherType): string {
  switch (type) {
    case VoucherType.VALUE:
      return "Hodnotový poukaz";
    case VoucherType.SERVICE:
      return "Poukaz na službu";
  }
}

export function formatVoucherStatus(status: VoucherStatus): string {
  switch (status) {
    case VoucherStatus.DRAFT:
      return "Rozpracovaný";
    case VoucherStatus.ACTIVE:
      return "Aktivní";
    case VoucherStatus.PARTIALLY_REDEEMED:
      return "Částečně čerpaný";
    case VoucherStatus.REDEEMED:
      return "Uplatněný";
    case VoucherStatus.EXPIRED:
      return "Propadlý";
    case VoucherStatus.CANCELLED:
      return "Zrušený";
  }
}

export function formatVoucherValue(voucher: {
  type: VoucherType;
  originalValueCzk: number | null;
  remainingValueCzk: number | null;
  serviceNameSnapshot: string | null;
  servicePriceSnapshotCzk: number | null;
}): string {
  if (voucher.type === VoucherType.VALUE) {
    return voucher.originalValueCzk === null ? "Hodnota neuvedena" : czkFormatter.format(voucher.originalValueCzk);
  }

  const serviceName = voucher.serviceNameSnapshot ?? "Služba";
  const price = voucher.servicePriceSnapshotCzk === null ? null : czkFormatter.format(voucher.servicePriceSnapshotCzk);

  return price ? `${serviceName} (${price})` : serviceName;
}

export function formatVoucherRemaining(voucher: {
  type: VoucherType;
  remainingValueCzk: number | null;
  status: VoucherStatus;
}): string {
  if (voucher.type === VoucherType.VALUE) {
    return czkFormatter.format(voucher.remainingValueCzk ?? 0);
  }

  return voucher.status === VoucherStatus.REDEEMED ? "Vyčerpáno" : "1 služba";
}

export function getEffectiveVoucherStatus(
  voucher: {
    status: VoucherStatus;
    validUntil: Date | null;
  },
  now = new Date(),
): VoucherStatus {
  if (
    (voucher.status === VoucherStatus.ACTIVE || voucher.status === VoucherStatus.PARTIALLY_REDEEMED) &&
    voucher.validUntil !== null &&
    voucher.validUntil.getTime() < now.getTime()
  ) {
    return VoucherStatus.EXPIRED;
  }

  return voucher.status;
}
