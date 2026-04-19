import { type AdminArea } from "@/config/navigation";

import { getAdminSectionTitle } from "../lib/admin-data";
import { type EmailLogsDashboardData } from "../lib/admin-data";
import { AdminKeyValueList, AdminPageShell, AdminPanel } from "./admin-page-shell";

type AdminEmailLogsPageProps = {
  area: AdminArea;
  data: EmailLogsDashboardData;
};

export function AdminEmailLogsPage({ area, data }: AdminEmailLogsPageProps) {
  return (
    <AdminPageShell
      eyebrow={area === "owner" ? "Email observability" : "Provozní sekce"}
      title={getAdminSectionTitle("email-logy")}
      description={
        area === "owner"
          ? "Přehled fronty, pokusů o doručení a posledních chyb potvrzovacích e-mailů i storno notifikací."
          : "Zjednodušený přehled e-mailů není v provozní sekci dostupný."
      }
      stats={data.stats}
      compact={area === "salon"}
    >
      <div className="grid gap-6 xl:grid-cols-3">
        <AdminPanel
          title="Pending fronta"
          description="Záznamy připravené ke zpracování."
          compact
        >
          <AdminKeyValueList
            items={data.pendingItems}
            emptyTitle="Fronta je prázdná."
            emptyDescription="Jakmile přijde nový e-mail, objeví se tady."
          />
        </AdminPanel>

        <AdminPanel
          title="Retry pokusy"
          description="E-maily, které se po chybě zkusí znovu."
          compact
        >
          <AdminKeyValueList
            items={data.retryingItems}
            emptyTitle="Žádné opakované pokusy."
            emptyDescription="Pokud přijde dočasná chyba, objeví se záznam tady."
          />
        </AdminPanel>

        <AdminPanel
          title="Poslední chyby"
          description="Selhané doručení s poslední uloženou chybou."
          compact
        >
          <AdminKeyValueList
            items={data.failedItems}
            emptyTitle="Žádné poslední chyby."
            emptyDescription="Jakmile doručení selže, uvidíš ho tady."
          />
        </AdminPanel>
      </div>
    </AdminPageShell>
  );
}
