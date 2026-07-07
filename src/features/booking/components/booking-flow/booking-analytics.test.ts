import assert from "node:assert/strict";
import test from "node:test";

import { isBookingTermConflictErrorCode } from "./booking-analytics";

test("isBookingTermConflictErrorCode recognizes booking conflict style submit failures", () => {
  assert.equal(isBookingTermConflictErrorCode("BOOKING_CONFLICT"), true);
  assert.equal(isBookingTermConflictErrorCode("SLOT_UNAVAILABLE"), true);
  assert.equal(isBookingTermConflictErrorCode("SLOT_NOT_ALLOWED"), true);
  assert.equal(isBookingTermConflictErrorCode("SLOT_TOO_SHORT"), true);
});

test("isBookingTermConflictErrorCode ignores non-conflict and missing error codes", () => {
  assert.equal(isBookingTermConflictErrorCode("VOUCHER_INVALID"), false);
  assert.equal(isBookingTermConflictErrorCode("UNEXPECTED_ERROR"), false);
  assert.equal(isBookingTermConflictErrorCode(undefined), false);
});
