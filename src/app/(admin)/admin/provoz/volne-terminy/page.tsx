import { AdminWeeklyPlannerPage } from "@/features/admin/components/admin-weekly-planner-lab-page";
import { requireAdminSectionAccess } from "@/features/admin/lib/admin-guards";

export default async function PlannerPage({ searchParams }: { searchParams: Promise<{ week?: string; day?: string }> }) {
  await requireAdminSectionAccess("salon", "volne-terminy");
  const { week, day } = await searchParams;

  return <AdminWeeklyPlannerPage area="salon" week={week} day={day} routeBase="/admin/provoz/volne-terminy" />;
}
