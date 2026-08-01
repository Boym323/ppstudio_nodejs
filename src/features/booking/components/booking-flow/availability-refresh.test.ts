import assert from "node:assert/strict";
import test from "node:test";
import { AvailabilitySlotServiceRestrictionMode } from "@prisma/client";

import {
  getAvailableDateKeysForAvailability,
  getRefreshedDateSelection,
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

test("veřejná rezervace po zániku říjnového dne vybere září a zobrazí září", () => {
  const selection = getRefreshedDateSelection("2026-10-12", ["2026-09-18", "2026-10-20"]);

  assert.deepEqual(selection, {
    selectedDateKey: "2026-09-18",
    visibleMonthKey: "2026-09",
  });
});

test("klientský přesun po zániku říjnového dne vybere září a zobrazí září", () => {
  const selection = getRefreshedDateSelection("2026-10-12", ["2026-09-18", "2026-10-20"]);

  assert.deepEqual(selection, {
    selectedDateKey: "2026-09-18",
    visibleMonthKey: "2026-09",
  });
});

test("výpočet dostupných dnů používá nový katalog, službu a volné časy", () => {
  const catalog = {
    slots: [
      {
        id: "slot-zari",
        startsAt: "2026-09-18T08:00:00.000Z",
        endsAt: "2026-09-18T10:00:00.000Z",
        publicNote: null,
        capacity: 1,
        serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
        allowedServiceIds: [],
        bookedIntervals: [],
      },
      {
        id: "slot-rijen-nekompatibilni",
        startsAt: "2026-10-20T08:00:00.000Z",
        endsAt: "2026-10-20T10:00:00.000Z",
        publicNote: null,
        capacity: 1,
        serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.SELECTED,
        allowedServiceIds: ["other-service"],
        bookedIntervals: [],
      },
    ],
  };

  assert.deepEqual(
    getAvailableDateKeysForAvailability(catalog, "service-1", 60, 0),
    ["2026-09-18"],
  );
  assert.deepEqual(
    getAvailableDateKeysForAvailability(
      catalog,
      "service-1",
      60,
      0,
      "2026-09-18T08:00:00.000Z",
    ),
    ["2026-09-18"],
  );
});
