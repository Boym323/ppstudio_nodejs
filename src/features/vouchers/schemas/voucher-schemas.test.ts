import assert from "node:assert/strict";
import test from "node:test";

import { VoucherType } from "@/generated/prisma/browser";

import { createVoucherSchema } from "./voucher-schemas";

test("create voucher schema doplní defaultní templateKey", () => {
  const parsed = createVoucherSchema.parse({
    type: VoucherType.VALUE,
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
