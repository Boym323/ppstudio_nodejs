export type KpiPeriod = "this_month" | "last_month" | "last_30_days" | "this_year" | "custom";

export type KpiDateRange = {
  start: Date;
  end: Date;
  label: string;
  period: KpiPeriod;
};

export type KpiMetric = {
  value: number;
  previousValue: number;
  previousHasData: boolean;
  change: number | null;
  difference: number;
};

export type KpiDashboardData = {
  range: KpiDateRange;
  previousRange: KpiDateRange;
  calculatedAt: Date;
  metrics: Record<"revenue" | "completed" | "averageSpend" | "occupancy" | "newClients" | "returningClients" | "repeatVisitClients" | "repeatVisitRate" | "cancellations" | "cancellationRate" | "cancellationValue" | "noShows" | "noShowRate" | "noShowValue" | "expectedRevenue" | "outstanding", KpiMetric>;
  revenueSeries: Array<{ periodStart: string; label: string; revenue: number }>;
  bookingSeries: Array<{ periodStart: string; label: string; completed: number; cancelled: number; noShow: number }>;
  services: Array<{ name: string; completed: number; revenue: number; share: number; averagePrice: number; reservedMinutes: number; revenuePerHour: number | null }>;
  clientMix: { newClients: number; returningClients: number };
  retention: Array<{ band: "8_11" | "12_15" | "16_plus"; label: string; count: number; href: string }>;
  retentionReference: Date;
  acquisition: {
    summary: Array<{ source: string; bookings: number; completed: number; bookingValue: number; revenue: number; averageValue: number }>;
    detail: Array<{ source: string; medium: string; campaign: string; bookings: number; completed: number; bookingValue: number; revenue: number; averageValue: number }>;
  };
  expectedRevenue: { bookingCount: number; missingPriceCount: number; isHistorical: boolean };
  unavailable: { hasData: boolean };
};
