import assert from "node:assert/strict";
import test from "node:test";

import { allocateVoucherCode } from "./voucher-code";

function createEmptyTransaction() {
  return {
    $executeRaw: async () => 1,
    voucher: { findUnique: async () => null },
    voucherStockItem: { findUnique: async () => null },
  } as never;
}

test("voucher code používá pražský rok i při serverové TZ UTC", async () => {
  const code = await allocateVoucherCode(createEmptyTransaction(), new Date("2026-12-31T23:30:00.000Z"));

  assert.match(code, /^PP-2027-[A-Z2-9]{6}$/);
});

test("voucher code před pražskou půlnocí ještě používá předchozí rok", async () => {
  const code = await allocateVoucherCode(createEmptyTransaction(), new Date("2026-12-31T22:30:00.000Z"));

  assert.match(code, /^PP-2026-[A-Z2-9]{6}$/);
});
