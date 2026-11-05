import assert from "node:assert/strict";
import test from "node:test";

import {
  parseTrackingConsent,
  serializeTrackingConsent,
} from "./tracking-consent";

test("cookie consent starts undecided and rejects malformed values", () => {
  assert.equal(parseTrackingConsent(undefined), null);
  assert.equal(parseTrackingConsent("a1m1extra"), null);
  assert.equal(parseTrackingConsent("true"), null);
});

test("analytic and marketing consent are independent opt-in categories", () => {
  for (const analytics of [false, true]) {
    for (const marketing of [false, true]) {
      const chosen = { analytics, marketing };
      assert.deepEqual(parseTrackingConsent(serializeTrackingConsent(chosen)), chosen);
    }
  }
});
