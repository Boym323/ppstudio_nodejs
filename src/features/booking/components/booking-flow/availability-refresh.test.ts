import assert from "node:assert/strict";
import test from "node:test";

import {
  getRefreshedSelectedDateKey,
  isPublicBookingAvailabilityError,
  isRescheduleAvailabilityError,
} from "./availability-refresh";

test("obnovení veřejné rezervace reaguje jen na konflikty termínu", () => {
  assert.equal(isPublicBookingAvailabilityError("SLOT_UNAVAILABLE", 2), true);
  assert.equal(isPublicBookingAvailabilityError("SLOT_NOT_ALLOWED", 2), true);
  assert.equal(isPublicBookingAvailabilityError("SLOT_TOO_SHORT", 2), true);
  assert.equal(isPublicBookingAvailabilityError("BOOKING_CONFLICT", 2), true);
  assert.equal(isPublicBookingAvailabilityError("BOOKING_CONFLICT", 3), false);
  assert.equal(isPublicBookingAvailabilityError("VOUCHER_INVALID", 3), false);
  assert.equal(isPublicBookingAvailabilityError("VALIDATION_ERROR", 3), false);
  assert.equal(isPublicBookingAvailabilityError("UNEXPECTED_ERROR", 4), false);
});

test("obnovení klientského přesunu reaguje i na souběžnou změnu rezervace", () => {
  assert.equal(isRescheduleAvailabilityError("CONFLICT"), true);
  assert.equal(isRescheduleAvailabilityError("CONCURRENT_MODIFICATION"), true);
  assert.equal(isRescheduleAvailabilityError("SAME_TERM"), false);
  assert.equal(isRescheduleAvailabilityError("INVALID_DATE_TIME"), false);
});

test("po obnovení zůstává vybraný den jen pokud má skutečně volný čas", () => {
  const availableDates = ["2026-08-05", "2026-08-07"];

  assert.equal(getRefreshedSelectedDateKey("2026-08-07", availableDates), "2026-08-07");
  assert.equal(getRefreshedSelectedDateKey("2026-08-06", availableDates), "2026-08-05");
  assert.equal(getRefreshedSelectedDateKey("2026-08-06", []), "");
});

test("po obnovení se nikdy nevrací zaniklý den ani se nevybírá konkrétní čas", () => {
  const availableDates = ["2026-08-06", "2026-08-08"];

  assert.equal(getRefreshedSelectedDateKey("2026-08-05", availableDates), "2026-08-06");
  assert.equal(getRefreshedSelectedDateKey("", availableDates), "2026-08-06");
});
