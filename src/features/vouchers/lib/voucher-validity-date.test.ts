import assert from "node:assert/strict";
import test from "node:test";

import { VoucherStatus, VoucherType } from "@prisma/client";

import { getEffectiveVoucherStatus } from "./voucher-format";
import { createVoucherSchema } from "../schemas/voucher-schemas";

const emptyVoucherMeta = {
  purchaserName: undefined,
  purchaserEmail: undefined,
  recipientName: undefined,
  message: undefined,
  internalNote: undefined,
};

function parseVoucherValidity(validFrom: string, validUntil: string) {
  return createVoucherSchema.parse({
    type: VoucherType.VALUE,
    ...emptyVoucherMeta,
    originalValueCzk: 1000,
    validFrom,
    validUntil,
  });
}

test("platnost voucheru převádí zimní datum na začátek pražského dne", () => {
  const voucher = parseVoucherValidity("2026-01-15", "2026-01-15");

  assert.equal(voucher.validFrom?.toISOString(), "2026-01-14T23:00:00.000Z");
});

test("platnost voucheru převádí letní datum a končí až místní půlnocí následujícího dne", () => {
  const voucher = parseVoucherValidity("2026-07-15", "2026-07-15");

  assert.equal(voucher.validFrom?.toISOString(), "2026-07-14T22:00:00.000Z");
  assert.equal(voucher.validUntil?.toISOString(), "2026-07-15T22:00:00.000Z");
  assert.equal(
    getEffectiveVoucherStatus(
      { status: VoucherStatus.ACTIVE, validFrom: voucher.validFrom, validUntil: voucher.validUntil },
      voucher.validUntil!,
    ),
    VoucherStatus.ACTIVE,
  );
  assert.equal(
    getEffectiveVoucherStatus(
      { status: VoucherStatus.ACTIVE, validFrom: voucher.validFrom, validUntil: voucher.validUntil },
      new Date(voucher.validUntil!.getTime() + 1),
    ),
    VoucherStatus.EXPIRED,
  );
});

test("budoucí datum platnosti od zůstává povolené", () => {
  const voucher = parseVoucherValidity("2030-01-15", "2030-01-15");

  assert.equal(voucher.validFrom?.toISOString(), "2030-01-14T23:00:00.000Z");
});
