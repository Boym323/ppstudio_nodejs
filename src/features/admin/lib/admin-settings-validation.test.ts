import assert from "node:assert/strict";
import test from "node:test";

import { updateVoucherSettingsSchema } from "./admin-settings-validation";

test("voucher settings schema přijme aktivní key a platnost v povoleném rozsahu", () => {
  const parsed = updateVoucherSettingsSchema.parse({
    voucherDefaultTemplateKey: "test-template-v1",
    voucherDefaultValidityMonths: "12",
  });

  assert.deepEqual(parsed, {
    voucherDefaultTemplateKey: "test-template-v1",
    voucherDefaultValidityMonths: 12,
  });
});

test("voucher settings schema odmítne prázdný key a neplatnou platnost", () => {
  const parsed = updateVoucherSettingsSchema.safeParse({
    voucherDefaultTemplateKey: "",
    voucherDefaultValidityMonths: "61",
  });

  assert.equal(parsed.success, false);
});
