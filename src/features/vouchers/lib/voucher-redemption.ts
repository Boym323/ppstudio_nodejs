import { Prisma, VoucherStatus, VoucherType } from "@prisma/client";

import { normalizeVoucherCode } from "@/features/vouchers/lib/voucher-code";
import { getEffectiveVoucherStatus } from "@/features/vouchers/lib/voucher-format";
import {
  redeemVoucherSchema,
  type RedeemVoucherInput,
} from "@/features/vouchers/schemas/voucher-schemas";
import { prisma } from "@/lib/prisma";

export const voucherRedemptionErrorCodes = {
  invalidInput: "INVALID_INPUT",
  voucherNotFound: "VOUCHER_NOT_FOUND",
  bookingNotFound: "BOOKING_NOT_FOUND",
  bookingAlreadyRedeemed: "BOOKING_ALREADY_REDEEMED",
  voucherNotRedeemable: "VOUCHER_NOT_REDEEMABLE",
  amountRequired: "AMOUNT_REQUIRED",
  insufficientRemainingValue: "INSUFFICIENT_REMAINING_VALUE",
  serviceMismatch: "SERVICE_MISMATCH",
  concurrentRedemption: "CONCURRENT_REDEMPTION",
} as const;

export class VoucherRedemptionError extends Error {
  constructor(
    readonly code: (typeof voucherRedemptionErrorCodes)[keyof typeof voucherRedemptionErrorCodes],
    message: string,
  ) {
    super(message);
    this.name = "VoucherRedemptionError";
  }
}

function assertRedeemable(status: VoucherStatus) {
  if (status !== VoucherStatus.ACTIVE && status !== VoucherStatus.PARTIALLY_REDEEMED) {
    throw new VoucherRedemptionError(
      voucherRedemptionErrorCodes.voucherNotRedeemable,
      "Voucher cannot be redeemed in its current state.",
    );
  }
}

export async function redeemVoucherForBooking(input: RedeemVoucherInput) {
  const parsed = redeemVoucherSchema.safeParse(input);

  if (!parsed.success) {
    throw new VoucherRedemptionError(voucherRedemptionErrorCodes.invalidInput, "Voucher redemption input is invalid.");
  }

  const normalizedCode = normalizeVoucherCode(parsed.data.voucherCode);

  return prisma.$transaction(async (tx) => {
    const [voucher] = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "Voucher"
      WHERE "code" = ${normalizedCode}
      FOR UPDATE
    `);

    if (!voucher) {
      throw new VoucherRedemptionError(voucherRedemptionErrorCodes.voucherNotFound, "Voucher was not found.");
    }

    const currentVoucher = await tx.voucher.findUnique({
      where: { id: voucher.id },
      select: {
        id: true,
        code: true,
        type: true,
        status: true,
        remainingValueCzk: true,
        serviceId: true,
        serviceNameSnapshot: true,
        servicePriceSnapshotCzk: true,
        validUntil: true,
      },
    });

    if (!currentVoucher) {
      throw new VoucherRedemptionError(voucherRedemptionErrorCodes.voucherNotFound, "Voucher was not found.");
    }

    assertRedeemable(getEffectiveVoucherStatus(currentVoucher));

    const [lockedBooking] = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "Booking"
      WHERE "id" = ${parsed.data.bookingId}
      FOR UPDATE
    `);

    if (!lockedBooking) {
      throw new VoucherRedemptionError(voucherRedemptionErrorCodes.bookingNotFound, "Booking was not found.");
    }

    const booking = await tx.booking.findUnique({
      where: { id: lockedBooking.id },
      select: {
        id: true,
        serviceId: true,
        serviceNameSnapshot: true,
        servicePriceFromCzk: true,
        service: {
          select: {
            id: true,
            name: true,
            publicName: true,
            priceFromCzk: true,
          },
        },
      },
    });

    if (!booking) {
      throw new VoucherRedemptionError(voucherRedemptionErrorCodes.bookingNotFound, "Booking was not found.");
    }

    const existingRedemption = await tx.voucherRedemption.findFirst({
      where: { bookingId: booking.id },
      select: { id: true },
    });

    if (existingRedemption) {
      throw new VoucherRedemptionError(
        voucherRedemptionErrorCodes.bookingAlreadyRedeemed,
        "Booking already has a redeemed voucher.",
      );
    }

    if (currentVoucher.type === VoucherType.VALUE) {
      const amountCzk = parsed.data.amountCzk;
      const remainingValueCzk = currentVoucher.remainingValueCzk ?? 0;

      if (!amountCzk) {
        throw new VoucherRedemptionError(voucherRedemptionErrorCodes.amountRequired, "Amount is required.");
      }

      if (amountCzk > remainingValueCzk) {
        throw new VoucherRedemptionError(
          voucherRedemptionErrorCodes.insufficientRemainingValue,
          "Voucher does not have enough remaining value.",
        );
      }

      const nextRemainingValueCzk = remainingValueCzk - amountCzk;
      const nextStatus =
        nextRemainingValueCzk > 0 ? VoucherStatus.PARTIALLY_REDEEMED : VoucherStatus.REDEEMED;
      const updateResult = await tx.voucher.updateMany({
        where: {
          id: currentVoucher.id,
          remainingValueCzk: {
            gte: amountCzk,
          },
          status: {
            in: [VoucherStatus.ACTIVE, VoucherStatus.PARTIALLY_REDEEMED],
          },
        },
        data: {
          remainingValueCzk: {
            decrement: amountCzk,
          },
          status: nextStatus,
        },
      });

      if (updateResult.count !== 1) {
        throw new VoucherRedemptionError(
          voucherRedemptionErrorCodes.concurrentRedemption,
          "Voucher remaining value changed during redemption.",
        );
      }

      const [updatedVoucher, redemption] = await Promise.all([
        tx.voucher.findUniqueOrThrow({
          where: { id: currentVoucher.id },
        }),
        tx.voucherRedemption.create({
          data: {
            voucherId: currentVoucher.id,
            bookingId: booking.id,
            amountCzk,
            redeemedByUserId: parsed.data.redeemedByUserId ?? null,
            note: parsed.data.note ?? null,
          },
        }),
      ]);

      return { voucher: updatedVoucher, redemption };
    }

    if (currentVoucher.serviceId !== booking.serviceId) {
      throw new VoucherRedemptionError(voucherRedemptionErrorCodes.serviceMismatch, "Voucher service does not match booking.");
    }

    const serviceNameSnapshot =
      currentVoucher.serviceNameSnapshot ??
      booking.service.publicName ??
      booking.serviceNameSnapshot ??
      booking.service.name;
    const amountCzk = currentVoucher.servicePriceSnapshotCzk ?? booking.servicePriceFromCzk ?? booking.service.priceFromCzk;

    const [updatedVoucher, redemption] = await Promise.all([
      tx.voucher.update({
        where: { id: currentVoucher.id },
        data: { status: VoucherStatus.REDEEMED },
      }),
      tx.voucherRedemption.create({
        data: {
          voucherId: currentVoucher.id,
          bookingId: booking.id,
          amountCzk,
          serviceId: booking.serviceId,
          serviceNameSnapshot,
          redeemedByUserId: parsed.data.redeemedByUserId ?? null,
          note: parsed.data.note ?? null,
        },
      }),
    ]);

    return { voucher: updatedVoucher, redemption };
  });
}
