import { Prisma, VoucherChangeOperation, VoucherStatus } from "@/generated/prisma/client";

import { runSerializableTransaction } from "@/lib/serializable-transaction";

export const voucherOperationErrorCodes = {
  voucherNotFound: "VOUCHER_NOT_FOUND",
  invalidValidityRange: "INVALID_VALIDITY_RANGE",
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

function isoDate(value: Date | null) {
  return value?.toISOString() ?? null;
}

export async function updateVoucherOperationalDetails(input: {
  voucherId: string;
  purchaserName?: string;
  purchaserEmail?: string;
  validUntil?: Date | null;
  internalNote?: string;
  updatedByUserId: string;
}) {
  return runSerializableTransaction(async (tx) => {
    const voucher = await tx.voucher.findUnique({
      where: { id: input.voucherId },
      select: { id: true, validFrom: true, validUntil: true, purchaserName: true, purchaserEmail: true, internalNote: true },
    });

    if (!voucher) {
      throw new VoucherOperationError(voucherOperationErrorCodes.voucherNotFound, "Voucher was not found.");
    }

    const next = {
      purchaserName: nullableText(input.purchaserName),
      purchaserEmail: nullableText(input.purchaserEmail),
      validUntil: input.validUntil ?? null,
      internalNote: nullableText(input.internalNote),
    };
    if (next.validUntil && next.validUntil <= voucher.validFrom) {
      throw new VoucherOperationError(
        voucherOperationErrorCodes.invalidValidityRange,
        "Voucher validUntil must be after validFrom.",
      );
    }

    const changed = voucher.purchaserName !== next.purchaserName
      || voucher.purchaserEmail !== next.purchaserEmail
      || isoDate(voucher.validUntil) !== isoDate(next.validUntil)
      || voucher.internalNote !== next.internalNote;
    if (!changed) return voucher;

    const before: Record<string, Prisma.InputJsonValue | null> = {};
    const after: Record<string, Prisma.InputJsonValue | null> = {};
    if (isoDate(voucher.validUntil) !== isoDate(next.validUntil)) {
      before.validUntil = isoDate(voucher.validUntil);
      after.validUntil = isoDate(next.validUntil);
    }
    if (voucher.purchaserName !== next.purchaserName) {
      before.purchaserNameChanged = false;
      after.purchaserNameChanged = true;
    }
    if (voucher.purchaserEmail !== next.purchaserEmail) {
      before.purchaserEmailChanged = false;
      after.purchaserEmailChanged = true;
    }
    if (voucher.internalNote !== next.internalNote) {
      before.internalNoteChanged = false;
      after.internalNoteChanged = true;
      before.hasInternalNote = voucher.internalNote !== null;
      after.hasInternalNote = next.internalNote !== null;
    }

    const updated = await tx.voucher.update({
      where: { id: voucher.id },
      data: { ...next, updatedByUserId: input.updatedByUserId },
    });
    await tx.voucherChangeLog.create({
      data: {
        voucherId: voucher.id,
        actorUserId: input.updatedByUserId,
        operation: VoucherChangeOperation.UPDATE_OPERATIONAL_DETAILS,
        before,
        after,
      },
    });
    return updated;
  });
}

export async function cancelVoucherOperationally(input: {
  voucherId: string;
  cancelReason: string;
  actorUserId: string;
  now?: Date;
}) {
  return runSerializableTransaction(async (tx) => {
  const voucher = await tx.voucher.findUnique({
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

  const cancelledAt = input.now ?? new Date();
  const updated = await tx.voucher.update({
    where: { id: voucher.id },
    data: {
      status: VoucherStatus.CANCELLED,
      cancelledAt,
      cancelledByUserId: input.actorUserId,
      cancelReason: input.cancelReason.trim(),
      updatedByUserId: input.actorUserId,
    },
  });
  await tx.voucherChangeLog.create({
    data: {
      voucherId: voucher.id,
      actorUserId: input.actorUserId,
      operation: VoucherChangeOperation.CANCEL,
      before: { status: voucher.status, cancelledAt: null },
      after: { status: VoucherStatus.CANCELLED, cancelledAt: cancelledAt.toISOString() },
    },
  });
  return updated;
  });
}
