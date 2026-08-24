import assert from "node:assert/strict";
import test from "node:test";

import { formatBookingTimeRange } from "./booking-format";

test("časový rozsah rezervace vykreslí zimní čas salonu v Europe/Prague", () => {
  assert.equal(
    formatBookingTimeRange(
      new Date("2026-01-15T08:00:00.000Z"),
      new Date("2026-01-15T09:00:00.000Z"),
    ),
    "09:00 – 10:00",
  );
});

test("časový rozsah rezervace vykreslí letní čas salonu v Europe/Prague", () => {
  assert.equal(
    formatBookingTimeRange(
      new Date("2026-07-15T07:00:00.000Z"),
      new Date("2026-07-15T08:00:00.000Z"),
    ),
    "09:00 – 10:00",
  );
});
