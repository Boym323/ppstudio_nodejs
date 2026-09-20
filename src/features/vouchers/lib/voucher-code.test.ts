import assert from "node:assert/strict";
import test from "node:test";

import { TransientTransactionConflictError } from "@/lib/transient-transaction-conflict";

import { allocateVoucherCode, allocateVoucherCodes } from "./voucher-code";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";

function createTransaction(options: {
  voucherFindUnique?: () => Promise<{ id: string } | null>;
  stockFindUnique?: () => Promise<{ id: string } | null>;
  voucherFindMany?: () => Promise<Array<{ code: string }>>;
  stockFindMany?: () => Promise<Array<{ code: string }>>;
  queryRaw?: () => Promise<Array<{ locked: boolean }>>;
} = {}) {
  return {
    $executeRaw: async () => 1,
    $queryRaw: options.queryRaw ?? (async () => [{ locked: true }]),
    voucher: {
      findUnique: options.voucherFindUnique ?? (async () => null),
      findMany: options.voucherFindMany ?? (async () => []),
    },
    voucherStockItem: {
      findUnique: options.stockFindUnique ?? (async () => null),
      findMany: options.stockFindMany ?? (async () => []),
    },
  } as never;
}

test("voucher code používá pražský rok i při serverové TZ UTC", async () => {
  const code = await allocateVoucherCode(createTransaction(), new Date("2026-12-31T23:30:00.000Z"));

  assert.match(code, /^PP-2027-[A-Z2-9]{6}$/);
});

test("voucher code před pražskou půlnocí ještě používá předchozí rok", async () => {
  const code = await allocateVoucherCode(createTransaction(), new Date("2026-12-31T22:30:00.000Z"));

  assert.match(code, /^PP-2026-[A-Z2-9]{6}$/);
});

test("allocator po kandidátovi obsazeném jen ve Voucher zkusí další kandidát", async () => {
  let voucherLookups = 0;
  let stockLookups = 0;
  const code = await allocateVoucherCode(createTransaction({
    voucherFindUnique: async () => {
      voucherLookups += 1;
      return voucherLookups === 1 ? { id: "voucher-1" } : null;
    },
    stockFindUnique: async () => {
      stockLookups += 1;
      return null;
    },
  }));

  assert.match(code, /^PP-\d{4}-[A-Z2-9]{6}$/);
  assert.equal(voucherLookups, 2);
  assert.equal(stockLookups, 2);
});

test("allocator po kandidátovi obsazeném jen ve VoucherStockItem zkusí další kandidát", async () => {
  let voucherLookups = 0;
  let stockLookups = 0;
  const code = await allocateVoucherCode(createTransaction({
    voucherFindUnique: async () => {
      voucherLookups += 1;
      return null;
    },
    stockFindUnique: async () => {
      stockLookups += 1;
      return stockLookups === 1 ? { id: "stock-1" } : null;
    },
  }));

  assert.match(code, /^PP-\d{4}-[A-Z2-9]{6}$/);
  assert.equal(voucherLookups, 2);
  assert.equal(stockLookups, 2);
});

test("allocator přidělí první kandidát, který není v žádné tabulce", async () => {
  let voucherLookups = 0;
  let stockLookups = 0;
  const code = await allocateVoucherCode(createTransaction({
    voucherFindUnique: async () => {
      voucherLookups += 1;
      return null;
    },
    stockFindUnique: async () => {
      stockLookups += 1;
      return null;
    },
  }));

  assert.match(code, /^PP-\d{4}-[A-Z2-9]{6}$/);
  assert.equal(voucherLookups, 1);
  assert.equal(stockLookups, 1);
});

test("allocator ve fail-fast režimu vrátí typed transient lock conflict", async () => {
  await assert.rejects(
    () => allocateVoucherCode(
      createTransaction({ queryRaw: async () => [{ locked: false }] }),
      new Date("2026-09-20T10:00:00.000Z"),
      { failFast: true },
    ),
    (error: unknown) => error instanceof TransientTransactionConflictError
      && error.kind === "advisory_lock_busy",
  );
});

test("dávkový allocator drží jeden lock a kontroluje obě tabulky jedním párem dotazů", async () => {
  let lockCalls = 0;
  let voucherQueries = 0;
  let stockQueries = 0;
  const codes = await allocateVoucherCodes(createTransaction({
    queryRaw: async () => {
      lockCalls += 1;
      return [{ locked: true }];
    },
    voucherFindMany: async () => {
      voucherQueries += 1;
      return [];
    },
    stockFindMany: async () => {
      stockQueries += 1;
      return [];
    },
  }), 100, new Date("2026-09-20T10:00:00.000Z"), { failFast: true });

  assert.equal(codes.length, 100);
  assert.equal(new Set(codes).size, 100);
  assert.equal(lockCalls, 1);
  assert.equal(voucherQueries, 1);
  assert.equal(stockQueries, 1);
});
