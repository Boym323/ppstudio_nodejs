import assert from "node:assert/strict";
import test from "node:test";

import {
  isBookingTermConflictErrorCode,
  shouldTrackBookingDateSelection,
  shouldTrackBookingServiceSelectedForPrefill,
} from "./booking-analytics";

test("isBookingTermConflictErrorCode recognizes booking conflict style submit failures", () => {
  assert.equal(isBookingTermConflictErrorCode("BOOKING_CONFLICT", 2), true);
  assert.equal(isBookingTermConflictErrorCode("SLOT_UNAVAILABLE"), true);
  assert.equal(isBookingTermConflictErrorCode("SLOT_NOT_ALLOWED"), true);
  assert.equal(isBookingTermConflictErrorCode("SLOT_TOO_SHORT"), true);
});

test("isBookingTermConflictErrorCode ignores non-conflict and missing error codes", () => {
  assert.equal(isBookingTermConflictErrorCode("BOOKING_CONFLICT", 3), false);
  assert.equal(isBookingTermConflictErrorCode("VOUCHER_INVALID"), false);
  assert.equal(isBookingTermConflictErrorCode("UNEXPECTED_ERROR"), false);
  assert.equal(isBookingTermConflictErrorCode(undefined), false);
});

test("shouldTrackBookingDateSelection only tracks a date when it changes", () => {
  assert.equal(shouldTrackBookingDateSelection(null, "2026-07-08"), true);
  assert.equal(shouldTrackBookingDateSelection("2026-07-08", "2026-07-08"), false);
  assert.equal(shouldTrackBookingDateSelection("2026-07-08", "2026-07-09"), true);
  assert.equal(shouldTrackBookingDateSelection("2026-07-08", ""), false);
});

test("shouldTrackBookingServiceSelectedForPrefill skips duplicate funnel event for prefilled service", () => {
  assert.equal(shouldTrackBookingServiceSelectedForPrefill(true), false);
  assert.equal(shouldTrackBookingServiceSelectedForPrefill(false), true);
});
