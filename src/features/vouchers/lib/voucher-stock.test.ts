import assert from "node:assert/strict";
import test from "node:test";

import { Prisma } from "@/generated/prisma/client";

import { mockVoucherPrisma, mockVoucherTemplateRepository } from "./voucher-template-test-fixtures";

process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";

function serializableConflict() {
  return new Prisma.PrismaClientKnownRequestError("serializační konflikt", {
    code: "P2034",
    clientVersion: "test",
  });
}

function transactionTimeout() {
  return new Prisma.PrismaClientKnownRequestError("transaction timeout", {
    code: "P2028",
    clientVersion: "test",
  });
}

function skipRetryDelay(t: test.TestContext) {
  t.mock.method(global, "setTimeout", ((callback: () => void) => {
    queueMicrotask(callback);
    return {} as NodeJS.Timeout;
  }) as unknown as typeof setTimeout);
}

function mockTransaction(
  t: test.TestContext,
  prisma: { $transaction: unknown },
  implementation: (operation: (tx: Prisma.TransactionClient) => Promise<unknown>) => Promise<unknown>,
) {
  const client = prisma as { $transaction: typeof implementation };
  const original = client.$transaction;
  Object.defineProperty(client, "$transaction", { configurable: true, value: implementation, writable: true });
  t.after(() => Object.defineProperty(client, "$transaction", { configurable: true, value: original, writable: true }));
}

function createBatchTransaction(options: { batchLock?: boolean; codeLock?: boolean } = {}) {
  let queryNumber = 0;

  return {
    $queryRaw: async () => {
      queryNumber += 1;

      if (queryNumber === 1) {
        return [{ locked: options.batchLock ?? true }];
      }

      if (queryNumber === 2) {
        return [{ maxSequence: 0 }];
      }

      if (queryNumber === 3) {
        return [{ locked: options.codeLock ?? true }];
      }

      throw new Error(`unexpected query ${queryNumber}`);
    },
    voucherTemplate: { findUnique: async () => ({ id: "template-test", key: "classic-v1", status: "PUBLISHED", validationPolicy: "STRICT_V1", allowedTypes: ["VALUE", "SERVICE"] }) },
    voucher: { findUnique: async () => null, findMany: async () => [] },
    voucherStockItem: { findUnique: async () => null, findMany: async () => [] },
    voucherPrintBatch: {
      create: async () => ({ id: "batch-test" }),
    },
    voucherStockAuditLog: {
      create: async () => undefined,
    },
  } as unknown as Prisma.TransactionClient;
}

test("batch create odmítne legacy PUBLISHED template bez aktuální validation policy", async (t) => {
  const { prisma, stock } = await loadStockTestContext(t);
  let created = false;
  mockTransaction(t, prisma, async (operation) => operation({
    ...createBatchTransaction(),
    voucherTemplate: { findUnique: async () => ({ id: "template-test", key: "classic-v1", status: "PUBLISHED", validationPolicy: null, allowedTypes: ["VALUE"] }) },
    voucherPrintBatch: { create: async () => { created = true; return { id: "unexpected" }; } },
  } as unknown as Prisma.TransactionClient));

  await assert.rejects(
    () => stock.createVoucherPrintBatch({ templateKey: "classic-v1", quantity: 1, createdByUserId: "admin-test" }),
    (error: unknown) => error instanceof stock.VoucherStockOperationError
      && error.code === stock.voucherStockOperationErrorCodes.templateUnavailable,
  );
  assert.equal(created, false);
});

async function loadStockTestContext(t: test.TestContext) {
  mockVoucherPrisma(t);
  mockVoucherTemplateRepository(t);
  t.mock.module("@/lib/site-settings", {
    exports: {
      getSiteSettings: async () => ({ voucherDefaultValidityMonths: 12 }),
    },
  });
  const [{ prisma }, stock] = await Promise.all([
    import("@/lib/prisma"),
    import("./voucher-stock"),
  ]);

  return { prisma, stock };
}

test("batch create po P2034 retry uspěje v jedné bounded smyčce", async (t) => {
  skipRetryDelay(t);
  const { prisma, stock } = await loadStockTestContext(t);
  let attempts = 0;
  mockTransaction(t, prisma, async (operation) => {
    attempts += 1;
    if (attempts <= 2) {
      throw serializableConflict();
    }

    return operation(createBatchTransaction());
  });

  const result = await stock.createVoucherPrintBatch({
    templateKey: "classic-v1",
    quantity: 1,
    createdByUserId: "admin-test",
  });

  assert.equal(result.id, "batch-test");
  assert.equal(attempts, 3);
});

test("batch create po vyčerpání P2034 vrátí controlled TRANSIENT_CONFLICT", async (t) => {
  skipRetryDelay(t);
  t.mock.method(console, "warn", () => undefined);
  const { prisma, stock } = await loadStockTestContext(t);
  let attempts = 0;
  mockTransaction(t, prisma, async () => {
    attempts += 1;
    throw serializableConflict();
  });

  await assert.rejects(
    () => stock.createVoucherPrintBatch({ templateKey: "classic-v1", quantity: 1, createdByUserId: "admin-test" }),
    (error: unknown) => error instanceof stock.VoucherStockOperationError
      && error.code === stock.voucherStockOperationErrorCodes.transientConflict,
  );
  assert.equal(attempts, stock.MAX_BATCH_TRANSACTION_ATTEMPTS);
});

