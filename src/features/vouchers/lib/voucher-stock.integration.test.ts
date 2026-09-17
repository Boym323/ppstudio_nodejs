import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { AdminRole, VoucherStockItemStatus, VoucherType } from "@/generated/prisma/browser";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.EMAIL_DELIVERY_MODE ??= "log";

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

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
