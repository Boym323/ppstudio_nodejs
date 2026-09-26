import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { AdminRole, VoucherStockItemStatus, VoucherTemplateStatus, VoucherType } from "@/generated/prisma/browser";
import { Prisma } from "@/generated/prisma/client";
import { defaultVoucherTemplateLayout } from "./voucher-template-defaults";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.EMAIL_DELIVERY_MODE ??= "log";

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

type BatchProfile = {
  transactionAttempts: number;
  roundTrips: number;
  allocatorQueries: number;
};

function instrumentBatchTransactions(
  prisma: { $transaction: unknown },
  profile: BatchProfile,
) {
  const client = prisma as {
    $transaction: (...args: unknown[]) => Promise<unknown>;
  };
  const originalTransaction = client.$transaction;

  Object.defineProperty(client, "$transaction", {
    configurable: true,
    writable: true,
    value: async function (operation: (tx: unknown) => Promise<unknown>, options?: unknown) {
      profile.transactionAttempts += 1;
      return originalTransaction.call(this, async (tx: Record<string, unknown>) => {
        const wrapped = new Proxy(tx, {
          get(target, property, receiver) {
            if (property === "$queryRaw" || property === "$executeRaw") {
              const raw = Reflect.get(target, property, receiver) as (...args: unknown[]) => Promise<unknown>;
              return (...args: unknown[]) => {
                profile.roundTrips += 1;
                return raw.apply(target, args);
              };
            }

            const model = Reflect.get(target, property, receiver);
            if (!model || typeof model !== "object" || !["voucher", "voucherStockItem", "voucherPrintBatch", "voucherStockAuditLog"].includes(String(property))) {
              return model;
            }

            return new Proxy(model, {
              get(modelTarget, method, modelReceiver) {
                const value = Reflect.get(modelTarget, method, modelReceiver);
                if (typeof value !== "function") {
                  return value;
                }

                return (...args: unknown[]) => {
                  profile.roundTrips += 1;
                  if (method === "findMany") {
                    profile.allocatorQueries += 1;
                  }
                  return value.apply(modelTarget, args);
                };
              },
            });
          },
        });

        return operation(wrapped);
      }, options);
    },
  });

  return () => {
    Object.defineProperty(client, "$transaction", {
      configurable: true,
      writable: true,
      value: originalTransaction,
    });
  };
}

dbTest("Voucher Stock: code i batch používají rok Europe/Prague po novoročním přelomu", async () => {
  const [{ prisma }, stock] = await Promise.all([
    import("@/lib/prisma"),
    import("./voucher-stock"),
  ]);
  const suffix = randomUUID().slice(0, 8);
  const owner = await prisma.adminUser.create({ data: { email: `stock-year-${suffix}@example.com`, name: "Stock year owner", role: AdminRole.OWNER } });
  const batch = await stock.createVoucherPrintBatch({
    templateKey: "classic-v1",
    quantity: 2,
    createdByUserId: owner.id,
    now: new Date("2026-12-31T23:30:00.000Z"),
  });

  try {
    const items = await prisma.voucherStockItem.findMany({ where: { batchId: batch.id }, orderBy: { sequenceNumber: "asc" } });
    assert.match(batch.batchNumber, /^2027-\d{3}$/);
    assert.equal(items.every((item) => /^PP-2027-[A-Z2-9]{6}$/.test(item.code)), true);
  } finally {
    await prisma.voucherStockAuditLog.deleteMany({ where: { batchId: batch.id } });
    await prisma.voucherStockItem.deleteMany({ where: { batchId: batch.id } });
    await prisma.voucherPrintBatch.delete({ where: { id: batch.id } });
    await prisma.adminUser.delete({ where: { id: owner.id } });
  }
});

