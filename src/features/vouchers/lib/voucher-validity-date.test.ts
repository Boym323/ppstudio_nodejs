import assert from "node:assert/strict";
import test from "node:test";

import { VoucherStatus, VoucherType } from "@/generated/prisma/browser";

import { getEffectiveVoucherStatus } from "./voucher-format";
import {
  addVoucherValidityMonths,
  getVoucherPragueDateBoundary,
} from "./voucher-validity-date";
import { createVoucherSchema } from "../schemas/voucher-schemas";

const emptyVoucherMeta = {
  templateKey: "classic-v1",
  purchaserName: undefined,
  purchaserEmail: undefined,
  recipientName: undefined,
  message: undefined,
  internalNote: undefined,
};

const pragueDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Prague",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function parseVoucherValidity(validFrom: string, validUntil: string) {
  return createVoucherSchema.parse({
    type: VoucherType.VALUE,
    ...emptyVoucherMeta,
    originalValueCzk: 1000,
    validFrom,
    validUntil,
  });
}

function formatPragueDateInput(value: Date) {
  const parts = pragueDateFormatter.formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;

  return `${part("year")}-${part("month")}-${part("day")}`;
}

test("platnost voucheru převádí zimní datum na hranice pražského dne", () => {
  const voucher = parseVoucherValidity("2026-01-15", "2026-01-15");

  assert.equal(voucher.validFrom?.toISOString(), "2026-01-14T23:00:00.000Z");
  assert.equal(voucher.validUntil?.toISOString(), "2026-01-15T22:59:59.999Z");
});

test("platnost voucheru převádí letní datum na hranice pražského dne", () => {
  const voucher = parseVoucherValidity("2026-07-15", "2026-07-15");

  assert.equal(voucher.validFrom?.toISOString(), "2026-07-14T22:00:00.000Z");
  assert.equal(voucher.validUntil?.toISOString(), "2026-07-15T21:59:59.999Z");
});

test("konec platnosti zůstává správný ve dnech přechodu letního času", () => {
  assert.equal(
    parseVoucherValidity("2026-03-29", "2026-03-29").validUntil?.toISOString(),
    "2026-03-29T21:59:59.999Z",
  );
  assert.equal(
    parseVoucherValidity("2026-10-25", "2026-10-25").validUntil?.toISOString(),
    "2026-10-25T22:59:59.999Z",
  );
});

test("formátování validUntil vrací vybrané datum a opakované zpracování jej neposune", () => {
  const voucher = parseVoucherValidity("2026-07-15", "2026-07-15");
  const formattedValidUntil = formatPragueDateInput(voucher.validUntil!);
  const reparsedVoucher = parseVoucherValidity("2026-07-15", formattedValidUntil);

  assert.equal(formattedValidUntil, "2026-07-15");
  assert.equal(reparsedVoucher.validUntil?.toISOString(), voucher.validUntil?.toISOString());
});

test("voucher je aktivní v poslední milisekundě dne a od následující místní půlnoci propadlý", () => {
  const voucher = parseVoucherValidity("2026-07-15", "2026-07-15");

  assert.equal(
    getEffectiveVoucherStatus(
      { status: VoucherStatus.ACTIVE, validFrom: voucher.validFrom!, validUntil: voucher.validUntil! },
      voucher.validUntil!,
    ),
    VoucherStatus.ACTIVE,
  );
  assert.equal(
    getEffectiveVoucherStatus(
      { status: VoucherStatus.ACTIVE, validFrom: voucher.validFrom!, validUntil: voucher.validUntil! },
      new Date(voucher.validUntil!.getTime() + 1),
    ),
    VoucherStatus.EXPIRED,
  );
});

test("budoucí datum platnosti od zůstává povolené", () => {
  const voucher = parseVoucherValidity("2030-01-15", "2030-01-15");

  assert.equal(voucher.validFrom?.toISOString(), "2030-01-14T23:00:00.000Z");
});

test("vytvořený voucher lze interně znovu validovat bez změny platnosti", () => {
  const voucher = parseVoucherValidity("2026-07-15", "2026-07-15");
  const reparsedVoucher = createVoucherSchema.parse(voucher);

  assert.equal(reparsedVoucher.validFrom?.toISOString(), "2026-07-14T22:00:00.000Z");
  assert.equal(reparsedVoucher.validUntil?.toISOString(), "2026-07-15T21:59:59.999Z");
});

test("přičtení měsíce pracuje s pražským kalendářem a clampne konec ledna", () => {
  const januaryDate = parseVoucherValidity("2026-01-31", "2026-01-31").validFrom!;
  const leapJanuaryDate = parseVoucherValidity("2024-01-31", "2024-01-31").validFrom!;
  const result = addVoucherValidityMonths(januaryDate, 1);

  assert.equal(formatPragueDateInput(result), "2026-02-28");
  assert.equal(result.toISOString(), "2026-02-27T23:00:00.000Z");
  assert.equal(formatPragueDateInput(addVoucherValidityMonths(leapJanuaryDate, 1)), "2024-02-29");
});

test("přičtení měsíce zachová 29. únor v přestupném roce jako clamp do nepřestupného roku", () => {
  const leapDate = parseVoucherValidity("2024-02-29", "2024-02-29").validFrom!;
  const result = addVoucherValidityMonths(leapDate, 12);

  assert.equal(formatPragueDateInput(result), "2025-02-28");
});

test("přičtení měsíců zachová běžný den a zvládne posun roku", () => {
  const novemberDate = parseVoucherValidity("2026-11-30", "2026-11-30").validFrom!;
  const result = addVoucherValidityMonths(novemberDate, 3);
  const anniversary = parseVoucherValidity("2026-09-17", "2026-09-17").validFrom!;

  assert.equal(formatPragueDateInput(result), "2027-02-28");
  assert.equal(formatPragueDateInput(addVoucherValidityMonths(anniversary, 12)), "2027-09-17");
});

test("pražské hranice dne používají správné CET/CEST instanty", () => {
  const springDate = new Date("2026-03-29T12:00:00.000Z");
  const autumnDate = new Date("2026-10-25T12:00:00.000Z");

  assert.equal(
    getVoucherPragueDateBoundary(springDate, "start").toISOString(),
    "2026-03-28T23:00:00.000Z",
  );
  assert.equal(
    getVoucherPragueDateBoundary(springDate, "end").toISOString(),
    "2026-03-29T21:59:59.999Z",
  );
  assert.equal(
    getVoucherPragueDateBoundary(autumnDate, "end").toISOString(),
    "2026-10-25T22:59:59.999Z",
  );
});
