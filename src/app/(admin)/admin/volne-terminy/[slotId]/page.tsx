import { notFound } from "next/navigation";

import { AdminSlotDetailPage } from "@/features/admin/components/admin-slot-detail-page";
import {
  getAdminSlotDetailData,
  getSlotFlashMeta,
} from "@/features/admin/lib/admin-slots";
import { requireAdminSectionAccess } from "@/features/admin/lib/admin-guards";

type OwnerSlotDetailPageProps = {
  params: Promise<{
    slotId: string;
  }>;
  searchParams: Promise<{
    flash?: string;
  }>;
};

export default async function OwnerSlotDetailPage({
  params,
  searchParams,
}: OwnerSlotDetailPageProps) {
  await requireAdminSectionAccess("owner", "volne-terminy");
  const { slotId } = await params;
  const { flash } = await searchParams;
  const data = await getAdminSlotDetailData("owner", slotId);

  if (!data) {
    notFound();
  }

  return <AdminSlotDetailPage area="owner" data={data} flash={getSlotFlashMeta(flash)} />;
}
