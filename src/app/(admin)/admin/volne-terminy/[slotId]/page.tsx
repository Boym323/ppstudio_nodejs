import { AdminSlotsResetPage } from "@/features/admin/components/admin-slots-reset-page";
import { requireAdminSectionAccess } from "@/features/admin/lib/admin-guards";

type OwnerSlotDetailPageProps = {
  params: Promise<{
    slotId: string;
  }>;
};

export default async function OwnerSlotDetailPage({ params }: OwnerSlotDetailPageProps) {
  await requireAdminSectionAccess("owner", "volne-terminy");
  const { slotId } = await params;
  return <AdminSlotsResetPage area="owner" mode="detail" slotId={slotId} />;
}
