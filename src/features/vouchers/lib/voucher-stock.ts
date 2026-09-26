import {
  Prisma,
  VoucherPrintBatchStatus,
  VoucherStatus,
  VoucherStockAuditOperation,
  VoucherStockItemStatus,
  VoucherType,
} from "@/generated/prisma/client";

import { allocateVoucherCodes, normalizeVoucherCode } from "@/features/vouchers/lib/voucher-code";
import { STRICT_VOUCHER_RENDER_POLICY } from "@/features/vouchers/lib/voucher-render-policy";
import { CURRENT_VOUCHER_TEMPLATE_VALIDATION_POLICY } from "@/features/vouchers/lib/voucher-template-validation-policy";
import {
  addVoucherValidityMonths,
  getVoucherPragueDateBoundary,
  getVoucherPragueCalendarYear,
} from "@/features/vouchers/lib/voucher-validity-date";
import {
  activateVoucherStockItemSchema,
  type ActivateVoucherStockItemInput,
} from "@/features/vouchers/schemas/voucher-schemas";
import { getSiteSettings } from "@/lib/site-settings";
import { prisma } from "@/lib/prisma";
import {
  getTransientTransactionConflictKind,
  isTransientTransactionConflict,
  runSerializableTransaction,
  TransientTransactionConflictError,
  waitForTransientRetry,
} from "@/lib/serializable-transaction";

const BATCH_NUMBER_ALLOCATION_LOCK = "ppstudio:voucher-print-batch-number-v1";
export const MAX_BATCH_TRANSACTION_ATTEMPTS = 8;

function isInteractiveTransactionTimeout(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2028";
}

export const voucherStockOperationErrorCodes = {
  batchNotFound: "BATCH_NOT_FOUND",
  itemNotFound: "STOCK_ITEM_NOT_FOUND",
  invalidQuantity: "INVALID_QUANTITY",
  invalidTemplate: "INVALID_TEMPLATE",
  templateUnavailable: "TEMPLATE_UNAVAILABLE",
  templateNotAllowed: "TEMPLATE_NOT_ALLOWED",
  batchAlreadyReceived: "BATCH_ALREADY_RECEIVED",
  batchClosed: "BATCH_CLOSED",
  itemNotAvailable: "ITEM_NOT_AVAILABLE",
  itemAlreadyActivated: "ITEM_ALREADY_ACTIVATED",
  itemVoided: "ITEM_VOIDED",
  serviceNotActive: "SERVICE_NOT_ACTIVE",
  servicePriceMissing: "SERVICE_PRICE_MISSING",
  invalidValidityRange: "INVALID_VALIDITY_RANGE",
  integrityError: "INTEGRITY_ERROR",
  transientConflict: "TRANSIENT_CONFLICT",
  operationFailed: "OPERATION_FAILED",
  voidReasonRequired: "VOID_REASON_REQUIRED",
  itemNotReceived: "ITEM_NOT_RECEIVED",
} as const;

export class VoucherStockOperationError extends Error {
  constructor(
    readonly code: (typeof voucherStockOperationErrorCodes)[keyof typeof voucherStockOperationErrorCodes],
    message: string,
  ) {
    super(message);
    this.name = "VoucherStockOperationError";
  }
}

type VoucherStockBatchCreateInput = {
  templateKey: string;
  quantity: number;
  createdByUserId: string;
  now?: Date;
};

async function lockBatchNumberAllocation(tx: Prisma.TransactionClient) {
  const rows = await tx.$queryRaw<Array<{ locked: boolean }>>(Prisma.sql`
    SELECT pg_try_advisory_xact_lock(hashtext(${BATCH_NUMBER_ALLOCATION_LOCK})) AS "locked"
  `);

  if (!rows[0]?.locked) {
    throw new TransientTransactionConflictError(
      "advisory_lock_busy",
      "Voucher print batch number allocation lock is currently busy.",
    );
  }
}

async function allocateBatchNumber(tx: Prisma.TransactionClient, year: number) {
  await lockBatchNumberAllocation(tx);

  const rows = await tx.$queryRaw<Array<{ maxSequence: number | null }>>(Prisma.sql`
    SELECT COALESCE(MAX(CAST(split_part("batchNumber", '-', 2) AS INTEGER)), 0)::int AS "maxSequence"
    FROM "VoucherPrintBatch"
    WHERE "batchNumber" LIKE ${`${year}-%`}
  `);
  const nextSequence = Number(rows[0]?.maxSequence ?? 0) + 1;

  return `${year}-${String(nextSequence).padStart(3, "0")}`;
}

