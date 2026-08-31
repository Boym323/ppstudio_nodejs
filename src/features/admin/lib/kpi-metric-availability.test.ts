import assert from "node:assert/strict";
import test from "node:test";

import { getKpiMetricPreviousAvailability } from "./kpi-metric-availability";

test("nulové tržby a návštěvy jsou validní period totals, availability určuje occupancy", () => {
  const withAvailability = getKpiMetricPreviousAvailability({ completedCount: 0, completedClientCount: 0, physicalAvailabilityMinutes: 240, relevantDisruptionCount: 0 });
  assert.equal(withAvailability.periodTotals, true);
  assert.equal(withAvailability.occupancy, true);
  assert.equal(withAvailability.averageSpend, false);
  assert.equal(withAvailability.disruptionRates, false);

  const withoutAvailability = getKpiMetricPreviousAvailability({ completedCount: 0, completedClientCount: 0, physicalAvailabilityMinutes: 0, relevantDisruptionCount: 0 });
  assert.equal(withoutAvailability.occupancy, false);
});

test("expected revenue nikdy nepoužije falešné předchozí srovnání", () => {
  const availability = getKpiMetricPreviousAvailability({ completedCount: 3, completedClientCount: 2, physicalAvailabilityMinutes: 240, relevantDisruptionCount: 3 });
  assert.equal(availability.expectedRevenue, false);
  assert.equal(availability.outstanding, true);
});
