import { type KpiMetric } from "@/features/admin/types/kpi-dashboard";

export type KpiComparison = {
  state: "available" | "new" | "unavailable";
  direction: "up" | "down" | "flat";
  isFavorable: boolean | null;
};

export function interpretKpiComparison(metric: KpiMetric, options: { lowerIsBetter?: boolean } = {}): KpiComparison {
  if (!metric.previousHasData) return { state: "unavailable", direction: "flat", isFavorable: null };
  if (metric.previousValue === 0) return { state: "new", direction: metric.value > 0 ? "up" : "flat", isFavorable: metric.value > 0 ? !options.lowerIsBetter : null };
  const direction = metric.difference > 0 ? "up" : metric.difference < 0 ? "down" : "flat";
  return { state: "available", direction, isFavorable: direction === "flat" ? null : options.lowerIsBetter ? direction === "down" : direction === "up" };
}