export async function createVoucherPrintBatch(input: VoucherStockBatchCreateInput) {
  const quantity = Number(input.quantity);

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 500) {
    throw new VoucherStockOperationError(
      voucherStockOperationErrorCodes.invalidQuantity,
      "Počet kusů musí být celé číslo od 1 do 500.",
    );
  }

  const now = input.now ?? new Date();

  for (let attempt = 0; attempt < MAX_BATCH_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await runSerializableTransaction(async (tx) => {
        const template = await tx.voucherTemplate.findUnique({ where: { key: input.templateKey } });
        if (!template) {
          throw new VoucherStockOperationError(
            voucherStockOperationErrorCodes.invalidTemplate,
            "Vybraný vzhled voucheru neexistuje.",
          );
        }
        if (template.status !== "PUBLISHED" || template.validationPolicy !== CURRENT_VOUCHER_TEMPLATE_VALIDATION_POLICY) {
          throw new VoucherStockOperationError(
            voucherStockOperationErrorCodes.templateUnavailable,
            "Vybraný vzhled není dostupný pro nové tiskové série.",
          );
        }
        if (template.allowedTypes.length === 0) {
          throw new VoucherStockOperationError(
            voucherStockOperationErrorCodes.templateNotAllowed,
            "Vybraný vzhled nepodporuje žádný aktivovatelný typ voucheru.",
          );
        }

        const batchNumber = await allocateBatchNumber(tx, getVoucherPragueCalendarYear(now));
        const batch = await tx.voucherPrintBatch.create({
          data: {
            batchNumber,
            templateKey: template.key,
            templateId: template.id,
            quantity,
            status: VoucherPrintBatchStatus.PENDING_PRINT,
            createdByUserId: input.createdByUserId,
            items: { create: await createStockItems(tx, quantity, now) },
          },
        });

        await tx.voucherStockAuditLog.create({
          data: {
            batchId: batch.id,
            actorUserId: input.createdByUserId,
            operation: VoucherStockAuditOperation.CREATE_VOUCHER_PRINT_BATCH,
            metadata: {
              batchNumber,
              templateKey: template.key,
              quantity,
            },
          },
        });

        return batch;
      }, { maxRetries: 0 });
    } catch (error) {
      if (isInteractiveTransactionTimeout(error)) {
        console.warn("Voucher print batch transaction timed out", {
          operation: "createVoucherPrintBatch",
          attempt: attempt + 1,
          prismaCode: "P2028",
        });
        throw new VoucherStockOperationError(
          voucherStockOperationErrorCodes.operationFailed,
          "Operaci se nepodařilo dokončit. Zkuste ji prosím znovu.",
        );
      }

      if (!isTransientTransactionConflict(error)) {
        throw error;
      }

      const attempts = attempt + 1;
      const category = getTransientTransactionConflictKind(error) ?? "serialization_failure";

      if (attempts < MAX_BATCH_TRANSACTION_ATTEMPTS) {
        await waitForTransientRetry(attempts);
        continue;
      }

      console.warn("Voucher print batch transient conflict exhausted", {
        operation: "createVoucherPrintBatch",
        attempts,
        category,
      });

      throw new VoucherStockOperationError(
        voucherStockOperationErrorCodes.transientConflict,
        "Operaci se kvůli souběžné změně nepodařilo dokončit. Zkuste ji prosím znovu.",
      );
    }
  }

  throw new VoucherStockOperationError(
    voucherStockOperationErrorCodes.transientConflict,
    "Operaci se kvůli souběžné změně nepodařilo dokončit. Zkuste ji prosím znovu.",
  );
}

async function createStockItems(tx: Prisma.TransactionClient, quantity: number, now: Date) {
  const codes = await allocateVoucherCodes(tx, quantity, now, { failFast: true });

  return codes.map((code, index) => ({
    sequenceNumber: index + 1,
    code,
    status: VoucherStockItemStatus.PENDING_PRINT,
    createdAt: now,
  }));
}

