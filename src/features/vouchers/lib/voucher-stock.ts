import {
  Prisma,
  VoucherPrintBatchStatus,
  VoucherStatus,
  VoucherStockAuditOperation,
  VoucherStockItemStatus,
  VoucherType,
} from "@/generated/prisma/client";

import { allocateVoucherCode, normalizeVoucherCode } from "@/features/vouchers/lib/voucher-code";
import {
  getVoucherTemplate,
  isVoucherTemplateAllowedForType,
  voucherTemplateRegistry,
  type VoucherTemplateRegistry,
} from "@/features/vouchers/lib/voucher-template-registry";
import { addVoucherValidityMonths } from "@/features/vouchers/lib/voucher-validity-date";
import {
  activateVoucherStockItemSchema,
  type ActivateVoucherStockItemInput,
} from "@/features/vouchers/schemas/voucher-schemas";
import { getSiteSettings } from "@/lib/site-settings";
import { prisma } from "@/lib/prisma";
import { runSerializableTransaction } from "@/lib/serializable-transaction";

const BATCH_NUMBER_ALLOCATION_LOCK = "ppstudio:voucher-print-batch-number-v1";
const MAX_BATCH_CREATE_RETRIES = 3;

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
  invalidValidityRange: "INVALID_VALIDITY_RANGE",
  integrityError: "INTEGRITY_ERROR",
  voidReasonRequired: "VOID_REASON_REQUIRED",
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
  registry?: VoucherTemplateRegistry;
};

function isUniqueConstraint(error: unknown, field: string) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError
    && error.code === "P2002"
    && Array.isArray(error.meta?.target)
    && error.meta.target.includes(field)
  );
}

async function lockBatchNumberAllocation(tx: Prisma.TransactionClient) {
  await tx.$executeRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(hashtext(${BATCH_NUMBER_ALLOCATION_LOCK}))
  `);
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

  const registry = input.registry ?? voucherTemplateRegistry;
  const template = registry.get(input.templateKey);

  if (!template) {
    throw new VoucherStockOperationError(
      voucherStockOperationErrorCodes.invalidTemplate,
      "Vybraný vzhled voucheru neexistuje.",
    );
  }

  if (!template.activeForNewVouchers) {
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

  const now = input.now ?? new Date();

  for (let attempt = 0; attempt < MAX_BATCH_CREATE_RETRIES; attempt += 1) {
    try {
      return await runSerializableTransaction(async (tx) => {
        const batchNumber = await allocateBatchNumber(tx, now.getFullYear());
        const batch = await tx.voucherPrintBatch.create({
          data: {
            batchNumber,
            templateKey: template.key,
            quantity,
            status: VoucherPrintBatchStatus.PENDING_PRINT,
            createdByUserId: input.createdByUserId,
            items: {
              create: await createStockItems(tx, quantity, now),
            },
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
      });
    } catch (error) {
      if (isUniqueConstraint(error, "batchNumber") || isUniqueConstraint(error, "code")) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("Voucher print batch could not be created safely.");
}

async function createStockItems(tx: Prisma.TransactionClient, quantity: number, now: Date) {
  const items: Array<{
    sequenceNumber: number;
    code: string;
    status: VoucherStockItemStatus;
    createdAt: Date;
  }> = [];

  for (let sequenceNumber = 1; sequenceNumber <= quantity; sequenceNumber += 1) {
    items.push({
      sequenceNumber,
      code: await allocateVoucherCode(tx, now),
      status: VoucherStockItemStatus.PENDING_PRINT,
      createdAt: now,
    });
  }

  return items;
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
  const validFrom = parsed.validFrom ?? now;
  const validUntil = parsed.validUntil ?? addVoucherValidityMonths(validFrom, validityMonths);

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

    const template = getVoucherTemplate(stockItem.batch.templateKey);
    if (!template) {
      throw new VoucherStockOperationError(voucherStockOperationErrorCodes.invalidTemplate, "Historický vzhled voucheru už není v registru.");
    }

    if (!isVoucherTemplateAllowedForType(template, parsed.type)) {
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

      if (!service?.isActive) {
        throw new VoucherStockOperationError(voucherStockOperationErrorCodes.serviceNotActive, "Vybraná služba už není aktivní.");
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
            status: VoucherStatus.ACTIVE,
            originalValueCzk: parsed.originalValueCzk,
            remainingValueCzk: parsed.originalValueCzk,
            validFrom,
            validUntil,
            issuedAt: now,
            createdByUserId: input.actorUserId,
          }
        : {
            code,
            type: VoucherType.SERVICE,
            templateKey: stockItem.batch.templateKey,
            status: VoucherStatus.ACTIVE,
            originalValueCzk: service?.priceFromCzk ?? null,
            remainingValueCzk: null,
            serviceId: service?.id,
            serviceNameSnapshot: service?.publicName ?? service?.name,
            servicePriceSnapshotCzk: service?.priceFromCzk ?? null,
            serviceDurationSnapshot: service?.durationMinutes,
            validFrom,
            validUntil,
            issuedAt: now,
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

    return { kind: "activated" as const, voucherId: voucher.id, code, validFrom, validUntil };
  });
}
