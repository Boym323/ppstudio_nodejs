import { Prisma, VoucherStatus, VoucherType } from "@prisma/client";

import { generateVoucherCode } from "@/features/vouchers/lib/voucher-code";
import { redeemVoucherForBooking } from "@/features/vouchers/lib/voucher-redemption";
import { validateVoucherForBookingInput } from "@/features/vouchers/lib/voucher-validation";
import {
  createVoucherSchema,
  redeemVoucherSchema,
  validateVoucherCodeSchema,
  type CreateVoucherInput,
  type RedeemVoucherInput,
  type ValidateVoucherCodeInput,
} from "@/features/vouchers/schemas/voucher-schemas";
import { prisma } from "@/lib/prisma";

const MAX_CREATE_COLLISION_RETRIES = 5;

function nullableText(value: string | undefined) {
  return value?.trim() ? value.trim() : null;
}

function isUniqueCodeCollision(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes("code")
  );
}

export async function createVoucher(input: CreateVoucherInput, createdByUserId: string | null) {
  const parsed = createVoucherSchema.parse(input);
  const now = new Date();

  for (let attempt = 0; attempt < MAX_CREATE_COLLISION_RETRIES; attempt += 1) {
    const code = await generateVoucherCode(now);

    try {
      if (parsed.type === VoucherType.VALUE) {
        return await prisma.voucher.create({
          data: {
            code,
            type: VoucherType.VALUE,
            status: VoucherStatus.ACTIVE,
            purchaserName: nullableText(parsed.purchaserName),
            purchaserEmail: nullableText(parsed.purchaserEmail),
            recipientName: nullableText(parsed.recipientName),
            message: nullableText(parsed.message),
            originalValueCzk: parsed.originalValueCzk,
            remainingValueCzk: parsed.originalValueCzk,
            serviceId: null,
            serviceNameSnapshot: null,
            servicePriceSnapshotCzk: null,
            serviceDurationSnapshot: null,
            validFrom: parsed.validFrom ?? now,
            validUntil: parsed.validUntil ?? null,
            issuedAt: now,
            internalNote: nullableText(parsed.internalNote),
            createdByUserId,
          },
        });
      }

      const service = await prisma.service.findUnique({
        where: { id: parsed.serviceId },
        select: {
          id: true,
          name: true,
          publicName: true,
          priceFromCzk: true,
          durationMinutes: true,
        },
      });

      if (!service) {
        throw new Error("Selected service does not exist.");
      }

      return await prisma.voucher.create({
        data: {
          code,
          type: VoucherType.SERVICE,
          status: VoucherStatus.ACTIVE,
          purchaserName: nullableText(parsed.purchaserName),
          purchaserEmail: nullableText(parsed.purchaserEmail),
          recipientName: nullableText(parsed.recipientName),
          message: nullableText(parsed.message),
          originalValueCzk: service.priceFromCzk,
          remainingValueCzk: null,
          serviceId: service.id,
          serviceNameSnapshot: service.publicName ?? service.name,
          servicePriceSnapshotCzk: service.priceFromCzk,
          serviceDurationSnapshot: service.durationMinutes,
          validFrom: parsed.validFrom ?? now,
          validUntil: parsed.validUntil ?? null,
          issuedAt: now,
          internalNote: nullableText(parsed.internalNote),
          createdByUserId,
        },
      });
    } catch (error) {
      if (isUniqueCodeCollision(error)) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Voucher could not be created with a unique code.");
}

export async function validateVoucherCode(input: ValidateVoucherCodeInput) {
  const parsed = validateVoucherCodeSchema.parse(input);

  return validateVoucherForBookingInput(parsed);
}

export async function redeemVoucher(input: RedeemVoucherInput) {
  const parsed = redeemVoucherSchema.parse(input);

  return redeemVoucherForBooking(parsed);
}
