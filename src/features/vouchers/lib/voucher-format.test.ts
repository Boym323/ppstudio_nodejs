import assert from "node:assert/strict";
import test from "node:test";

import { VoucherStatus } from "@/generated/prisma/browser";

import { getEffectiveVoucherStatus } from "./voucher-format";

const now = new Date("2026-08-02T12:00:00.000Z");

test("getEffectiveVoucherStatus vyhodnotí platnost voucheru vůči předanému času", () => {
  const baseVoucher = {
    status: VoucherStatus.ACTIVE,
    validUntil: new Date("2026-08-03T12:00:00.000Z"),
  };

  assert.equal(
    getEffectiveVoucherStatus(
      { ...baseVoucher, validFrom: new Date("2026-08-02T12:00:00.001Z") },
      now,
    ),
    VoucherStatus.DRAFT,
  );
  assert.equal(
    getEffectiveVoucherStatus({ ...baseVoucher, validFrom: now }, now),
    VoucherStatus.ACTIVE,
  );
  assert.equal(
    getEffectiveVoucherStatus(
      {
        ...baseVoucher,
        validFrom: new Date("2026-08-01T12:00:00.000Z"),
        validUntil: new Date("2026-08-02T11:59:59.999Z"),
      },
      now,
    ),
    VoucherStatus.EXPIRED,
  );
  assert.equal(
    getEffectiveVoucherStatus(
      { ...baseVoucher, validFrom: new Date("2026-08-01T12:00:00.000Z") },
      now,
    ),
    VoucherStatus.ACTIVE,
  );
});
