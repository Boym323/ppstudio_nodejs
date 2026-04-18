import test from "node:test";
import assert from "node:assert/strict";

import { getEmailDeliveryRetryDelayMs, getMaxEmailDeliveryAttempts } from "@/lib/email/retry";

test("email retry backoff starts at 30 seconds", () => {
  assert.equal(getEmailDeliveryRetryDelayMs(1), 30_000);
});

test("email retry backoff caps at 15 minutes", () => {
  assert.equal(getEmailDeliveryRetryDelayMs(10), 15 * 60 * 1000);
});

test("email delivery attempt limit stays at five", () => {
  assert.equal(getMaxEmailDeliveryAttempts(), 5);
});
