import assert from "node:assert/strict";
import test from "node:test";

import { getRestorableSlotEnd } from "./booking-slot-compaction";

test("storno obnoví úklid uvnitř původně vypsané dostupnosti", () => {
  const serviceEnd = new Date("2026-08-31T09:30:00.000Z");
  const originalAvailabilityEnd = new Date("2026-08-31T10:00:00.000Z");

  assert.deepEqual(
    getRestorableSlotEnd(serviceEnd, [{ originalAvailabilityEndsAt: originalAvailabilityEnd }]),
    originalAvailabilityEnd,
  );
});

test("storno nezveřejní úklid mimo původní dostupnost", () => {
  const serviceEnd = new Date("2026-08-31T15:00:00.000Z");

  assert.deepEqual(
    getRestorableSlotEnd(serviceEnd, [{ originalAvailabilityEndsAt: serviceEnd }]),
    serviceEnd,
  );
});
