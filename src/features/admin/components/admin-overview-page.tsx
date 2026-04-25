import { Suspense } from "react";

import { getAdminDashboardData } from "../lib/admin-dashboard";
import {
  DashboardPage,
  DashboardPageSkeleton,
} from "@/features/admin/components/admin-dashboard-page";

type AdminOverviewPageProps = {
  area: "owner" | "salon";
};

export function AdminOverviewPage({ area }: AdminOverviewPageProps) {
  return (
    <Suspense fallback={<DashboardPageSkeleton />}>
      <AdminOverviewContent area={area} />
    </Suspense>
  );
}

async function AdminOverviewContent({ area }: AdminOverviewPageProps) {
  const data = await getAdminDashboardData(area);

  return <DashboardPage data={data} />;
}
