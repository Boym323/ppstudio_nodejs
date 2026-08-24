import assert from "node:assert/strict";
import test from "node:test";

import { getBookingPaymentSummary } from "./booking-payment-summary";

test("getBookingPaymentSummary vrátí UNPAID, když neexistuje žádná platba", () => {
  const summary = getBookingPaymentSummary({
    totalPriceCzk: 1_200,
    voucherRedemptions: [],
    payments: [],
  });

  assert.equal(summary.status, "UNPAID");
  assert.equal(summary.remainingCzk, 1_200);
});

test("getBookingPaymentSummary vrátí PARTIALLY_PAID pro částečnou platbu voucherem", () => {
  const summary = getBookingPaymentSummary({
    totalPriceCzk: 1_200,
    voucherRedemptions: [{ amountCzk: 500 }],
    payments: [],
  });

  assert.equal(summary.status, "PARTIALLY_PAID");
  assert.equal(summary.voucherPaidCzk, 500);
  assert.equal(summary.remainingCzk, 700);
});

test("getBookingPaymentSummary vrátí PARTIALLY_PAID pro částečnou přímou platbu", () => {
  const summary = getBookingPaymentSummary({
    totalPriceCzk: 1_200,
    voucherRedemptions: [],
    payments: [{ amountCzk: 500 }],
  });

  assert.equal(summary.status, "PARTIALLY_PAID");
  assert.equal(summary.directPaidCzk, 500);
  assert.equal(summary.remainingCzk, 700);
});

test("getBookingPaymentSummary vrátí PAID pro kombinaci platby voucherem a přímé platby", () => {
  const summary = getBookingPaymentSummary({
    totalPriceCzk: 1_200,
    voucherRedemptions: [{ amountCzk: 500 }],
    payments: [{ amountCzk: 700 }],
  });

  assert.equal(summary.status, "PAID");
  assert.equal(summary.paidTotalCzk, 1_200);
  assert.equal(summary.remainingCzk, 0);
});

test("getBookingPaymentSummary vrátí OVERPAID pro platbu nad celkovou cenou", () => {
  const summary = getBookingPaymentSummary({
    totalPriceCzk: 1_200,
    voucherRedemptions: [{ amountCzk: 500 }],
    payments: [{ amountCzk: 800 }],
  });

  assert.equal(summary.status, "OVERPAID");
  assert.equal(summary.overpaidCzk, 100);
  assert.equal(summary.remainingCzk, 0);
});

test("getBookingPaymentSummary vyloučí zneplatněné přímé platby", () => {
  const summary = getBookingPaymentSummary({
    totalPriceCzk: 1_000,
    payments: [
      { amountCzk: 1_000, status: "VOIDED" },
      { amountCzk: 300, status: "ACTIVE" },
    ],
  });

  assert.equal(summary.directPaidCzk, 300);
  assert.equal(summary.remainingCzk, 700);
  assert.equal(summary.status, "PARTIALLY_PAID");
});
