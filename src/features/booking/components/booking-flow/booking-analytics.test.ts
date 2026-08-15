import assert from "node:assert/strict";
import test from "node:test";

import {
  formatBookingMatomoSlotName,
  formatSuggestedSlotSelectionMatomoName,
  formatSuggestedSlotsDisplayedMatomoName,
  getSuggestedSlotPosition,
  getSuggestedSlotsDisplayKey,
  getVisibleSuggestedSlots,
  isBookingTermConflictErrorCode,
  shouldTrackBookingDateSelection,
  shouldTrackSuggestedSlotsDisplay,
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

test("doporučené termíny se měří jednou pro stejnou zobrazenou sadu a znovu při její změně", () => {
  const firstSet = getSuggestedSlotsDisplayKey("korejsky-lash-lifting", [
    { key: "slot-1" },
    { key: "slot-2" },
  ]);
  const changedSet = getSuggestedSlotsDisplayKey("korejsky-lash-lifting", [
    { key: "slot-3" },
  ]);

  assert.equal(shouldTrackSuggestedSlotsDisplay(null, ""), false);
  assert.equal(shouldTrackSuggestedSlotsDisplay(null, firstSet), true);
  assert.equal(shouldTrackSuggestedSlotsDisplay(firstSet, firstSet), false);
  assert.equal(shouldTrackSuggestedSlotsDisplay(firstSet, changedSet), true);
  assert.equal(
    shouldTrackSuggestedSlotsDisplay(firstSet, getSuggestedSlotsDisplayKey("jina-sluzba", [{ key: "slot-1" }])),
    true,
  );
});

test("impression key na mobilu ignoruje mobilně skryté doporučené karty", () => {
  const desktopSlots = [
    { key: "slot-1" }, { key: "slot-2" }, { key: "slot-3" },
    { key: "slot-4" }, { key: "slot-5" }, { key: "slot-6" },
  ];
  const changedOnlyHiddenDesktopSlots = [...desktopSlots.slice(0, 4), { key: "slot-5-changed" }, { key: "slot-6" }];

  const mobileKey = getSuggestedSlotsDisplayKey("korejsky-lash-lifting", getVisibleSuggestedSlots(desktopSlots, 4));
  const mobileKeyWithHiddenChange = getSuggestedSlotsDisplayKey(
    "korejsky-lash-lifting",
    getVisibleSuggestedSlots(changedOnlyHiddenDesktopSlots, 4),
  );

  assert.equal(mobileKeyWithHiddenChange, mobileKey);
  assert.equal(shouldTrackSuggestedSlotsDisplay(mobileKey, mobileKeyWithHiddenChange), false);
});

test("výběr doporučení používá canonical key a vrací 1-based pozici", () => {
  const suggestedSlots = [
    { key: "slot-1", startsAt: "2026-09-03T08:00:00.000Z", endsAt: "2026-09-03T09:15:00.000Z" },
    { key: "slot-2", startsAt: "2026-09-03T09:30:00.000Z", endsAt: "2026-09-03T10:45:00.000Z" },
    { key: "slot-3", startsAt: "2026-09-03T10:00:00.000Z", endsAt: "2026-09-03T11:15:00.000Z" },
    { key: "slot-4", startsAt: "2026-09-03T10:30:00.000Z", endsAt: "2026-09-03T11:45:00.000Z" },
    { key: "slot-5", startsAt: "2026-09-03T11:00:00.000Z", endsAt: "2026-09-03T12:15:00.000Z" },
    { key: "slot-6", startsAt: "2026-09-03T12:00:00.000Z", endsAt: "2026-09-03T13:15:00.000Z" },
  ];

  assert.equal(getSuggestedSlotPosition({ key: "slot-1" }, suggestedSlots), 1);
  assert.equal(getSuggestedSlotPosition({ key: "slot-6" }, suggestedSlots), 6);
  assert.equal(getSuggestedSlotPosition({ key: "other-slot-1" }, suggestedSlots), null);
  assert.equal(
    formatSuggestedSlotSelectionMatomoName(
      suggestedSlots[0].startsAt,
      suggestedSlots[0].endsAt,
      "korejsky-lash-lifting",
      1,
    ),
    "2026-09-03 | 10:00–11:15 | korejsky-lash-lifting | pozice 1",
  );
  assert.equal(formatSuggestedSlotsDisplayedMatomoName("jana@example.com-voucher"), "unknown-service");
});

test("shouldTrackBookingServiceSelectedForPrefill skips duplicate funnel event for prefilled service", () => {
  assert.equal(shouldTrackBookingServiceSelectedForPrefill(true), false);
  assert.equal(shouldTrackBookingServiceSelectedForPrefill(false), true);
});
