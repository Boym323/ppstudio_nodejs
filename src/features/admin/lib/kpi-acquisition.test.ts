import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateAcquisition,
  normalizeAcquisitionMedium,
  normalizeAcquisitionSource,
} from "./kpi-acquisition";

test("normalizuje běžné aliasy zdrojů bez ohledu na mezery a velikost písmen", () => {
  assert.equal(normalizeAcquisitionSource(" ig "), "Instagram");
  assert.equal(normalizeAcquisitionSource("INSTAGRAM"), "Instagram");
  assert.equal(normalizeAcquisitionSource("FB"), "Facebook");
  assert.equal(normalizeAcquisitionSource(" FACEBOOK "), "Facebook");
  assert.equal(normalizeAcquisitionSource("google"), "Google");
  assert.equal(normalizeAcquisitionSource("FIRMY_CZ"), "Firmy.cz");
  assert.equal(normalizeAcquisitionSource("firmy.cz"), "Firmy.cz");
  assert.equal(normalizeAcquisitionSource("seznam"), "Sklik");
});

test("rozlišuje přímý vstup od chybějícího a zachová čitelný neznámý zdroj", () => {
  assert.equal(normalizeAcquisitionSource(null, { isDirect: true }), "Přímý vstup");
  assert.equal(normalizeAcquisitionSource("", { isDirect: true }), "Přímý vstup");
  assert.equal(normalizeAcquisitionSource(null), "Neznámý zdroj");
  assert.equal(normalizeAcquisitionSource("  Partner X  "), "Partner X");
  assert.equal(normalizeAcquisitionMedium("  CPC "), "CPC");
});

test("agregace sloučí aliasy a zachová kontrolní součty", () => {
  const result = aggregateAcquisition([
    { acquisitionSource: null, utmSource: "ig", utmMedium: "social", utmCampaign: "letni", isCompleted: true, bookingValue: 1000 },
    { acquisitionSource: null, utmSource: " INSTAGRAM ", utmMedium: "Social media", utmCampaign: "letni", isCompleted: true, bookingValue: 1200 },
    { acquisitionSource: "DIRECT", utmSource: null, utmMedium: null, utmCampaign: null, isCompleted: false, bookingValue: 700 },
    { acquisitionSource: null, utmSource: "", utmMedium: null, utmCampaign: null, isCompleted: false, bookingValue: 300 },
  ]);
  const instagram = result.summary.find((row) => row.source === "Instagram");
  assert.deepEqual(instagram && { bookings: instagram.bookings, revenue: instagram.revenue }, { bookings: 2, revenue: 2200 });
  assert.equal(result.summary.reduce((sum, row) => sum + row.bookings, 0), 4);
  assert.equal(result.summary.reduce((sum, row) => sum + row.bookingValue, 0), 3200);
  assert.equal(result.summary.reduce((sum, row) => sum + row.revenue, 0), 2200);
  assert.equal(result.detail.reduce((sum, row) => sum + row.bookings, 0), 4);
});
