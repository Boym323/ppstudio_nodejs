import assert from "node:assert/strict";
import test from "node:test";

import {
  formatBookingMatomoSlotName,
  isBookingTermConflictErrorCode,
  shouldTrackBookingDateSelection,
  shouldTrackBookingServiceSelectedForPrefill,
  shouldTrackBookingTimeSelection,
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

test("formatBookingMatomoSlotName keeps the local Prague date, time and public service slug", () => {
  const eventName = formatBookingMatomoSlotName(
    "2026-09-03T08:00:00.000Z",
    "2026-09-03T09:15:00.000Z",
    "korejsky-lash-lifting",
  );

  assert.equal(eventName, "2026-09-03 | 10:00–11:15 | korejsky-lash-lifting");
  const unsafeEventName = formatBookingMatomoSlotName(
    "2026-09-03T08:00:00.000Z",
    "2026-09-03T09:15:00.000Z",
    "jana@example.com-voucher",
  );

  assert.equal(unsafeEventName, "2026-09-03 | 10:00–11:15 | unknown-service");
  assert.doesNotMatch(unsafeEventName, /email|telefon|jméno|voucher|booking token|@/i);
});

test("shouldTrackBookingTimeSelection ignores a re-rendered slot and tracks a real slot change", () => {
  assert.equal(shouldTrackBookingTimeSelection(null, "slot-1000"), true);
  assert.equal(shouldTrackBookingTimeSelection("slot-1000", "slot-1000"), false);
  assert.equal(shouldTrackBookingTimeSelection("slot-1000", "slot-1330"), true);
});

test("shouldTrackBookingServiceSelectedForPrefill skips duplicate funnel event for prefilled service", () => {
  assert.equal(shouldTrackBookingServiceSelectedForPrefill(true), false);
  assert.equal(shouldTrackBookingServiceSelectedForPrefill(false), true);
});
