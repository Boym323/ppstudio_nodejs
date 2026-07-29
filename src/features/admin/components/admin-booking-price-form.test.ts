import assert from "node:assert/strict";
import test from "node:test";

import { getBookingPaymentSummary } from "@/features/bookings/lib/booking-payment-summary";

test("náhled ceny ukáže přeplatek z aktuálních úhrad", () => {
  const summary = getBookingPaymentSummary({ totalPriceCzk: 900, payments: [{ amountCzk: 1_200 }], voucherRedemptions: [{ amountCzk: 0 }] });
  assert.equal(summary.overpaidCzk, 300);
  assert.equal(summary.remainingCzk, 0);
});

test("náhled ceny ukáže doplatek z aktuálních úhrad", () => {
  const summary = getBookingPaymentSummary({ totalPriceCzk: 1_700, payments: [{ amountCzk: 700 }], voucherRedemptions: [{ amountCzk: 500 }] });
  assert.equal(summary.remainingCzk, 500);
  assert.equal(summary.overpaidCzk, 0);
});
