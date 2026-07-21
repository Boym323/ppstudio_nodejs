import { AdminWeeklyPlannerPage } from "@/features/admin/components/admin-weekly-planner-page";
import { requireAdminSectionAccess } from "@/features/admin/lib/admin-guards";

export default async function LegacyPlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; day?: string }>;
}) {
  await requireAdminSectionAccess("owner", "volne-terminy");
  const { week, day } = await searchParams;

  return <AdminWeeklyPlannerPage area="owner" week={week} day={day} />;
}
