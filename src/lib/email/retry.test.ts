import test from "node:test";
import assert from "node:assert/strict";

import { getEmailDeliveryRetryDelayMs, getMaxEmailDeliveryAttempts } from "@/lib/email/retry";

test("prodleva opakování e-mailu začíná na 30 sekundách", () => {
  assert.equal(getEmailDeliveryRetryDelayMs(1), 30_000);
});

test("prodleva opakování e-mailu nepřekročí 15 minut", () => {
  assert.equal(getEmailDeliveryRetryDelayMs(10), 15 * 60 * 1000);
});

test("limit pokusů o doručení e-mailu zůstane na pěti", () => {
  assert.equal(getMaxEmailDeliveryAttempts(), 5);
});
