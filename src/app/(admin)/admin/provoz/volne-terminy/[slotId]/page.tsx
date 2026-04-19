import { AdminSlotsResetPage } from "@/features/admin/components/admin-slots-reset-page";
import { requireAdminSectionAccess } from "@/features/admin/lib/admin-guards";

type SalonSlotDetailPageProps = {
  params: Promise<{
    slotId: string;
  }>;
};

export default async function SalonSlotDetailPage({ params }: SalonSlotDetailPageProps) {
  await requireAdminSectionAccess("salon", "volne-terminy");
  const { slotId } = await params;
  return <AdminSlotsResetPage area="salon" mode="detail" slotId={slotId} />;
}
