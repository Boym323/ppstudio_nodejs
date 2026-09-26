import assert from "node:assert/strict";
import test from "node:test";

import { VoucherType } from "@/generated/prisma/browser";

import { activateVoucherStockItemSchema, createVoucherSchema } from "./voucher-schemas";
import { VOUCHER_VALUE_MAX_CZK } from "../lib/voucher-value-limits";

test("create voucher schema bez templateKey odmítne request bez aplikačního fallbacku", () => {
  const parsed = createVoucherSchema.safeParse({
    type: VoucherType.VALUE,
    originalValueCzk: "1500",
  });

  assert.equal(parsed.success, false);
  if (!parsed.success) {
    assert.equal(parsed.error.flatten().fieldErrors.templateKey?.[0], "Vyberte vzhled voucheru.");
  }
});

test("create voucher schema přijme explicitní classic-v1", () => {
  const parsed = createVoucherSchema.parse({
    type: VoucherType.VALUE,
    templateKey: "classic-v1",
    originalValueCzk: "1500",
  });

  assert.equal(parsed.templateKey, "classic-v1");
});

test("create voucher schema odmítne prázdný templateKey před doménovou validací", () => {
  const parsed = createVoucherSchema.safeParse({
    type: VoucherType.VALUE,
    templateKey: "",
    originalValueCzk: "1500",
  });

  assert.equal(parsed.success, false);
});

test("digitální i STOCK VALUE mají společný bezpečný horní limit", () => {
  for (const [schema, base] of [
    [createVoucherSchema, { type: VoucherType.VALUE, templateKey: "classic-v1" }],
    [activateVoucherStockItemSchema, { type: VoucherType.VALUE, code: "PP-2026-ABCDEF" }],
  ] as const) {
    for (const amount of [1, VOUCHER_VALUE_MAX_CZK]) {
      assert.equal(schema.safeParse({ ...base, originalValueCzk: amount }).success, true);
    }
    for (const amount of [VOUCHER_VALUE_MAX_CZK + 1, 2_147_483_648]) {
      assert.equal(schema.safeParse({ ...base, originalValueCzk: amount }).success, false);
    }
  }
});