export async function receiveVoucherPrintBatch(input: { batchId: string; actorUserId: string; now?: Date }) {
  const now = input.now ?? new Date();

  return runSerializableTransaction(async (tx) => {
    const batch = await tx.voucherPrintBatch.findUnique({
      where: { id: input.batchId },
      select: { id: true, batchNumber: true, status: true, quantity: true },
    });

    if (!batch) {
      throw new VoucherStockOperationError(voucherStockOperationErrorCodes.batchNotFound, "Tisková série nebyla nalezena.");
    }

    if (batch.status === VoucherPrintBatchStatus.CLOSED) {
      throw new VoucherStockOperationError(voucherStockOperationErrorCodes.batchClosed, "Uzavřenou sérii nelze převzít.");
    }

    if (batch.status === VoucherPrintBatchStatus.RECEIVED) {
      return { batch, changed: false };
    }

    const receivedBatch = await tx.voucherPrintBatch.update({
      where: { id: batch.id },
      data: {
        status: VoucherPrintBatchStatus.RECEIVED,
        receivedAt: now,
        receivedByUserId: input.actorUserId,
      },
    });
    const items = await tx.voucherStockItem.updateMany({
      where: { batchId: batch.id, status: VoucherStockItemStatus.PENDING_PRINT },
      data: { status: VoucherStockItemStatus.AVAILABLE },
    });

    await tx.voucherStockAuditLog.create({
      data: {
        batchId: batch.id,
        actorUserId: input.actorUserId,
        operation: VoucherStockAuditOperation.RECEIVE_VOUCHER_PRINT_BATCH,
        metadata: { batchNumber: batch.batchNumber, availableItems: items.count },
      },
    });

    return { batch: receivedBatch, changed: true, availableItems: items.count };
  });
}

export async function voidVoucherStockItem(input: {
  stockItemId: string;
  actorUserId: string;
  reason: string;
  now?: Date;
}) {
  const reason = input.reason.trim();

  if (reason.length < 3) {
    throw new VoucherStockOperationError(voucherStockOperationErrorCodes.voidReasonRequired, "Důvod znehodnocení je povinný.");
  }

  const now = input.now ?? new Date();

  return runSerializableTransaction(async (tx) => {
    const item = await tx.voucherStockItem.findUnique({
      where: { id: input.stockItemId },
      select: { id: true, code: true, status: true, batchId: true },
    });

    if (!item) {
      throw new VoucherStockOperationError(voucherStockOperationErrorCodes.itemNotFound, "Předtištěný voucher nebyl nalezen.");
    }

    if (item.status === VoucherStockItemStatus.PENDING_PRINT) {
      throw new VoucherStockOperationError(
        voucherStockOperationErrorCodes.itemNotReceived,
        "Položku lze znehodnotit až po převzetí série.",
      );
    }

    if (item.status === VoucherStockItemStatus.ACTIVATED) {
      throw new VoucherStockOperationError(voucherStockOperationErrorCodes.itemAlreadyActivated, "Aktivovaný voucher nelze znehodnotit.");
    }

    if (item.status === VoucherStockItemStatus.VOID) {
      return { item, changed: false };
    }

    const updated = await tx.voucherStockItem.update({
      where: { id: item.id },
      data: {
        status: VoucherStockItemStatus.VOID,
        voidedAt: now,
        voidedByUserId: input.actorUserId,
        voidReason: reason,
      },
    });

    await tx.voucherStockAuditLog.create({
      data: {
        batchId: item.batchId,
        stockItemId: item.id,
        actorUserId: input.actorUserId,
        operation: VoucherStockAuditOperation.VOID_VOUCHER_STOCK_ITEM,
        metadata: { code: item.code, reason },
      },
    });

    return { item: updated, changed: true };
  });
}

