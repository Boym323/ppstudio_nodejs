import { notFound } from "next/navigation";

import { AdminSlotDetailPage } from "@/features/admin/components/admin-slot-detail-page";
import {
  getAdminSlotDetailData,
  getSlotFlashMessage,
} from "@/features/admin/lib/admin-slots";
import { requireAdminSectionAccess } from "@/features/admin/lib/admin-guards";

type SalonSlotDetailPageProps = {
  params: Promise<{
    slotId: string;
  }>;
  searchParams: Promise<{
    flash?: string;
  }>;
};

export default async function SalonSlotDetailPage({
  params,
  searchParams,
}: SalonSlotDetailPageProps) {
  await requireAdminSectionAccess("salon", "volne-terminy");
  const { slotId } = await params;
  const { flash } = await searchParams;
  const data = await getAdminSlotDetailData("salon", slotId);

  if (!data) {
    notFound();
  }

  return <AdminSlotDetailPage area="salon" data={data} flashMessage={getSlotFlashMessage(flash)} />;
}
