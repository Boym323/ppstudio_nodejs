import { getAdminDashboardData } from "../lib/admin-dashboard";
import { DashboardPage } from "@/features/admin/components/admin-dashboard-page";

type AdminOverviewPageProps = {
  area: "owner" | "salon";
};

export async function AdminOverviewPage({ area }: AdminOverviewPageProps) {
  const data = await getAdminDashboardData(area);

  return <DashboardPage data={data} />;
}
