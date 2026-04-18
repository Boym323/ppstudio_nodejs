import { AdminOverviewPage } from "@/features/admin/components/admin-overview-page";
import { requireAdminArea } from "@/lib/auth/session";

export default async function OwnerDashboardPage() {
  await requireAdminArea("owner");

  return <AdminOverviewPage area="owner" />;
}
