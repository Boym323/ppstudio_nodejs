import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { AdminRole, VoucherStockItemStatus, VoucherType } from "@/generated/prisma/browser";
import { Prisma } from "@/generated/prisma/client";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.EMAIL_DELIVERY_MODE ??= "log";

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

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
