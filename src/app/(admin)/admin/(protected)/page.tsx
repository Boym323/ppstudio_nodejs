import { AdminRole } from "@prisma/client";

import { AdminDashboard } from "@/features/admin/components/admin-dashboard";
import { requireRole } from "@/lib/auth/session";

export default async function OwnerDashboardPage() {
  await requireRole([AdminRole.OWNER]);

  return (
    <AdminDashboard
      role={AdminRole.OWNER}
      title="Plný přehled značky, výkonu a rezervační logiky."
      description="Owner rozhraní je připravené pro strategické nastavení služeb, publikaci termínů, správu rezervací a budoucí reporting. Tahle vrstva má zůstat čistě oddělená od provozních každodenních úkonů."
      cards={[
        {
          title: "Služby a ceník",
          body: "Napoj sem správu kategorií, pořadí služeb a cenových variant bez zásahu do veřejného webu.",
        },
        {
          title: "Publikace termínů",
          body: "Sem přibude ruční vypisování slotů, publikace viditelnosti a kapacity pro online rezervace.",
        },
        {
          title: "Přehled rezervací",
          body: "Základ schema už počítá se stavem rezervace a napojením na konkrétní slot i službu.",
        },
      ]}
    />
  );
}
