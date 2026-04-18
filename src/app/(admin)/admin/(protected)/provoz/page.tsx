import { AdminRole } from "@prisma/client";

import { AdminDashboard } from "@/features/admin/components/admin-dashboard";
import { requireRole } from "@/lib/auth/session";

export default async function OperationsDashboardPage() {
  const session = await requireRole([AdminRole.OWNER, AdminRole.SALON]);

  return (
    <AdminDashboard
      role={session.role}
      title="Lehký provozní vstup pro každodenní obsluhu salonu."
      description="Lite admin má být rychlý, přehledný a zaměřený jen na úkoly, které provoz opravdu potřebuje. Tím zůstane rozhraní použitelné i na mobilu nebo během rušného dne na recepci."
      cards={[
        {
          title: "Dnešní termíny",
          body: "Připravený prostor pro rychlé zobrazení nejbližších rezervací a provozních poznámek.",
        },
        {
          title: "Kontakt s klientkou",
          body: "Sem se hodí potvrzení, změny stavu rezervace a základní komunikační workflow.",
        },
        {
          title: "Rychlé zásahy",
          body: "Později sem patří jednoduché akce nad termíny bez přístupu ke strategickému nastavení salonu.",
        },
      ]}
    />
  );
}
