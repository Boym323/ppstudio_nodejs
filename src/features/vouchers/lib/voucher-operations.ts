import { VoucherStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const voucherOperationErrorCodes = {
  voucherNotFound: "VOUCHER_NOT_FOUND",
  voucherAlreadyCancelled: "VOUCHER_ALREADY_CANCELLED",
  voucherHasRedemptions: "VOUCHER_HAS_REDEMPTIONS",
} as const;

export class VoucherOperationError extends Error {
  constructor(
    readonly code: (typeof voucherOperationErrorCodes)[keyof typeof voucherOperationErrorCodes],
    message: string,
  ) {
    super(message);
    this.name = "VoucherOperationError";
  }
}

function nullableText(value: string | undefined) {
  return value?.trim() ? value.trim() : null;
}

export async function updateVoucherOperationalDetails(input: {
  voucherId: string;
  purchaserName?: string;
  purchaserEmail?: string;
  validUntil?: Date | null;
  internalNote?: string;
  updatedByUserId: string | null;
}) {
  const result = await prisma.voucher.updateMany({
    where: {
      id: input.voucherId,
    },
    data: {
      purchaserName: nullableText(input.purchaserName),
      purchaserEmail: nullableText(input.purchaserEmail),
      validUntil: input.validUntil ?? null,
      internalNote: nullableText(input.internalNote),
      updatedByUserId: input.updatedByUserId,
    },
  });

  if (result.count !== 1) {
    throw new VoucherOperationError(voucherOperationErrorCodes.voucherNotFound, "Voucher was not found.");
  }
}

export async function cancelVoucherOperationally(input: {
  voucherId: string;
  cancelReason: string;
  actorUserId: string | null;
  now?: Date;
}) {
  const voucher = await prisma.voucher.findUnique({
    where: { id: input.voucherId },
    select: {
      id: true,
      status: true,
      _count: {
        select: {
          redemptions: true,
        },
      },
    },
  });

  if (!voucher) {
    throw new VoucherOperationError(voucherOperationErrorCodes.voucherNotFound, "Voucher was not found.");
  }

  if (voucher.status === VoucherStatus.CANCELLED) {
    throw new VoucherOperationError(
      voucherOperationErrorCodes.voucherAlreadyCancelled,
      "Voucher is already cancelled.",
    );
  }

  if (
    voucher.status === VoucherStatus.REDEEMED ||
    voucher.status === VoucherStatus.PARTIALLY_REDEEMED ||
    voucher._count.redemptions > 0
  ) {
    throw new VoucherOperationError(
      voucherOperationErrorCodes.voucherHasRedemptions,
      "Voucher has redemptions and cannot be cancelled.",
    );
  }

  return prisma.voucher.update({
    where: { id: voucher.id },
    data: {
      status: VoucherStatus.CANCELLED,
      cancelledAt: input.now ?? new Date(),
      cancelledByUserId: input.actorUserId,
      cancelReason: input.cancelReason.trim(),
      updatedByUserId: input.actorUserId,
    },
  });
}