dbTest("Voucher Stock: batch, receive, VALUE activation, idempotence, VOID a close", async () => {
  const [{ prisma }, stock, { createVoucher }] = await Promise.all([
    import("@/lib/prisma"),
    import("./voucher-stock"),
    import("./voucher-management"),
  ]);
  const suffix = randomUUID().slice(0, 8);
  const owner = await prisma.adminUser.create({ data: { email: `stock-owner-${suffix}@example.com`, name: "Stock owner", role: AdminRole.OWNER } });
  const batch = await stock.createVoucherPrintBatch({ templateKey: "classic-v1", quantity: 3, createdByUserId: owner.id });
  let normalVoucherId: string | null = null;

  try {
    const createdItems = await prisma.voucherStockItem.findMany({ where: { batchId: batch.id }, orderBy: { sequenceNumber: "asc" } });
    assert.equal(createdItems.length, 3);
    assert.deepEqual(createdItems.map((item) => item.sequenceNumber), [1, 2, 3]);
    assert.equal(new Set(createdItems.map((item) => item.code)).size, 3);
    assert.equal(createdItems.every((item) => item.status === VoucherStockItemStatus.PENDING_PRINT), true);
    await assert.rejects(
      () => stock.voidVoucherStockItem({ stockItemId: createdItems[2].id, actorUserId: owner.id, reason: "Vadný tisk" }),
      (error: unknown) => error instanceof stock.VoucherStockOperationError
        && error.code === stock.voucherStockOperationErrorCodes.itemNotReceived,
    );
    assert.equal((await prisma.voucherStockItem.findUniqueOrThrow({ where: { id: createdItems[2].id } })).status, VoucherStockItemStatus.PENDING_PRINT);

    const normalVoucher = await createVoucher({
      type: VoucherType.VALUE,
      templateKey: "classic-v1",
      originalValueCzk: 700,
      validFrom: new Date("2026-09-17T10:00:00.000Z"),
    }, owner.id);
    normalVoucherId = normalVoucher.id;
    assert.equal(createdItems.some((item) => item.code === normalVoucher.code), false);

    const pendingVerification = await stock.findVoucherStockItemByCode(createdItems[0].code);
    assert.equal(pendingVerification?.status, VoucherStockItemStatus.PENDING_PRINT);
    const publicVerification = await (await import("./voucher-validation")).verifyVoucherPublic({ code: createdItems[0].code });
    assert.deepEqual(publicVerification, { ok: false, reason: "NOT_ACTIVATED" });

    await stock.receiveVoucherPrintBatch({ batchId: batch.id, actorUserId: owner.id, now: new Date("2026-09-17T11:00:00.000Z") });
    const receivedAgain = await stock.receiveVoucherPrintBatch({ batchId: batch.id, actorUserId: owner.id });
    assert.equal(receivedAgain.changed, false);

    const activated = await stock.activateVoucherStockItem({
      code: createdItems[0].code,
      type: VoucherType.VALUE,
      originalValueCzk: 1500,
      actorUserId: owner.id,
      validFrom: new Date("2026-09-17T12:00:00.000Z"),
      validUntil: new Date("2027-09-17T12:00:00.000Z"),
    });
    assert.equal(activated.kind, "activated");
    assert.equal(activated.code, createdItems[0].code);
    const activatedVoucher = await prisma.voucher.findUniqueOrThrow({ where: { id: activated.voucherId } });
    const activatedItem = await prisma.voucherStockItem.findUniqueOrThrow({ where: { id: createdItems[0].id } });
    assert.equal(activatedVoucher.code, createdItems[0].code);
    assert.equal(activatedVoucher.templateKey, "classic-v1");
    assert.equal(activatedVoucher.originalValueCzk, 1500);
    assert.equal(activatedItem.status, VoucherStockItemStatus.ACTIVATED);
    assert.equal(activatedItem.voucherId, activatedVoucher.id);

    const defaultDatesActivation = await stock.activateVoucherStockItem({
      code: createdItems[1].code,
      type: VoucherType.VALUE,
      originalValueCzk: 900,
      actorUserId: owner.id,
      validityMonths: 1,
      now: new Date("2026-01-30T23:00:00.000Z"),
    });
    assert.equal(defaultDatesActivation.kind, "activated");
    const defaultDatesVoucher = await prisma.voucher.findUniqueOrThrow({ where: { id: defaultDatesActivation.voucherId } });
    assert.equal(defaultDatesVoucher.validFrom.toISOString(), "2026-01-30T23:00:00.000Z");
    assert.equal(defaultDatesVoucher.validUntil?.toISOString(), "2026-02-28T22:59:59.999Z");

    const repeated = await stock.activateVoucherStockItem({ code: createdItems[0].code, type: VoucherType.VALUE, originalValueCzk: 999, actorUserId: owner.id });
    assert.equal(repeated.kind, "already_activated");
    assert.equal(repeated.voucherId, activatedVoucher.id);
    assert.equal(await prisma.voucher.count({ where: { code: createdItems[0].code } }), 1);

    await stock.voidVoucherStockItem({ stockItemId: createdItems[2].id, actorUserId: owner.id, reason: "Vadný tisk" });
    const voidVerification = await (await import("./voucher-validation")).verifyVoucherPublic({ code: createdItems[2].code });
    assert.deepEqual(voidVerification, { ok: false, reason: "STOCK_VOID" });
    await assert.rejects(
      () => stock.activateVoucherStockItem({ code: createdItems[2].code, type: VoucherType.VALUE, originalValueCzk: 100, actorUserId: owner.id }),
      (error: unknown) => error instanceof stock.VoucherStockOperationError && error.code === stock.voucherStockOperationErrorCodes.itemVoided,
    );

    await stock.closeVoucherPrintBatch({ batchId: batch.id, actorUserId: owner.id });
    const finalItems = await prisma.voucherStockItem.findMany({ where: { batchId: batch.id } });
    assert.equal(finalItems.filter((item) => item.status === VoucherStockItemStatus.ACTIVATED).length, 2);
    assert.equal(finalItems.filter((item) => item.status === VoucherStockItemStatus.VOID).length, 1);
  } finally {
    await prisma.voucherStockAuditLog.deleteMany({ where: { batchId: batch.id } });
    await prisma.voucherStockItem.deleteMany({ where: { batchId: batch.id } });
    await prisma.voucher.deleteMany({ where: { id: { in: [normalVoucherId].filter((id): id is string => id !== null) } } });
    await prisma.voucherPrintBatch.delete({ where: { id: batch.id } });
    await prisma.adminUser.delete({ where: { id: owner.id } });
  }
});

