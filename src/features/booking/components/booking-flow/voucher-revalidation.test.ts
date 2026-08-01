import assert from "node:assert/strict";
import test from "node:test";

import { resolveVoucherRevalidation } from "./voucher-revalidation";

for (const reason of ["REDEEMED", "EXPIRED", "DRAFT"]) {
  test(`revalidace po refreshi přestane aplikovat voucher ${reason}`, () => {
    const result = resolveVoucherRevalidation({ ok: false, reason });

    assert.equal(result.appliedVoucherCode, "");
    assert.equal(result.voucherApplication.status, "invalid");
  });
}

test("revalidace po refreshi aplikuje jen nově potvrzený voucher", () => {
  assert.deepEqual(
    resolveVoucherRevalidation({
      ok: true,
      code: "PP-2026-PLATNY",
      displayLabel: "Hodnotový poukaz",
    }),
    {
      appliedVoucherCode: "PP-2026-PLATNY",
      voucherApplication: { status: "applied", label: "Hodnotový poukaz" },
    },
  );
});