export async function closeVoucherPrintBatch(input: { batchId: string; actorUserId: string; now?: Date }) {
  const now = input.now ?? new Date();

  return runSerializableTransaction(async (tx) => {
    const batch = await tx.voucherPrintBatch.findUnique({
      where: { id: input.batchId },
      select: { id: true, batchNumber: true, status: true },
    });

    if (!batch) {
      throw new VoucherStockOperationError(voucherStockOperationErrorCodes.batchNotFound, "Tisková série nebyla nalezena.");
    }

    if (batch.status === VoucherPrintBatchStatus.CLOSED) {
      return { batch, changed: false, voidedItems: 0 };
    }

    const voidedItems = await tx.voucherStockItem.updateMany({
      where: {
        batchId: batch.id,
        status: { in: [VoucherStockItemStatus.PENDING_PRINT, VoucherStockItemStatus.AVAILABLE] },
      },
      data: {
        status: VoucherStockItemStatus.VOID,
        voidedAt: now,
        voidedByUserId: input.actorUserId,
        voidReason: "Série uzavřena",
      },
    });
    const closedBatch = await tx.voucherPrintBatch.update({
      where: { id: batch.id },
      data: {
        status: VoucherPrintBatchStatus.CLOSED,
        closedAt: now,
        closedByUserId: input.actorUserId,
      },
    });

    await tx.voucherStockAuditLog.create({
      data: {
        batchId: batch.id,
        actorUserId: input.actorUserId,
        operation: VoucherStockAuditOperation.CLOSE_VOUCHER_PRINT_BATCH,
        metadata: { batchNumber: batch.batchNumber, voidedItems: voidedItems.count },
      },
    });

    return { batch: closedBatch, changed: true, voidedItems: voidedItems.count };
  });
}

export async function findVoucherStockItemByCode(codeInput: string) {
  const code = normalizeVoucherCode(codeInput);

  if (!code) {
    return null;
  }

  return prisma.voucherStockItem.findUnique({
    where: { code },
    include: {
      batch: { select: { id: true, batchNumber: true, templateKey: true, quantity: true, status: true } },
      voucher: { select: { id: true } },
    },
  });
}

type ActivateVoucherStockItemOperationInput = ActivateVoucherStockItemInput & {
  actorUserId: string;
  validityMonths?: number;
  now?: Date;
};

