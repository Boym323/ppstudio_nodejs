import { notFound } from "next/navigation";

import { AdminSlotForm } from "@/features/admin/components/admin-slot-form";
import { AdminPageShell, AdminPanel } from "@/features/admin/components/admin-page-shell";
import { getAdminSlotFormData } from "@/features/admin/lib/admin-slots";
import { requireAdminSectionAccess } from "@/features/admin/lib/admin-guards";

type SalonEditSlotPageProps = {
  params: Promise<{
    slotId: string;
  }>;
};

export default async function SalonEditSlotPage({ params }: SalonEditSlotPageProps) {
  await requireAdminSectionAccess("salon", "volne-terminy");
  const { slotId } = await params;
  const data = await getAdminSlotFormData(slotId);

  if (!data?.slot) {
    notFound();
  }

  return (
    <AdminPageShell
      eyebrow="Úprava termínu"
      title="Upravit termín"
      description="Rychlá provozní úprava se stejnou server-side ochranou jako full admin."
      compact
    >
      <AdminPanel
        title="Nastavení termínu"
        description="Když se změní čas, kapacita nebo služby, server znovu ověří konzistenci."
        compact
      >
        <AdminSlotForm
          area="salon"
          mode="edit"
          slotId={slotId}
          defaultValues={data.slot}
          services={data.services}
        />
      </AdminPanel>
    </AdminPageShell>
  );
}
