import assert from "node:assert/strict";
import test from "node:test";

import { updateVoucherSettingsSchema } from "./admin-settings-validation";

test("voucher settings schema přijme aktivní template ID a platnost v povoleném rozsahu", () => {
  const parsed = updateVoucherSettingsSchema.parse({
    voucherDefaultTemplateId: "template-test-1",
    voucherDefaultValidityMonths: "12",
  });

  assert.deepEqual(parsed, {
    voucherDefaultTemplateId: "template-test-1",
    voucherDefaultValidityMonths: 12,
  });
});

test("voucher settings schema odmítne prázdné ID a neplatnou platnost", () => {
  const parsed = updateVoucherSettingsSchema.safeParse({
    voucherDefaultTemplateId: "",
    voucherDefaultValidityMonths: "61",
  });

  assert.equal(parsed.success, false);
});