test("batch create po P2028 neprovede retry a vrátí controlled operation error", async (t) => {
  t.mock.method(console, "warn", () => undefined);
  const { prisma, stock } = await loadStockTestContext(t);
  let attempts = 0;
  mockTransaction(t, prisma, async () => {
    attempts += 1;
    throw transactionTimeout();
  });

  await assert.rejects(
    () => stock.createVoucherPrintBatch({ templateKey: "classic-v1", quantity: 1, createdByUserId: "admin-test" }),
    (error: unknown) => error instanceof stock.VoucherStockOperationError
      && error.code === stock.voucherStockOperationErrorCodes.operationFailed
      && !/P2028|Prisma/i.test(error.message),
  );
  assert.equal(attempts, 1);
});

test("batch create při busy batch locku rollbackne pokus a retryuje mimo transakci", async (t) => {
  skipRetryDelay(t);
  const { prisma, stock } = await loadStockTestContext(t);
  let attempts = 0;
  mockTransaction(t, prisma, async (operation) => {
    attempts += 1;
    return operation(createBatchTransaction({ batchLock: attempts > 1 }));
  });

  await stock.createVoucherPrintBatch({ templateKey: "classic-v1", quantity: 1, createdByUserId: "admin-test" });
  assert.equal(attempts, 2);
});

test("batch create při busy code locku skončí po bounded exhaustion controlled chybou", async (t) => {
  skipRetryDelay(t);
  t.mock.method(console, "warn", () => undefined);
  const { prisma, stock } = await loadStockTestContext(t);
  let attempts = 0;
  mockTransaction(t, prisma, async (operation) => {
    attempts += 1;
    return operation(createBatchTransaction({ codeLock: false }));
  });

  await assert.rejects(
    () => stock.createVoucherPrintBatch({ templateKey: "classic-v1", quantity: 1, createdByUserId: "admin-test" }),
    (error: unknown) => error instanceof stock.VoucherStockOperationError
      && error.code === stock.voucherStockOperationErrorCodes.transientConflict,
  );
  assert.equal(attempts, stock.MAX_BATCH_TRANSACTION_ATTEMPTS);
});

test("batch create neopatruje unexpected Prisma ani validační chybu jako transient retry", async (t) => {
  const { prisma, stock } = await loadStockTestContext(t);
  let attempts = 0;
  const unexpected = new Prisma.PrismaClientKnownRequestError("unexpected database failure", {
    code: "P2002",
    clientVersion: "test",
  });
  mockTransaction(t, prisma, async () => {
    attempts += 1;
    throw unexpected;
  });

  await assert.rejects(
    () => stock.createVoucherPrintBatch({ templateKey: "classic-v1", quantity: 1, createdByUserId: "admin-test" }),
    unexpected,
  );
  assert.equal(attempts, 1);

  await assert.rejects(
    () => stock.createVoucherPrintBatch({ templateKey: "classic-v1", quantity: 0, createdByUserId: "admin-test" }),
    (error: unknown) => error instanceof stock.VoucherStockOperationError
      && error.code === stock.voucherStockOperationErrorCodes.invalidQuantity,
  );
  assert.equal(attempts, 1);
});

test("batch create bez konfliktu použije jeden transaction attempt a žádný delay", async (t) => {
  let attempts = 0;
  let delays = 0;
  t.mock.method(global, "setTimeout", (() => {
    delays += 1;
    return {} as NodeJS.Timeout;
  }) as unknown as typeof setTimeout);
  const { prisma, stock } = await loadStockTestContext(t);
  mockTransaction(t, prisma, async (operation) => {
    attempts += 1;
    return operation(createBatchTransaction());
  });

  await stock.createVoucherPrintBatch({ templateKey: "classic-v1", quantity: 1, createdByUserId: "admin-test" });
  assert.equal(attempts, 1);
  assert.equal(delays, 0);
});

test("batch create odmítne template deaktivovanou mezi preflightem a transakcí", async (t) => {
  const { prisma, stock } = await loadStockTestContext(t);
  let created = false;
  mockTransaction(t, prisma, async (operation) => operation({
    ...createBatchTransaction(),
    voucherTemplate: { findUnique: async () => ({ id: "template-test", key: "classic-v1", status: "INACTIVE", allowedTypes: ["VALUE", "SERVICE"] }) },
    voucherPrintBatch: { create: async () => { created = true; return { id: "unexpected" }; } },
  } as unknown as Prisma.TransactionClient));

  await assert.rejects(
    () => stock.createVoucherPrintBatch({ templateKey: "classic-v1", quantity: 1, createdByUserId: "admin-test" }),
    (error: unknown) => error instanceof stock.VoucherStockOperationError
      && error.code === stock.voucherStockOperationErrorCodes.templateUnavailable,
  );
  assert.equal(created, false);
});
