export type KpiTimeSeriesPoint = {
  periodStart: string;
};

/** Řadí výhradně podle strojového ISO začátku období, nikdy podle lokalizovaného popisku. */
export function sortKpiTimeSeries<T extends KpiTimeSeriesPoint>(points: T[]) {
  return [...points].sort(
    (left, right) => Date.parse(left.periodStart) - Date.parse(right.periodStart),
  );
}

export function completeKpiTimeSeries<T extends KpiTimeSeriesPoint>(
  periodStarts: Date[],
  points: T[],
  createEmpty: (periodStart: string) => T,
) {
  const byPeriod = new Map(points.map((point) => [point.periodStart, point]));
  return periodStarts.map((periodStart) => {
    const key = periodStart.toISOString();
    return byPeriod.get(key) ?? createEmpty(key);
  });
}
