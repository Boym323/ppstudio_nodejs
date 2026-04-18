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
          ? "Přehled fronty, retry pokusů a posledních chyb potvrzovacích e-mailů a storno notifikací. Každý záznam otevře detail s payloadem a operacemi."
          : "Zjednodušený přehled e-mailů není v provozní sekci dostupný."
      }
      stats={data.stats}
      compact={area === "salon"}
    >
      <div className="grid gap-6 xl:grid-cols-3">
        <AdminPanel
          title="Pending fronta"
          description="Záznamy připravené k nejbližšímu zpracování workerem."
          compact
        >
          <AdminKeyValueList
            items={data.pendingItems}
            emptyTitle="Pending fronta je prázdná."
            emptyDescription="Jakmile přijde nový booking nebo storno e-mail, objeví se tady."
          />
        </AdminPanel>

        <AdminPanel
          title="Retry pokusy"
          description="E-maily, které se po chybě vrací do fronty pro další pokus."
          compact
        >
          <AdminKeyValueList
            items={data.retryingItems}
            emptyTitle="Žádné retry pokusy."
            emptyDescription="Pokud worker narazí na dočasnou chybu, objeví se záznam tady."
          />
        </AdminPanel>

        <AdminPanel
          title="Poslední chyby"
          description="Selhané doručení s posledním uloženým textem chyby."
          compact
        >
          <AdminKeyValueList
            items={data.failedItems}
            emptyTitle="Žádné poslední chyby."
            emptyDescription="Jakmile nějaké doručení po retry politice selže, uvidíš ho tady."
          />
        </AdminPanel>
      </div>
    </AdminPageShell>
  );
}
