export function getKpiMetricPreviousAvailability(input: {
  completedCount: number;
  completedClientCount: number;
  physicalAvailabilityMinutes: number;
  relevantDisruptionCount: number;
}) {
  return {
    periodTotals: true,
    averageSpend: input.completedCount > 0,
    occupancy: input.physicalAvailabilityMinutes > 0,
    repeatVisitRate: input.completedClientCount > 0,
    disruptionRates: input.relevantDisruptionCount > 0,
    expectedRevenue: false,
    outstanding: input.completedCount > 0,
  };
}
