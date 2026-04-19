import { AdminSlotsResetPage } from "@/features/admin/components/admin-slots-reset-page";
import { requireAdminSectionAccess } from "@/features/admin/lib/admin-guards";

export default async function SalonSlotsPage() {
  await requireAdminSectionAccess("salon", "volne-terminy");
  return <AdminSlotsResetPage area="salon" mode="list" />;
}
