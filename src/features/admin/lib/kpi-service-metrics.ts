export type CompletedServiceVisit = {
  serviceName: string;
  finalPriceCzk: number | null;
  servicePriceFromCzk: number | null;
  scheduledStartsAt: Date;
  scheduledEndsAt: Date;
};

export type KpiServiceMetric = {
  name: string;
  completed: number;
  revenue: number;
  share: number;
  averagePrice: number;
  reservedMinutes: number;
  revenuePerHour: number;
};

export function aggregateServiceMetrics(visits: CompletedServiceVisit[]) {
  const rows = new Map<string, { completed: number; revenue: number; reservedMinutes: number }>();
  for (const visit of visits) {
    const row = rows.get(visit.serviceName) ?? { completed: 0, revenue: 0, reservedMinutes: 0 };
    const reservedMinutes = Math.max(0, (visit.scheduledEndsAt.getTime() - visit.scheduledStartsAt.getTime()) / 60_000);
    row.completed += 1;
    row.revenue += visit.finalPriceCzk ?? visit.servicePriceFromCzk ?? 0;
    row.reservedMinutes += reservedMinutes;
    rows.set(visit.serviceName, row);
  }
  const totalRevenue = [...rows.values()].reduce((sum, row) => sum + row.revenue, 0);
  return [...rows.entries()].map(([name, row]) => ({
    name,
    ...row,
    share: totalRevenue ? (row.revenue / totalRevenue) * 100 : 0,
    averagePrice: row.completed ? row.revenue / row.completed : 0,
    revenuePerHour: row.reservedMinutes ? row.revenue / (row.reservedMinutes / 60) : null,
  })).sort((left, right) => right.revenue - left.revenue);
}
