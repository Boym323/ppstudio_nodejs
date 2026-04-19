import { AdminSlotsPage } from "@/features/admin/components/admin-slots-page";
import { getAdminSlotListData } from "@/features/admin/lib/admin-slots";
import { requireAdminSectionAccess } from "@/features/admin/lib/admin-guards";

type SalonSlotsPageProps = {
  searchParams: Promise<{
    week?: string;
    day?: string;
    status?: string;
    panel?: string;
    slot?: string;
    flash?: string;
  }>;
};

export default async function SalonSlotsPage({ searchParams }: SalonSlotsPageProps) {
  await requireAdminSectionAccess("salon", "volne-terminy");
  const params = await searchParams;
  const data = await getAdminSlotListData("salon", params);

  return <AdminSlotsPage area="salon" data={data} />;
}
