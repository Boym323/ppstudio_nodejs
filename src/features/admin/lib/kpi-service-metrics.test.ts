import assert from "node:assert/strict";
import test from "node:test";

import { aggregateServiceMetrics } from "./kpi-service-metrics";

test("služby používají historickou cenu a skutečný rezervovaný interval", () => {
  const result = aggregateServiceMetrics([
    { serviceName: "Péče", finalPriceCzk: 1200, servicePriceFromCzk: 900, scheduledStartsAt: new Date("2026-07-01T08:00:00Z"), scheduledEndsAt: new Date("2026-07-01T09:00:00Z") },
    { serviceName: "Péče", finalPriceCzk: 1500, servicePriceFromCzk: 900, scheduledStartsAt: new Date("2026-07-02T08:00:00Z"), scheduledEndsAt: new Date("2026-07-02T10:30:00Z") },
  ]);
  assert.deepEqual(result[0], { name: "Péče", completed: 2, revenue: 2700, reservedMinutes: 210, share: 100, averagePrice: 1350, revenuePerHour: 2700 / 3.5 });
});

test("prázdné služby a nulový čas nevedou k dělení nulou", () => {
  assert.deepEqual(aggregateServiceMetrics([]), []);
  const result = aggregateServiceMetrics([{ serviceName: "Bez času", finalPriceCzk: 500, servicePriceFromCzk: null, scheduledStartsAt: new Date("2026-07-01T08:00:00Z"), scheduledEndsAt: new Date("2026-07-01T08:00:00Z") }]);
  assert.equal(result[0].revenuePerHour, null);
});
