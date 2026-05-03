import { type AdminArea } from "@/config/navigation";

import { type EmailLogsDashboardData } from "../lib/admin-data";
import { AdminEmailLogsWorkspace } from "./admin-email-logs-workspace";
import { AdminPageShell } from "./admin-page-shell";

type AdminEmailLogsPageProps = {
  area: AdminArea;
  data: EmailLogsDashboardData;
};

export function AdminEmailLogsPage({ area, data }: AdminEmailLogsPageProps) {
  return (
    <AdminPageShell
      eyebrow={area === "owner" ? "Email observability" : "Provozní sekce"}
      title="Komunikace se zákaznicemi"
      description={
        area === "owner"
          ? "Rychlý přehled, jestli emaily fungují, co odešlo naposledy a kde je potřeba zásah."
          : "Zjednodušený přehled e-mailů není v provozní sekci dostupný."
      }
      stats={data.stats}
      compactStats
      slimStats
      compact={area === "salon"}
    >
      <AdminEmailLogsWorkspace data={data} />
    </AdminPageShell>
  );
}
