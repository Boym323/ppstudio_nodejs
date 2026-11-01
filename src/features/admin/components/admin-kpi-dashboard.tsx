import { Suspense } from "react";

import { getKpiDashboardData } from "@/features/admin/lib/kpi-dashboard";
import { getMetaAdsCostReport } from "@/features/admin/lib/meta-ads-reporting";

import { AdminKpiDashboardPage, AdminKpiDashboardSkeleton } from "./admin-kpi-dashboard-page";

export function AdminKpiDashboard({ area, searchParams }: { area: "owner" | "salon"; searchParams?: Record<string, string | string[] | undefined> }) {
  return <Suspense fallback={<AdminKpiDashboardSkeleton />} key={JSON.stringify(searchParams ?? {})}><Content area={area} searchParams={searchParams} /></Suspense>;
}
async function Content({ area, searchParams }: { area: "owner" | "salon"; searchParams?: Record<string, string | string[] | undefined> }) {
  const data = await getKpiDashboardData(area, searchParams);
  const metaAds = await getMetaAdsCostReport(data.range);
  return <AdminKpiDashboardPage area={area} searchParams={searchParams} data={data} metaAds={metaAds} />;
}
