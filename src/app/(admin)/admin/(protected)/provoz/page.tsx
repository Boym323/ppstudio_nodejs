import { AdminOverviewPage } from "@/features/admin/components/admin-overview-page";
import { requireAdminArea } from "@/lib/auth/session";

export default async function OperationsDashboardPage() {
  await requireAdminArea("salon");

  return <AdminOverviewPage area="salon" />;
}
