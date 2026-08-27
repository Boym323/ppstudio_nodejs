import assert from "node:assert/strict";
import test from "node:test";

import { getKpiExpectedRevenueRange } from "./kpi-date-range";
import { calculateExpectedRevenue, type ExpectedRevenueBooking } from "./kpi-expected-revenue";

const booking = (overrides: Partial<ExpectedRevenueBooking> = {}): ExpectedRevenueBooking => ({
  status: "CONFIRMED",
  scheduledStartsAt: new Date("2026-07-20T10:00:00.000Z"),
  finalPriceCzk: 1200,
  servicePriceFromCzk: 1000,
  ...overrides,
});
const july = { start: new Date("2026-06-30T22:00:00.000Z"), end: new Date("2026-07-31T22:00:00.000Z") };

test("počítá jen potvrzenou budoucí rezervaci uvnitř aktuálního měsíce s historickou cenou", () => {
  const result = calculateExpectedRevenue([
    booking({ finalPriceCzk: 1350 }),
    booking({ scheduledStartsAt: new Date("2026-08-01T10:00:00.000Z") }),
    booking({ status: "CANCELLED" }),
    booking({ finalPriceCzk: null, servicePriceFromCzk: null }),
  ], july);
  assert.deepEqual(result, { amount: 1350, bookingCount: 1, missingPriceCount: 1 });
});

test("potvrzená rezervace zůstává očekávanou tržbou i po archivaci původního slotu", () => {
  const archivedSlotBooking = {
    ...booking({ finalPriceCzk: 1200 }),
    slotStatus: "ARCHIVED",
  };

  assert.deepEqual(calculateExpectedRevenue([archivedSlotBooking], july), {
    amount: 1200,
    bookingCount: 1,
    missingPriceCount: 0,
  });
});

test("historické období nemá očekávané tržby", () => {
  assert.deepEqual(calculateExpectedRevenue([booking()], null), { amount: 0, bookingCount: 0, missingPriceCount: 0 });
});

test("respektuje konec roku a hranici půlnoci v časové zóně Praha", () => {
  const range = {
    start: new Date("2026-12-31T22:30:00.000Z"),
    end: new Date("2026-12-31T23:00:00.000Z"),
    label: "Tento rok",
    period: "this_year" as const,
  };
  const expectedRange = getKpiExpectedRevenueRange(range, new Date("2026-12-31T22:30:00.000Z"));
  assert.equal(expectedRange?.end.toISOString(), "2026-12-31T23:00:00.000Z");
  assert.deepEqual(calculateExpectedRevenue([
    booking({ scheduledStartsAt: new Date("2026-12-31T22:45:00.000Z") }),
    booking({ scheduledStartsAt: new Date("2026-12-31T23:00:00.000Z") }),
  ], expectedRange), { amount: 1200, bookingCount: 1, missingPriceCount: 0 });
});

test("vlastní období používá průnik s aktuálním okamžikem", () => {
  const range = { start: new Date("2026-07-01T00:00:00.000Z"), end: new Date("2026-07-31T22:00:00.000Z"), label: "Vlastní", period: "custom" as const };
  const expectedRange = getKpiExpectedRevenueRange(range, new Date("2026-07-15T12:00:00.000Z"));
  assert.equal(expectedRange?.start.toISOString(), "2026-07-15T12:00:00.000Z");
  assert.deepEqual(calculateExpectedRevenue([
    booking({ scheduledStartsAt: new Date("2026-07-15T11:00:00.000Z") }),
    booking({ scheduledStartsAt: new Date("2026-07-15T13:00:00.000Z") }),
  ], expectedRange), { amount: 1200, bookingCount: 1, missingPriceCount: 0 });
});
