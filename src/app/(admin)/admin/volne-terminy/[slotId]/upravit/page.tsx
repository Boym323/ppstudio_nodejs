import { notFound } from "next/navigation";

import { AdminSlotForm } from "@/features/admin/components/admin-slot-form";
import { AdminPageShell, AdminPanel } from "@/features/admin/components/admin-page-shell";
import { getAdminSlotFormData } from "@/features/admin/lib/admin-slots";
import { requireAdminSectionAccess } from "@/features/admin/lib/admin-guards";

type OwnerEditSlotPageProps = {
  params: Promise<{
    slotId: string;
  }>;
};

export default async function OwnerEditSlotPage({ params }: OwnerEditSlotPageProps) {
  await requireAdminSectionAccess("owner", "volne-terminy");
  const { slotId } = await params;
  const data = await getAdminSlotFormData(slotId);

  if (!data?.slot) {
    notFound();
  }

  return (
    <AdminPageShell
      eyebrow="Úprava slotu"
      title="Upravit volný termín"
      description="Úprava zůstává bezpečná i ve chvíli, kdy už je na slot navázaná rezervace."
    >
      <AdminPanel
        title="Parametry slotu"
        description="Server při uložení znovu ověří čas, kapacitu, omezení služeb i kolize."
      >
        <AdminSlotForm
          area="owner"
          mode="edit"
          slotId={slotId}
          defaultValues={data.slot}
          services={data.services}
        />
      </AdminPanel>
    </AdminPageShell>
  );
}
