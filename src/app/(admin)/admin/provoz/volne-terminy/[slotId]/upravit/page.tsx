import { AdminSlotsResetPage } from "@/features/admin/components/admin-slots-reset-page";
import { requireAdminSectionAccess } from "@/features/admin/lib/admin-guards";

type SalonEditSlotPageProps = {
  params: Promise<{
    slotId: string;
  }>;
};

export default async function SalonEditSlotPage({ params }: SalonEditSlotPageProps) {
  await requireAdminSectionAccess("salon", "volne-terminy");
  const { slotId } = await params;
  return <AdminSlotsResetPage area="salon" mode="edit" slotId={slotId} />;
}
