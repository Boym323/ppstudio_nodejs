import { AdminWeeklyPlannerLabPage } from "@/features/admin/components/admin-weekly-planner-lab-page";
import { requireAdminSectionAccess } from "@/features/admin/lib/admin-guards";

export default async function PlannerPage({ searchParams }: { searchParams: Promise<{ week?: string; day?: string }> }) {
  await requireAdminSectionAccess("owner", "volne-terminy");
  const { week, day } = await searchParams;

  return <AdminWeeklyPlannerLabPage area="owner" week={week} day={day} routeBase="/admin/volne-terminy" />;
}