dbTest("Voucher Stock: převzatý kus lze aktivovat i po deaktivaci jeho immutable šablony", async () => {
  const [{ prisma }, stock] = await Promise.all([
    import("@/lib/prisma"),
    import("./voucher-stock"),
  ]);
  const suffix = randomUUID().slice(0, 8);
  const owner = await prisma.adminUser.create({ data: { email: `stock-inactive-${suffix}@example.com`, name: "Stock inactive owner", role: AdminRole.OWNER } });
  const familyKey = `stock-inactive-${suffix}`;
  const template = await prisma.voucherTemplate.create({
    data: {
      key: `${familyKey}-v1`,
      familyKey,
      version: 1,
      label: "Stock inactive template",
      status: VoucherTemplateStatus.PUBLISHED,
      validationPolicy: "STRICT_V1",
      allowedTypes: [VoucherType.VALUE],
      layout: defaultVoucherTemplateLayout,
    },
  });
  const batch = await stock.createVoucherPrintBatch({ templateKey: template.key, quantity: 1, createdByUserId: owner.id });
  let voucherId: string | null = null;

  try {
    const item = await prisma.voucherStockItem.findFirstOrThrow({ where: { batchId: batch.id } });
    await stock.receiveVoucherPrintBatch({ batchId: batch.id, actorUserId: owner.id });
    await prisma.voucherTemplate.update({ where: { id: template.id }, data: { status: VoucherTemplateStatus.INACTIVE } });

    const activated = await stock.activateVoucherStockItem({
      code: item.code,
      type: VoucherType.VALUE,
      originalValueCzk: 1200,
      actorUserId: owner.id,
    });
    assert.equal(activated.kind, "activated");
    voucherId = activated.voucherId;
    const voucher = await prisma.voucher.findUniqueOrThrow({ where: { id: activated.voucherId } });
    assert.equal(voucher.templateId, template.id);
  } finally {
    await prisma.voucherStockAuditLog.deleteMany({ where: { batchId: batch.id } });
    await prisma.voucherStockItem.deleteMany({ where: { batchId: batch.id } });
    if (voucherId) await prisma.voucher.delete({ where: { id: voucherId } });
    await prisma.voucherPrintBatch.delete({ where: { id: batch.id } });
    await prisma.voucherTemplate.delete({ where: { id: template.id } });
    await prisma.adminUser.delete({ where: { id: owner.id } });
  }
});

