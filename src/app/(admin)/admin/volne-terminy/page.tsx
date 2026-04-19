import { AdminSlotsResetPage } from "@/features/admin/components/admin-slots-reset-page";
import { requireAdminSectionAccess } from "@/features/admin/lib/admin-guards";

export default async function OwnerSlotsPage() {
  await requireAdminSectionAccess("owner", "volne-terminy");
  return <AdminSlotsResetPage area="owner" mode="list" />;
}
