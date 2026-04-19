import { notFound } from "next/navigation";

import { AdminSlotForm } from "@/features/admin/components/admin-slot-form";
import { AdminPageShell, AdminPanel } from "@/features/admin/components/admin-page-shell";
import { getAdminSlotFormData } from "@/features/admin/lib/admin-slots";
import { requireAdminSectionAccess } from "@/features/admin/lib/admin-guards";

export default async function SalonCreateSlotPage() {
  await requireAdminSectionAccess("salon", "volne-terminy");
  const data = await getAdminSlotFormData();

  if (!data) {
    notFound();
  }

  return (
    <AdminPageShell
      eyebrow="Nový termín"
      title="Přidat volný termín"
      description="Krátký formulář pro rychlé založení slotu bez zbytečných technických detailů."
      compact
    >
      <AdminPanel
        title="Nastavení termínu"
        description="Vyplň čas, stav a případně omez služby."
        compact
      >
        <AdminSlotForm area="salon" mode="create" services={data.services} />
      </AdminPanel>
    </AdminPageShell>
  );
}
