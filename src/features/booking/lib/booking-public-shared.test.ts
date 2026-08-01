import assert from "node:assert/strict";
import test from "node:test";

import {
  formatClientPhoneForDisplay,
  isSlotUnavailableDueToBookingConflict,
  isRetryablePrismaError,
  isValidClientPhoneInput,
  isValidNormalizedClientPhone,
  normalizeClientPhone,
  publicBookingConflictMessages,
  publicBookingErrorCodes,
} from "./booking-public/shared";

test("normalizeClientPhone keeps empty phone empty", () => {
  assert.equal(normalizeClientPhone(""), undefined);
  assert.equal(normalizeClientPhone("   "), undefined);
  assert.equal(isValidClientPhoneInput(""), true);
});

test("normalizeClientPhone converts Czech local numbers to +420", () => {
  assert.equal(normalizeClientPhone("777123456"), "+420777123456");
  assert.equal(normalizeClientPhone("777 123 456"), "+420777123456");
});

test("normalizeClientPhone respects explicit international prefixes", () => {
  assert.equal(normalizeClientPhone("+420 777 123 456"), "+420777123456");
  assert.equal(normalizeClientPhone("00420 777 123 456"), "+420777123456");
  assert.equal(normalizeClientPhone("+421 905 123 456"), "+421905123456");
});

test("normalizeClientPhone rejects unclear, text, and HTML input", () => {
  assert.equal(normalizeClientPhone("123"), undefined);
  assert.equal(isValidClientPhoneInput("123"), false);
  assert.equal(normalizeClientPhone("telefon 777 123 456"), undefined);
  assert.equal(isValidClientPhoneInput("telefon 777 123 456"), false);
  assert.equal(normalizeClientPhone("<b>777123456</b>"), undefined);
  assert.equal(isValidClientPhoneInput("<b>777123456</b>"), false);
});

test("isValidNormalizedClientPhone requires international + format", () => {
  assert.equal(isValidNormalizedClientPhone("+420777123456"), true);
  assert.equal(isValidNormalizedClientPhone("420777123456"), false);
  assert.equal(isValidNormalizedClientPhone("+420 777 123 456"), false);
});

test("formatClientPhoneForDisplay renders normalized phone readably", () => {
  assert.equal(formatClientPhoneForDisplay("+420777123456"), "+420 777 123 456");
  assert.equal(formatClientPhoneForDisplay("+421905123456"), "+421 905 123 456");
});

test("isRetryablePrismaError treats Prisma PG adapter transaction conflicts as retryable", () => {
  const error = {
    name: "DriverAdapterError",
    cause: {
      kind: "TransactionWriteConflict",
    },
  };

  assert.equal(isRetryablePrismaError(error), true);
});

test("isRetryablePrismaError does not retry unrelated driver adapter errors", () => {
  const error = {
    name: "DriverAdapterError",
    cause: {
      kind: "UniqueConstraintViolation",
    },
  };

  assert.equal(isRetryablePrismaError(error), false);
});

test("isSlotUnavailableDueToBookingConflict recognizes an active booking overlap", () => {
  assert.equal(
    isSlotUnavailableDueToBookingConflict({
      code: publicBookingErrorCodes.slotUnavailable,
      message: publicBookingConflictMessages.activeReservation,
    }),
    true,
  );
  assert.equal(
    isSlotUnavailableDueToBookingConflict({
      code: publicBookingErrorCodes.slotUnavailable,
      message: "Vybraný termín už není dostupný.",
    }),
    false,
  );
});