dbTest("Voucher Stock: SERVICE activation requires a fixed price and stores the price snapshot", async () => {
  const [{ prisma }, stock] = await Promise.all([
    import("@/lib/prisma"),
    import("./voucher-stock"),
  ]);
  const suffix = randomUUID().slice(0, 8);
  const owner = await prisma.adminUser.create({ data: { email: `stock-service-${suffix}@example.com`, name: "Stock service owner", role: AdminRole.OWNER } });
  const category = await prisma.serviceCategory.create({ data: { name: `Stock service category ${suffix}`, slug: `stock-service-category-${suffix}` } });
  const [noPriceService, fixedPriceService] = await Promise.all([
    prisma.service.create({
      data: {
        categoryId: category.id,
        name: "Služba bez ceny",
        slug: `stock-no-price-${suffix}`,
        durationMinutes: 60,
        priceFromCzk: null,
        isActive: true,
      },
    }),
    prisma.service.create({
      data: {
        categoryId: category.id,
        name: "Služba s cenou",
        slug: `stock-fixed-price-${suffix}`,
        durationMinutes: 90,
        priceFromCzk: 1800,
        isActive: true,
      },
    }),
  ]);
  const batch = await stock.createVoucherPrintBatch({ templateKey: "classic-v1", quantity: 2, createdByUserId: owner.id });

  try {
    const items = await prisma.voucherStockItem.findMany({ where: { batchId: batch.id }, orderBy: { sequenceNumber: "asc" } });
    await stock.receiveVoucherPrintBatch({ batchId: batch.id, actorUserId: owner.id });

    await assert.rejects(
      () => stock.activateVoucherStockItem({
        code: items[0]!.code,
        type: VoucherType.SERVICE,
        serviceId: noPriceService.id,
        actorUserId: owner.id,
        validFrom: new Date("2026-09-19T00:00:00.000Z"),
        validUntil: new Date("2027-09-19T21:59:59.999Z"),
      }),
      (error: unknown) => error instanceof stock.VoucherStockOperationError
        && error.code === stock.voucherStockOperationErrorCodes.servicePriceMissing,
    );
    assert.equal((await prisma.voucherStockItem.findUniqueOrThrow({ where: { id: items[0]!.id } })).status, VoucherStockItemStatus.AVAILABLE);

    const activated = await stock.activateVoucherStockItem({
      code: items[1]!.code,
      type: VoucherType.SERVICE,
      serviceId: fixedPriceService.id,
      actorUserId: owner.id,
      validFrom: new Date("2026-09-19T00:00:00.000Z"),
      validUntil: new Date("2027-09-19T21:59:59.999Z"),
    });
    assert.equal(activated.kind, "activated");
    const voucher = await prisma.voucher.findUniqueOrThrow({ where: { id: activated.voucherId } });
    assert.equal(voucher.servicePriceSnapshotCzk, 1800);
    assert.equal(voucher.originalValueCzk, 1800);
  } finally {
    await prisma.voucherStockAuditLog.deleteMany({ where: { batchId: batch.id } });
    await prisma.voucherStockItem.updateMany({ where: { batchId: batch.id }, data: { voucherId: null } });
    await prisma.voucher.deleteMany({ where: { createdByUserId: owner.id } });
    await prisma.voucherStockItem.deleteMany({ where: { batchId: batch.id } });
    await prisma.voucherPrintBatch.delete({ where: { id: batch.id } });
    await prisma.service.deleteMany({ where: { id: { in: [noPriceService.id, fixedPriceService.id] } } });
    await prisma.serviceCategory.delete({ where: { id: category.id } });
    await prisma.adminUser.delete({ where: { id: owner.id } });
  }
});

