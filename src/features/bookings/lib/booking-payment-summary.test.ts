import assert from "node:assert/strict";
import test from "node:test";

import { getBookingPaymentSummary } from "./booking-payment-summary";

test("getBookingPaymentSummary returns UNPAID when no payment exists", () => {
  const summary = getBookingPaymentSummary({
    totalPriceCzk: 1_200,
    voucherRedemptions: [],
    payments: [],
  });

  assert.equal(summary.status, "UNPAID");
  assert.equal(summary.remainingCzk, 1_200);
});

test("getBookingPaymentSummary returns PARTIALLY_PAID for partial voucher payment", () => {
  const summary = getBookingPaymentSummary({
    totalPriceCzk: 1_200,
    voucherRedemptions: [{ amountCzk: 500 }],
    payments: [],
  });

  assert.equal(summary.status, "PARTIALLY_PAID");
  assert.equal(summary.voucherPaidCzk, 500);
  assert.equal(summary.remainingCzk, 700);
});

test("getBookingPaymentSummary returns PARTIALLY_PAID for partial direct payment", () => {
  const summary = getBookingPaymentSummary({
    totalPriceCzk: 1_200,
    voucherRedemptions: [],
    payments: [{ amountCzk: 500 }],
  });

  assert.equal(summary.status, "PARTIALLY_PAID");
  assert.equal(summary.directPaidCzk, 500);
  assert.equal(summary.remainingCzk, 700);
});

test("getBookingPaymentSummary returns PAID for voucher and direct payment combined", () => {
  const summary = getBookingPaymentSummary({
    totalPriceCzk: 1_200,
    voucherRedemptions: [{ amountCzk: 500 }],
    payments: [{ amountCzk: 700 }],
  });

  assert.equal(summary.status, "PAID");
  assert.equal(summary.paidTotalCzk, 1_200);
  assert.equal(summary.remainingCzk, 0);
});

test("getBookingPaymentSummary returns OVERPAID for payment above total price", () => {
  const summary = getBookingPaymentSummary({
    totalPriceCzk: 1_200,
    voucherRedemptions: [{ amountCzk: 500 }],
    payments: [{ amountCzk: 800 }],
  });

  assert.equal(summary.status, "OVERPAID");
  assert.equal(summary.overpaidCzk, 100);
  assert.equal(summary.remainingCzk, 0);
});
