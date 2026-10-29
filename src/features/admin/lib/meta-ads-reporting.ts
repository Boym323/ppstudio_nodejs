import "server-only";

import { env } from "@/config/env";
import { getPragueDateParts, getPragueMidnight } from "@/features/admin/lib/kpi-date-range";
import { costPerBooking, countPaidMetaBookings, parseMetaAdsSpend } from "@/features/admin/lib/meta-ads-cost";
import type { KpiDateRange } from "@/features/admin/types/kpi-dashboard";
import { prisma } from "@/lib/prisma";

export type MetaAdsCostReport = {
  status: "disabled" | "error" | "future" | "ok";
  spend: number;
  currency: string | null;
  bookings: number;
  completed: number;
  costPerBooking: number | null;
  costPerCompleted: number | null;
  hasSpendData: boolean;
};

const empty: MetaAdsCostReport = {
  status: "disabled",
  spend: 0,
  currency: null,
  bookings: 0,
  completed: 0,
  costPerBooking: null,
  costPerCompleted: null,
  hasSpendData: false,
};

function pragueDateString(date: Date) {
  const { year, month, day } = getPragueDateParts(date);
  return [year, String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
}

/**
 * Read-only report: one aggregated Meta Ads Insights request and one DB GROUP BY.
 * Refreshes automatically when the owner opens statistics (Next fetch cache: 1h).
 * Meta token is sent only in the Authorization header, never in a URL or client prop.
 */
export async function getMetaAdsCostReport(range: KpiDateRange): Promise<MetaAdsCostReport> {
  const accountId = env.META_ADS_ACCOUNT_ID;
  const accessToken = env.META_ADS_ACCESS_TOKEN;
  if (!accountId || !accessToken) return empty;
  if (!/^\d+$/.test(accountId)) return { ...empty, status: "error" };

  const { year, month, day } = getPragueDateParts(new Date());
  const tomorrow = getPragueMidnight(year, month, day + 1);
  if (range.start >= tomorrow) return { ...empty, status: "future" };
  const endExclusive = new Date(Math.min(range.end.getTime(), tomorrow.getTime()));
  if (endExclusive <= range.start) return { ...empty, status: "future" };

  const query = new URL(`https://graph.facebook.com/v26.0/act_${accountId}/insights`);
  query.searchParams.set("fields", "spend,account_currency");
  query.searchParams.set("level", "account");
  query.searchParams.set("time_range", JSON.stringify({
    since: pragueDateString(range.start),
    until: pragueDateString(new Date(endExclusive.getTime() - 1)),
  }));

  try {
    const [response, groupedBookings] = await Promise.all([
      fetch(query, {
        headers: { Authorization: `Bearer ${accessToken}` },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(8000),
      }),
      prisma.booking.groupBy({
        by: ["acquisitionSource", "acquisitionUtmMedium", "status"],
        where: {
          source: "WEB",
          createdAt: { gte: range.start, lt: endExclusive },
        },
        _count: { _all: true },
      }),
    ]);
    if (!response.ok) return { ...empty, status: "error" };

    const payload: unknown = await response.json();
    const spendReport = parseMetaAdsSpend(payload);
    if (!spendReport) return { ...empty, status: "error" };

    const counts = countPaidMetaBookings(groupedBookings.map((row) => ({
      acquisitionSource: row.acquisitionSource,
      acquisitionUtmMedium: row.acquisitionUtmMedium,
      status: row.status,
      count: row._count._all,
    })));
    return {
      status: "ok",
      spend: spendReport.spend,
      currency: spendReport.currency,
      bookings: counts.bookings,
      completed: counts.completed,
      costPerBooking: costPerBooking(spendReport.spend, counts.bookings),
      costPerCompleted: costPerBooking(spendReport.spend, counts.completed),
      hasSpendData: spendReport.hasData,
    };
  } catch {
    // Analytics must never break the booking/KPI screen; do not log access tokens.
    return { ...empty, status: "error" };
  }
}