dbTest("Voucher code invariant chrání cross-table kolize a legitimní aktivace", async () => {
  const { prisma } = await import("@/lib/prisma");

  const [codeCollisions, invalidActivatedLinks, unexpectedLinks, duplicateVoucherCodes, duplicateStockCodes, duplicateVoucherLinks] = await Promise.all([
    prisma.$queryRaw<Array<{ voucherId: string; stockItemId: string }>>(Prisma.sql`
      SELECT v."id" AS "voucherId", s."id" AS "stockItemId"
      FROM "Voucher" v
      JOIN "VoucherStockItem" s ON s."code" = v."code"
      WHERE NOT (s."status" = 'ACTIVATED' AND s."voucherId" = v."id")
    `),
    prisma.$queryRaw<Array<{ stockItemId: string }>>(Prisma.sql`
      SELECT s."id" AS "stockItemId"
      FROM "VoucherStockItem" s
      LEFT JOIN "Voucher" v ON v."id" = s."voucherId"
      WHERE s."status" = 'ACTIVATED'
        AND (s."voucherId" IS NULL OR v."id" IS NULL OR v."code" <> s."code")
    `),
    prisma.$queryRaw<Array<{ stockItemId: string }>>(Prisma.sql`
      SELECT "id" AS "stockItemId"
      FROM "VoucherStockItem"
      WHERE "status" IN ('AVAILABLE', 'PENDING_PRINT', 'VOID')
        AND "voucherId" IS NOT NULL
    `),
    prisma.$queryRaw<Array<{ code: string }>>(Prisma.sql`
      SELECT "code"
      FROM "Voucher"
      GROUP BY "code"
      HAVING COUNT(*) > 1
    `),
    prisma.$queryRaw<Array<{ code: string }>>(Prisma.sql`
      SELECT "code"
      FROM "VoucherStockItem"
      GROUP BY "code"
      HAVING COUNT(*) > 1
    `),
    prisma.$queryRaw<Array<{ voucherId: string }>>(Prisma.sql`
      SELECT "voucherId"
      FROM "VoucherStockItem"
      WHERE "voucherId" IS NOT NULL
      GROUP BY "voucherId"
      HAVING COUNT(*) > 1
    `),
  ]);

  assert.deepEqual(codeCollisions, []);
  assert.deepEqual(invalidActivatedLinks, []);
  assert.deepEqual(unexpectedLinks, []);
  assert.deepEqual(duplicateVoucherCodes, []);
  assert.deepEqual(duplicateStockCodes, []);
  assert.deepEqual(duplicateVoucherLinks, []);

  const activatedItems = await prisma.voucherStockItem.findMany({
    where: { status: VoucherStockItemStatus.ACTIVATED },
    select: { code: true, voucherId: true, voucher: { select: { id: true, code: true } } },
  });

  for (const item of activatedItems) {
    assert.ok(item.voucherId);
    assert.ok(item.voucher);
    assert.equal(item.voucher.id, item.voucherId);
    assert.equal(item.voucher.code, item.code);
  }
});

dbTest("Voucher Stock: souběžné batch creation zachová unikátní série, kódy a audit", async () => {
  const [{ prisma }, stock] = await Promise.all([
    import("@/lib/prisma"),
    import("./voucher-stock"),
  ]);
  const suffix = randomUUID().slice(0, 8);
  const owner = await prisma.adminUser.create({ data: { email: `stock-concurrency-${suffix}@example.com`, name: "Stock concurrency owner", role: AdminRole.OWNER } });
  const now = new Date("2026-09-20T10:00:00.000Z");

  try {
    for (const requestCount of [2, 12, 50]) {
      const results = await Promise.allSettled(
        Array.from({ length: requestCount }, () => stock.createVoucherPrintBatch({
          templateKey: "classic-v1",
          quantity: 1,
          createdByUserId: owner.id,
          now,
        })),
      );
      const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
      const batches = results
        .filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof stock.createVoucherPrintBatch>>> => result.status === "fulfilled")
        .map((result) => result.value);
      const controlledFailures = failures.filter((failure) => failure.reason instanceof stock.VoucherStockOperationError);
      const rawFailures = failures.filter((failure) => !(failure.reason instanceof stock.VoucherStockOperationError));

      assert.equal(rawFailures.length, 0, rawFailures.map((failure) => String(failure.reason)).join("\n"));
      if (requestCount < 50) {
        assert.equal(controlledFailures.length, 0, failures.map((failure) => String(failure.reason)).join("\n"));
      }
      assert.equal(batches.length + controlledFailures.length, requestCount);
      console.info("Voucher batch concurrency", {
        requestCount,
        success: batches.length,
        controlledFailures: controlledFailures.length,
        rawFailures: rawFailures.length,
      });
    }

    const persistedBatches = await prisma.voucherPrintBatch.findMany({
      where: { createdByUserId: owner.id },
      select: { id: true, batchNumber: true, quantity: true },
    });
    const persistedBatchIds = persistedBatches.map((batch) => batch.id);
    const items = await prisma.voucherStockItem.findMany({
      where: { batchId: { in: persistedBatchIds } },
      select: { batchId: true, code: true },
    });
    const auditLogs = await prisma.voucherStockAuditLog.findMany({
      where: {
        batchId: { in: persistedBatchIds },
        operation: "CREATE_VOUCHER_PRINT_BATCH",
      },
      select: { batchId: true },
    });

    assert.equal(new Set(persistedBatches.map((batch) => batch.batchNumber)).size, persistedBatches.length);
    assert.equal(items.length, persistedBatches.reduce((sum, batch) => sum + batch.quantity, 0));
    assert.equal(new Set(items.map((item) => item.code)).size, items.length);
    assert.equal(auditLogs.length, persistedBatches.length);
    assert.equal(new Set(auditLogs.map((log) => log.batchId)).size, persistedBatches.length);
    assert.equal(
      (await prisma.voucherStockAuditLog.count({ where: { batchId: { in: persistedBatchIds }, operation: "CREATE_VOUCHER_PRINT_BATCH" } })),
      persistedBatches.length,
    );
  } finally {
    const persistedBatches = await prisma.voucherPrintBatch.findMany({ where: { createdByUserId: owner.id }, select: { id: true } });
    const persistedBatchIds = persistedBatches.map((batch) => batch.id);
    await prisma.voucherStockAuditLog.deleteMany({ where: { batchId: { in: persistedBatchIds } } });
    await prisma.voucherStockItem.deleteMany({ where: { batchId: { in: persistedBatchIds } } });
    await prisma.voucherPrintBatch.deleteMany({ where: { id: { in: persistedBatchIds } } });
    await prisma.adminUser.delete({ where: { id: owner.id } });
  }
});