export async function activateVoucherStockItem(input: ActivateVoucherStockItemOperationInput) {
  const parsed = activateVoucherStockItemSchema.parse(input);
  const settings = input.validityMonths === undefined ? await getSiteSettings() : null;
  const validityMonths = input.validityMonths ?? settings?.voucherDefaultValidityMonths ?? 12;
  const now = input.now ?? new Date();
  const validFrom = parsed.validFrom ?? getVoucherPragueDateBoundary(now, "start");
  const validUntil = parsed.validUntil ?? addVoucherValidityMonths(validFrom, validityMonths, "end");

  if (validUntil <= validFrom) {
    throw new VoucherStockOperationError(voucherStockOperationErrorCodes.invalidValidityRange, "Platnost do musí být po datu aktivace.");
  }

  const code = normalizeVoucherCode(parsed.code);

  return runSerializableTransaction(async (tx) => {
    const stockItem = await tx.voucherStockItem.findUnique({
      where: { code },
      include: { batch: true },
    });

    if (!stockItem) {
      throw new VoucherStockOperationError(voucherStockOperationErrorCodes.itemNotFound, "Předtištěný voucher nebyl nalezen.");
    }

    if (stockItem.status === VoucherStockItemStatus.ACTIVATED) {
      if (stockItem.voucherId) {
        return { kind: "already_activated" as const, voucherId: stockItem.voucherId, code: stockItem.code };
      }

      throw new VoucherStockOperationError(voucherStockOperationErrorCodes.integrityError, "Aktivovaný kus nemá navázaný voucher.");
    }

    if (stockItem.status === VoucherStockItemStatus.VOID) {
      throw new VoucherStockOperationError(voucherStockOperationErrorCodes.itemVoided, "Znehodnocený voucher nelze aktivovat.");
    }

    if (stockItem.status !== VoucherStockItemStatus.AVAILABLE || stockItem.batch.status !== VoucherPrintBatchStatus.RECEIVED) {
      throw new VoucherStockOperationError(voucherStockOperationErrorCodes.itemNotAvailable, "Voucher zatím není připravený k aktivaci.");
    }

    const template = stockItem.batch.templateId
      ? await tx.voucherTemplate.findUnique({ where: { id: stockItem.batch.templateId } })
      : null;
    if (!template) {
      throw new VoucherStockOperationError(voucherStockOperationErrorCodes.invalidTemplate, "Historický vzhled voucheru už není dostupný.");
    }

    if (template.status === "DRAFT") {
      throw new VoucherStockOperationError(
        voucherStockOperationErrorCodes.templateUnavailable,
        "Vybraný vzhled ještě není publikovaný a nelze jej použít k aktivaci.",
      );
    }

    if (!template.allowedTypes.includes(parsed.type)) {
      throw new VoucherStockOperationError(voucherStockOperationErrorCodes.templateNotAllowed, "Tento vzhled nepodporuje vybraný typ voucheru.");
    }

    const existingVoucher = await tx.voucher.findUnique({ where: { code }, select: { id: true } });
    if (existingVoucher) {
      throw new VoucherStockOperationError(voucherStockOperationErrorCodes.integrityError, "Kód předtištěného voucheru už používá jiný voucher.");
    }

    let service: {
      id: string;
      name: string;
      publicName: string | null;
      priceFromCzk: number | null;
      durationMinutes: number;
      isActive: boolean;
    } | null = null;

    if (parsed.type === VoucherType.SERVICE) {
      service = await tx.service.findUnique({
        where: { id: parsed.serviceId },
        select: { id: true, name: true, publicName: true, priceFromCzk: true, durationMinutes: true, isActive: true },
      });

      if (!service || !service.isActive) {
        throw new VoucherStockOperationError(voucherStockOperationErrorCodes.serviceNotActive, "Vybraná služba už není aktivní.");
      }

      if (service.priceFromCzk === null) {
        throw new VoucherStockOperationError(
          voucherStockOperationErrorCodes.servicePriceMissing,
          "Vybraná služba nemá nastavenou cenu a nelze ji použít pro voucher.",
        );
      }
    }

    const claimed = await tx.voucherStockItem.updateMany({
      where: { id: stockItem.id, status: VoucherStockItemStatus.AVAILABLE },
      data: {
        status: VoucherStockItemStatus.ACTIVATED,
        activatedAt: now,
        activatedByUserId: input.actorUserId,
      },
    });

    if (claimed.count !== 1) {
      const current = await tx.voucherStockItem.findUnique({ where: { id: stockItem.id }, select: { status: true, voucherId: true } });
      if (current?.status === VoucherStockItemStatus.ACTIVATED && current.voucherId) {
        return { kind: "already_activated" as const, voucherId: current.voucherId, code };
      }

      throw new VoucherStockOperationError(voucherStockOperationErrorCodes.itemNotAvailable, "Voucher už mezitím změnil stav.");
    }

    const voucher = await tx.voucher.create({
      data: parsed.type === VoucherType.VALUE
        ? {
            code,
            type: VoucherType.VALUE,
            templateKey: stockItem.batch.templateKey,
            templateId: stockItem.batch.templateId,
            status: VoucherStatus.ACTIVE,
            originalValueCzk: parsed.originalValueCzk,
            remainingValueCzk: parsed.originalValueCzk,
            validFrom,
            validUntil,
            issuedAt: now,
            renderPolicy: STRICT_VOUCHER_RENDER_POLICY,
            createdByUserId: input.actorUserId,
          }
        : {
            code,
            type: VoucherType.SERVICE,
            templateKey: stockItem.batch.templateKey,
            templateId: stockItem.batch.templateId,
            status: VoucherStatus.ACTIVE,
            originalValueCzk: service!.priceFromCzk,
            remainingValueCzk: null,
            serviceId: service?.id,
            serviceNameSnapshot: service?.publicName ?? service?.name,
            servicePriceSnapshotCzk: service!.priceFromCzk,
            serviceDurationSnapshot: service?.durationMinutes,
            validFrom,
            validUntil,
            issuedAt: now,
            renderPolicy: STRICT_VOUCHER_RENDER_POLICY,
            createdByUserId: input.actorUserId,
          },
    });
    await tx.voucherStockItem.update({
      where: { id: stockItem.id },
      data: { voucherId: voucher.id },
    });
    await tx.voucherStockAuditLog.create({
      data: {
        batchId: stockItem.batchId,
        stockItemId: stockItem.id,
        actorUserId: input.actorUserId,
        operation: VoucherStockAuditOperation.ACTIVATE_VOUCHER_STOCK_ITEM,
        metadata: { code, voucherId: voucher.id, type: parsed.type },
      },
    });

    return {
      kind: "activated" as const,
      voucherId: voucher.id,
      code,
      type: voucher.type,
      originalValueCzk: voucher.originalValueCzk,
      serviceNameSnapshot: voucher.serviceNameSnapshot,
      servicePriceSnapshotCzk: voucher.servicePriceSnapshotCzk,
      validFrom,
      validUntil,
    };
  });
}
