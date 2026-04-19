import { notFound } from "next/navigation";

import { AdminSlotForm } from "@/features/admin/components/admin-slot-form";
import { AdminPageShell, AdminPanel } from "@/features/admin/components/admin-page-shell";
import { getAdminSlotFormData } from "@/features/admin/lib/admin-slots";
import { requireAdminSectionAccess } from "@/features/admin/lib/admin-guards";

export default async function OwnerCreateSlotPage() {
  await requireAdminSectionAccess("owner", "volne-terminy");
  const data = await getAdminSlotFormData();

  if (!data) {
    notFound();
  }

  return (
    <AdminPageShell
      eyebrow="Nový slot"
      title="Vytvořit volný termín"
      description="Ručně založený slot je základ provozu. Všechny důležité kontroly proběhnou server-side před uložením."
    >
      <AdminPanel
        title="Parametry slotu"
        description="Nastav čas, stav a případné omezení na služby."
      >
        <AdminSlotForm area="owner" mode="create" services={data.services} />
      </AdminPanel>
    </AdminPageShell>
  );
}
