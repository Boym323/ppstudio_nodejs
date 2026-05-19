import assert from "node:assert/strict";
import test from "node:test";

import { isAnalyticsDashboardData } from "./AnalyticsWidget";

test("isAnalyticsDashboardData accepts payload with contactStepQuality", () => {
  const payload = {
    reportingStatus: "ok",
    periodLabel: "Dnes",
    visits: 10,
    conversions: 2,
    conversionRate: 20,
    topSource: "Přímý vstup",
    sources: [{ label: "Přímý vstup", visits: 10, conversions: 2 }],
    funnel: {
      service: 8,
      date: 6,
      time: 5,
      created: 2,
    },
    contactStepQuality: {
      started: 4,
      fieldFocus: 3,
      fieldInputStarted: 2,
      fieldError: 1,
      focusRate: 75,
      inputRate: 50,
      errorRate: 25,
    },
  } satisfies Record<string, unknown>;

  assert.equal(isAnalyticsDashboardData(payload), true);
});

test("isAnalyticsDashboardData rejects payload missing contactStepQuality", () => {
  const payload = {
    reportingStatus: "ok",
    periodLabel: "Dnes",
    visits: 10,
    conversions: 2,
    conversionRate: 20,
    topSource: "Přímý vstup",
    sources: [{ label: "Přímý vstup", visits: 10, conversions: 2 }],
    funnel: {
      service: 8,
      date: 6,
      time: 5,
      created: 2,
    },
  } satisfies Record<string, unknown>;

  assert.equal(isAnalyticsDashboardData(payload), false);
});
