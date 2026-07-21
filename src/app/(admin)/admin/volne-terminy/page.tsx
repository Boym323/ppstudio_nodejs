import { AdminWeeklyPlannerLabPage } from "@/features/admin/components/admin-weekly-planner-lab-page";
import { requireAdminSectionAccess } from "@/features/admin/lib/admin-guards";

export default async function PlannerPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  await requireAdminSectionAccess("owner", "volne-terminy");
  const { week } = await searchParams;

  return <AdminWeeklyPlannerLabPage area="owner" week={week} routeBase="/admin/volne-terminy" />;
}
