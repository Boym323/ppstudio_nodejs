import { AdminSlotsResetPage } from "@/features/admin/components/admin-slots-reset-page";
import { requireAdminSectionAccess } from "@/features/admin/lib/admin-guards";

export default async function SalonCreateSlotPage() {
  await requireAdminSectionAccess("salon", "volne-terminy");
  return <AdminSlotsResetPage area="salon" mode="create" />;
}