dbTest("Voucher Stock: quantity 25/50/100/500 proběhne atomicky s dávkovým allocatorem", async () => {
  const [{ prisma }, stock] = await Promise.all([
    import("@/lib/prisma"),
    import("./voucher-stock"),
  ]);
  const suffix = randomUUID().slice(0, 8);
  const owner = await prisma.adminUser.create({ data: { email: `stock-large-${suffix}@example.com`, name: "Stock large owner", role: AdminRole.OWNER } });

  try {
    for (const quantity of [25, 50, 100, 500]) {
      const profile: BatchProfile = { transactionAttempts: 0, roundTrips: 0, allocatorQueries: 0 };
      const restoreInstrumentation = instrumentBatchTransactions(prisma, profile);
      const startedAt = performance.now();
      let batch: Awaited<ReturnType<typeof stock.createVoucherPrintBatch>>;

      try {
        batch = await stock.createVoucherPrintBatch({
          templateKey: "classic-v1",
          quantity,
          createdByUserId: owner.id,
          now: new Date("2026-09-20T10:00:00.000Z"),
        });
      } finally {
        restoreInstrumentation();
      }

      const durationMs = Math.round(performance.now() - startedAt);
      const [items, auditCount, crossTableCollisions] = await Promise.all([
        prisma.voucherStockItem.findMany({ where: { batchId: batch.id }, select: { code: true } }),
        prisma.voucherStockAuditLog.count({ where: { batchId: batch.id, operation: "CREATE_VOUCHER_PRINT_BATCH" } }),
        prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
          SELECT COUNT(*)::bigint AS count
          FROM "VoucherStockItem" stock
          INNER JOIN "Voucher" voucher ON voucher."code" = stock."code"
          WHERE stock."batchId" = ${batch.id}
        `),
      ]);

      assert.equal(batch.quantity, quantity);
      assert.equal(items.length, quantity);
      assert.equal(new Set(items.map((item) => item.code)).size, quantity);
      assert.equal(auditCount, 1);
      assert.equal(Number(crossTableCollisions[0]?.count ?? 0), 0);
      assert.equal(profile.transactionAttempts, 1);
      assert.equal(profile.allocatorQueries, 2);
      assert.equal(profile.roundTrips, 7);
      console.info("Voucher large batch profile", {
        quantity,
        durationMs,
        transactionAttempts: profile.transactionAttempts,
        roundTrips: profile.roundTrips,
        p2034: 0,
        p2028: 0,
        controlledConflicts: 0,
        createdItems: items.length,
        duplicates: 0,
        invariants: "PASS",
      });

      await prisma.voucherStockAuditLog.deleteMany({ where: { batchId: batch.id } });
      await prisma.voucherStockItem.deleteMany({ where: { batchId: batch.id } });
      await prisma.voucherPrintBatch.delete({ where: { id: batch.id } });
    }
  } finally {
    const remainingBatches = await prisma.voucherPrintBatch.findMany({
      where: { createdByUserId: owner.id },
      select: { id: true },
    });
    const remainingBatchIds = remainingBatches.map((batch) => batch.id);
    await prisma.voucherStockAuditLog.deleteMany({ where: { batchId: { in: remainingBatchIds } } });
    await prisma.voucherStockItem.deleteMany({ where: { batchId: { in: remainingBatchIds } } });
    await prisma.voucherPrintBatch.deleteMany({ where: { id: { in: remainingBatchIds } } });
    await prisma.adminUser.delete({ where: { id: owner.id } });
  }
});
