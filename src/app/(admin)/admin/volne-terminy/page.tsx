import { AdminSlotsPage } from "@/features/admin/components/admin-slots-page";
import { getAdminSlotListData } from "@/features/admin/lib/admin-slots";
import { requireAdminSectionAccess } from "@/features/admin/lib/admin-guards";

type OwnerSlotsPageProps = {
  searchParams: Promise<{
    week?: string;
    day?: string;
    status?: string;
    panel?: string;
    slot?: string;
    flash?: string;
  }>;
};

export default async function OwnerSlotsPage({ searchParams }: OwnerSlotsPageProps) {
  await requireAdminSectionAccess("owner", "volne-terminy");
  const params = await searchParams;
  const data = await getAdminSlotListData("owner", params);

  return <AdminSlotsPage area="owner" data={data} />;
}
