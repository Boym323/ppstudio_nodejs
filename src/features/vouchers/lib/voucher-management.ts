import { Prisma, VoucherStatus, VoucherType } from "@/generated/prisma/client";

import { allocateVoucherCode } from "@/features/vouchers/lib/voucher-code";
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
import {
  isTransientTransactionConflict,
  runSerializableTransaction,
  waitForTransientRetry,
} from "@/lib/serializable-transaction";

const MAX_CREATE_TRANSACTION_ATTEMPTS = 8;

export const voucherManagementErrorCodes = {
  templateUnavailable: "TEMPLATE_UNAVAILABLE",
  serviceNotFound: "SERVICE_NOT_FOUND",
  serviceNotActive: "SERVICE_NOT_ACTIVE",
  servicePriceMissing: "SERVICE_PRICE_MISSING",
  transientConflict: "TRANSIENT_CONFLICT",
  operationFailed: "OPERATION_FAILED",
} as const;

export class VoucherManagementError extends Error {
  constructor(
    readonly code: (typeof voucherManagementErrorCodes)[keyof typeof voucherManagementErrorCodes],
    message: string,
  ) {
    super(message);
    this.name = "VoucherManagementError";
  }
}

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

function isInteractiveTransactionTimeout(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2028";
}

export async function createVoucher(input: CreateVoucherInput, createdByUserId: string | null) {
  const parsed = createVoucherSchema.parse(input);

  const now = new Date();

  for (let attempt = 0; attempt < MAX_CREATE_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await runSerializableTransaction(async (tx) => {
        const template = await tx.voucherTemplate.findUnique({ where: { key: parsed.templateKey } });
        if (!template || template.status !== "PUBLISHED" || !template.allowedTypes.includes(parsed.type)) {
          throw new VoucherManagementError(
            voucherManagementErrorCodes.templateUnavailable,
            "Vybraný vzhled voucheru už není dostupný.",
          );
        }

        const code = await allocateVoucherCode(tx, now, { failFast: true });

        if (parsed.type === VoucherType.VALUE) {
          return tx.voucher.create({
            data: {
              code,
              type: VoucherType.VALUE,
              templateKey: parsed.templateKey,
              templateId: template.id,
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

        const service = await tx.service.findUnique({
          where: { id: parsed.serviceId },
          select: {
            id: true,
            name: true,
            publicName: true,
            priceFromCzk: true,
            durationMinutes: true,
            isActive: true,
          },
        });

        if (!service) {
          throw new VoucherManagementError(
            voucherManagementErrorCodes.serviceNotFound,
            "Vybraná služba neexistuje.",
          );
        }

        if (!service.isActive) {
          throw new VoucherManagementError(
            voucherManagementErrorCodes.serviceNotActive,
            "Vybraná služba už není aktivní.",
          );
        }

        if (service.priceFromCzk === null) {
          throw new VoucherManagementError(
            voucherManagementErrorCodes.servicePriceMissing,
            "Vybraná služba nemá nastavenou cenu a nelze ji použít pro voucher.",
          );
        }

        return tx.voucher.create({
          data: {
            code,
            type: VoucherType.SERVICE,
            templateKey: parsed.templateKey,
            templateId: template.id,
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
      }, { maxRetries: 0 });
    } catch (error) {
      if (isInteractiveTransactionTimeout(error)) {
        console.warn("Voucher creation transaction timed out", {
          operation: "createVoucher",
          attempt: attempt + 1,
          prismaCode: "P2028",
        });
        throw new VoucherManagementError(
          voucherManagementErrorCodes.operationFailed,
          "Operaci se nepodařilo dokončit. Zkuste ji prosím znovu.",
        );
      }

      if (!isTransientTransactionConflict(error) && !isUniqueCodeCollision(error)) {
        throw error;
      }

      if (attempt + 1 < MAX_CREATE_TRANSACTION_ATTEMPTS) {
        await waitForTransientRetry(attempt + 1);
        continue;
      }

      throw new VoucherManagementError(
        voucherManagementErrorCodes.transientConflict,
        "Operaci se kvůli souběžné změně nepodařilo dokončit. Zkuste ji prosím znovu.",
      );
    }
  }

  throw new VoucherManagementError(
    voucherManagementErrorCodes.transientConflict,
    "Operaci se kvůli souběžné změně nepodařilo dokončit. Zkuste ji prosím znovu.",
  );
}

export async function validateVoucherCode(input: ValidateVoucherCodeInput) {
  const parsed = validateVoucherCodeSchema.parse(input);

  return validateVoucherForBookingInput(parsed);
}

export async function redeemVoucher(input: RedeemVoucherInput) {
  const parsed = redeemVoucherSchema.parse(input);

  return redeemVoucherForBooking(parsed);
}
