import assert from "node:assert/strict";
import test from "node:test";

import { aggregateAcquisition } from "./kpi-acquisition";
import { calculateDisruptionMetrics } from "./kpi-disruption-metrics";

const rows = [
  { status: "COMPLETED", price: 1_000, source: "ig" },
  { status: "COMPLETED", price: 1_500, source: "INSTAGRAM" },
  { status: "CANCELLED", price: 800, source: "google" },
  { status: "NO_SHOW", price: 700, source: "fb" },
  { status: "CONFIRMED", price: 1_200, source: "firmy.cz" },
] as const;

test("kontrolní součty stavů, hodnot a akvizice zůstávají konzistentní", () => {
  const completed = rows.filter((row) => row.status === "COMPLETED");
  const unfinished = rows.filter((row) => row.status !== "COMPLETED");
  const disruptions = calculateDisruptionMetrics(rows.map((row) => ({
    status: row.status,
    slotPublishedAt: new Date("2026-06-01T08:00:00.000Z"),
    finalPriceCzk: row.price,
    servicePriceFromCzk: null,
  })));
  const acquisition = aggregateAcquisition(rows.map((row) => ({
    acquisitionSource: row.source,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    isCompleted: row.status === "COMPLETED",
    bookingValue: row.price,
  })));

  assert.equal(
    disruptions.relevantCount,
    completed.length + disruptions.cancellations + disruptions.noShows + rows.filter((row) => row.status === "CONFIRMED").length,
  );
  assert.equal(
    rows.reduce((sum, row) => sum + row.price, 0),
    completed.reduce((sum, row) => sum + row.price, 0) + unfinished.reduce((sum, row) => sum + row.price, 0),
  );
  assert.equal(
    acquisition.summary.reduce((sum, row) => sum + row.revenue, 0),
    completed.reduce((sum, row) => sum + row.price, 0),
  );
  assert.equal(
    acquisition.summary.reduce((sum, row) => sum + row.completed, 0),
    completed.length,
  );
});

test("koncept a nepublikovaný záznam nejsou relevantní plánované rezervace", () => {
  const result = calculateDisruptionMetrics([
    { status: "DRAFT", slotPublishedAt: new Date(), finalPriceCzk: 900, servicePriceFromCzk: null },
    { status: "CONFIRMED", slotPublishedAt: null, finalPriceCzk: 900, servicePriceFromCzk: null },
  ]);

  assert.equal(result.relevantCount, 0);
  assert.equal(result.cancellationRate, 0);
  assert.equal(result.noShowRate, 0);
});
