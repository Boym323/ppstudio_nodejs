import assert from "node:assert/strict";
import test from "node:test";

import { interpretKpiComparison } from "./kpi-comparison";

const metric = (value: number, previousValue: number, previousHasData: boolean) => ({ value, previousValue, previousHasData, difference: value - previousValue, change: previousHasData && previousValue ? ((value - previousValue) / previousValue) * 100 : null });

test("rozliší chybějící historii a skutečnou nulu", () => {
  assert.equal(interpretKpiComparison(metric(10, 0, false)).state, "unavailable");
  assert.equal(interpretKpiComparison(metric(10, 0, true)).state, "new");
});

test("interpretuje růst a pokles", () => {
  assert.deepEqual(interpretKpiComparison(metric(15, 10, true)), { state: "available", direction: "up", isFavorable: true });
  assert.deepEqual(interpretKpiComparison(metric(5, 10, true)), { state: "available", direction: "down", isFavorable: false });
});

test("u negativního KPI je pokles příznivý", () => {
  assert.deepEqual(interpretKpiComparison(metric(5, 10, true), { lowerIsBetter: true }), { state: "available", direction: "down", isFavorable: true });
});

test("obsazenost lze srovnat bez hodnocení vyšší kapacity jako lepšího výsledku", () => {
  assert.deepEqual(interpretKpiComparison(metric(95, 70, true), { neutral: true }), { state: "available", direction: "up", isFavorable: null });
  assert.deepEqual(interpretKpiComparison(metric(70, 95, true), { neutral: true }), { state: "available", direction: "down", isFavorable: null });
  assert.deepEqual(interpretKpiComparison(metric(70, 0, true), { neutral: true }), { state: "new", direction: "up", isFavorable: null });
});
