import { VoucherStatus, VoucherType } from "@prisma/client";

import { normalizeVoucherCode } from "@/features/vouchers/lib/voucher-code";
import {
  formatVoucherType,
  getEffectiveVoucherStatus,
} from "@/features/vouchers/lib/voucher-format";
import { prisma } from "@/lib/prisma";

export const voucherValidationReasonCodes = {
  invalidInput: "INVALID_INPUT",
  notFound: "NOT_FOUND",
  draft: "DRAFT",
  cancelled: "CANCELLED",
  redeemed: "REDEEMED",
  expired: "EXPIRED",
  noRemainingValue: "NO_REMAINING_VALUE",
  serviceMismatch: "SERVICE_MISMATCH",
} as const;

export type VoucherValidationReasonCode =
  (typeof voucherValidationReasonCodes)[keyof typeof voucherValidationReasonCodes];

export type ValidateVoucherForBookingResult =
  | {
      ok: true;
      voucherId: string;
      code: string;
      type: VoucherType;
      status: VoucherStatus;
      displayLabel: string;
      remainingValueCzk?: number;
      serviceNameSnapshot?: string;
    }
  | {
      ok: false;
      reason: VoucherValidationReasonCode;
    };

export type PublicVoucherVerificationResult =
  | {
      ok: true;
      code: string;
      type: VoucherType;
      remainingValueCzk: number | null;
      serviceNameSnapshot: string | null;
      validUntil: Date | null;
    }
  | {
      ok: false;
      reason: VoucherValidationReasonCode;
    };

function getBlockedReason(status: VoucherStatus): VoucherValidationReasonCode | null {
  switch (status) {
    case VoucherStatus.DRAFT:
      return voucherValidationReasonCodes.draft;
    case VoucherStatus.CANCELLED:
      return voucherValidationReasonCodes.cancelled;
    case VoucherStatus.REDEEMED:
      return voucherValidationReasonCodes.redeemed;
    case VoucherStatus.EXPIRED:
      return voucherValidationReasonCodes.expired;
    case VoucherStatus.ACTIVE:
    case VoucherStatus.PARTIALLY_REDEEMED:
      return null;
  }
}

function isVoucherNotActiveYet(voucher: { validFrom: Date }, now: Date) {
  return voucher.validFrom.getTime() > now.getTime();
}

export async function verifyVoucherPublic(input: {
  code: string;
  now?: Date;
}): Promise<PublicVoucherVerificationResult> {
  const code = normalizeVoucherCode(input.code);
  const now = input.now ?? new Date();

  if (!code) {
    return { ok: false, reason: voucherValidationReasonCodes.invalidInput };
  }

  const voucher = await prisma.voucher.findUnique({
    where: { code },
    select: {
      code: true,
      type: true,
      status: true,
      remainingValueCzk: true,
      serviceNameSnapshot: true,
      validFrom: true,
      validUntil: true,
    },
  });

  if (!voucher) {
    return { ok: false, reason: voucherValidationReasonCodes.notFound };
  }

  const effectiveStatus = getEffectiveVoucherStatus(voucher, now);
  const blockedReason = getBlockedReason(effectiveStatus);

  if (blockedReason) {
    return { ok: false, reason: blockedReason };
  }

  if (isVoucherNotActiveYet(voucher, now)) {
    return { ok: false, reason: voucherValidationReasonCodes.draft };
  }

  if (voucher.type === VoucherType.VALUE && (voucher.remainingValueCzk ?? 0) <= 0) {
    return { ok: false, reason: voucherValidationReasonCodes.noRemainingValue };
  }

  return {
    ok: true,
    code: voucher.code,
    type: voucher.type,
    remainingValueCzk: voucher.type === VoucherType.VALUE ? (voucher.remainingValueCzk ?? 0) : null,
    serviceNameSnapshot: voucher.type === VoucherType.SERVICE ? voucher.serviceNameSnapshot : null,
    validUntil: voucher.validUntil,
  };
}

export async function validateVoucherForBookingInput(input: {
  code: string;
  serviceId: string;
}): Promise<ValidateVoucherForBookingResult> {
  const code = normalizeVoucherCode(input.code);
  const serviceId = input.serviceId.trim();

  if (!code || !serviceId) {
    return { ok: false, reason: voucherValidationReasonCodes.invalidInput };
  }

  const voucher = await prisma.voucher.findUnique({
    where: { code },
    select: {
      id: true,
      code: true,
      type: true,
      status: true,
      remainingValueCzk: true,
      serviceId: true,
      serviceNameSnapshot: true,
      validUntil: true,
    },
  });

  if (!voucher) {
    return { ok: false, reason: voucherValidationReasonCodes.notFound };
  }

  const effectiveStatus = getEffectiveVoucherStatus(voucher);
  const blockedReason = getBlockedReason(effectiveStatus);

  if (blockedReason) {
    return { ok: false, reason: blockedReason };
  }

  if (voucher.type === VoucherType.VALUE) {
    if ((voucher.remainingValueCzk ?? 0) <= 0) {
      return { ok: false, reason: voucherValidationReasonCodes.noRemainingValue };
    }

    return {
      ok: true,
      voucherId: voucher.id,
      code: voucher.code,
      type: voucher.type,
      status: effectiveStatus,
      displayLabel: `${formatVoucherType(voucher.type)} - ${voucher.remainingValueCzk} Kč`,
      remainingValueCzk: voucher.remainingValueCzk ?? 0,
    };
  }

  if (voucher.serviceId !== serviceId) {
    return { ok: false, reason: voucherValidationReasonCodes.serviceMismatch };
  }

  return {
    ok: true,
    voucherId: voucher.id,
    code: voucher.code,
    type: voucher.type,
    status: effectiveStatus,
    displayLabel: voucher.serviceNameSnapshot
      ? `${formatVoucherType(voucher.type)} - ${voucher.serviceNameSnapshot}`
      : formatVoucherType(voucher.type),
    serviceNameSnapshot: voucher.serviceNameSnapshot ?? undefined,
  };
}
