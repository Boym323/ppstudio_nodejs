import { Suspense } from "react";

import { getKpiDashboardData } from "@/features/admin/lib/kpi-dashboard";

import { AdminKpiDashboardPage, AdminKpiDashboardSkeleton } from "./admin-kpi-dashboard-page";

export function AdminKpiDashboard({ area, searchParams }: { area: "owner" | "salon"; searchParams?: Record<string, string | string[] | undefined> }) {
  return <Suspense fallback={<AdminKpiDashboardSkeleton />} key={JSON.stringify(searchParams ?? {})}><Content area={area} searchParams={searchParams} /></Suspense>;
}
async function Content({ area, searchParams }: { area: "owner" | "salon"; searchParams?: Record<string, string | string[] | undefined> }) { return <AdminKpiDashboardPage area={area} searchParams={searchParams} data={await getKpiDashboardData(area, searchParams)} />; }
