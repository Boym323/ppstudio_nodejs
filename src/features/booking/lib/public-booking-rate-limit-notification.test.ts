import assert from "node:assert/strict";
import test from "node:test";

import { selectPublicBookingRateLimitNotificationSource } from "./public-booking-rate-limit-notification";

test("e-mailový limiter dostane přednost před dostupným ipHash", () => {
  assert.deepEqual(
    selectPublicBookingRateLimitNotificationSource({
      ipRateLimitAllowed: true,
      ipHash: "ip-hash",
      emailHash: "email-hash",
    }),
    {
      sourceHash: "email-hash",
      sourceKind: "email",
    },
  );
});

test("při překročení IP limitu zůstává prioritou ipHash", () => {
  assert.deepEqual(
    selectPublicBookingRateLimitNotificationSource({
      ipRateLimitAllowed: false,
      ipHash: "ip-hash",
      emailHash: "email-hash",
    }),
    {
      sourceHash: "ip-hash",
      sourceKind: "ip",
    },
  );
});
