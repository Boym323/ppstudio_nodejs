import assert from "node:assert/strict";
import test from "node:test";

import { getKpiClientMetrics, getKpiClientMetricsFromAggregates } from "./kpi-client-metrics";

const range = {
  start: new Date("2026-06-01T00:00:00.000Z"),
  end: new Date("2026-07-01T00:00:00.000Z"),
  label: "Červen 2026",
  period: "custom" as const,
};
const visit = (clientId: string | null, date: string, isCompleted = true) => ({ clientId, scheduledStartsAt: new Date(date), isCompleted });

test("KPI klientek rozlišuje první, předchozí a opakované dokončené návštěvy", () => {
  const result = getKpiClientMetrics([
    visit("new-repeat", "2026-06-03T10:00:00.000Z"),
    visit("new-repeat", "2026-06-18T10:00:00.000Z"),
    visit("returning", "2026-05-20T10:00:00.000Z"),
    visit("returning", "2026-06-10T10:00:00.000Z"),
    visit("single", "2026-06-12T10:00:00.000Z"),
  ], range);

  assert.equal(result.newClients, 2);
  assert.equal(result.returningClients, 1);
  assert.equal(result.repeatVisitClients, 1);
  assert.ok(Math.abs(result.repeatVisitRate - 100 / 3) < 0.000_001);
});

test("storno, no-show a rezervace bez clientId nejsou vstupem do dokončených klientských metrik", () => {
  const result = getKpiClientMetrics([
    visit("cancelled-before-completion", "2026-05-10T10:00:00.000Z", false),
    visit("no-show", "2026-06-08T10:00:00.000Z", false),
    visit(null, "2026-05-10T10:00:00.000Z"),
    visit(null, "2026-06-10T10:00:00.000Z"),
    visit("completed-after-cancel", "2026-06-15T10:00:00.000Z"),
  ], range);

  assert.deepEqual(result, {
    newClients: 1,
    returningClients: 0,
    repeatVisitClients: 0,
    repeatVisitRate: 0,
  });
});

test("agregované KPI klientek zachovají výsledek bez načtení celé historie", () => {
  const result = getKpiClientMetricsFromAggregates([
    { clientId: "new-repeat", visitCount: 2, firstVisitAt: new Date("2026-06-03T10:00:00.000Z") },
    { clientId: "returning", visitCount: 1, firstVisitAt: new Date("2026-06-10T10:00:00.000Z") },
    { clientId: "single", visitCount: 1, firstVisitAt: new Date("2026-06-12T10:00:00.000Z") },
  ], [
    { clientId: "returning", visitCount: 1, firstVisitAt: new Date("2026-05-20T10:00:00.000Z") },
  ], [], range);

  assert.equal(result.newClients, 2);
  assert.equal(result.returningClients, 1);
  assert.equal(result.repeatVisitClients, 1);
  assert.ok(Math.abs(result.repeatVisitRate - 100 / 3) < 0.000_001);
});

test("agregované KPI používají historické minimum i pro předchozí období", () => {
  const result = getKpiClientMetricsFromAggregates([
    { clientId: "returning", visitCount: 1, firstVisitAt: new Date("2026-05-20T10:00:00.000Z") },
  ], [], [
    { clientId: "returning", visitCount: 3, firstVisitAt: new Date("2026-04-20T10:00:00.000Z") },
  ], {
    ...range,
    start: new Date("2026-05-01T00:00:00.000Z"),
    end: new Date("2026-06-01T00:00:00.000Z"),
  });

  assert.deepEqual(result, {
    newClients: 0,
    returningClients: 1,
    repeatVisitClients: 0,
    repeatVisitRate: 0,
  });
});
