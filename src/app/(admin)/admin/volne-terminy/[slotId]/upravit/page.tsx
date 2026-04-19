import { AdminSlotsResetPage } from "@/features/admin/components/admin-slots-reset-page";
import { requireAdminSectionAccess } from "@/features/admin/lib/admin-guards";

type OwnerEditSlotPageProps = {
  params: Promise<{
    slotId: string;
  }>;
};

export default async function OwnerEditSlotPage({ params }: OwnerEditSlotPageProps) {
  await requireAdminSectionAccess("owner", "volne-terminy");
  const { slotId } = await params;
  return <AdminSlotsResetPage area="owner" mode="edit" slotId={slotId} />;
}
