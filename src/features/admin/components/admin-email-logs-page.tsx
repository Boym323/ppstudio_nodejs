import { type AdminArea } from "@/config/navigation";

import { type EmailLogsDashboardData } from "../lib/admin-data";
import { AdminEmailLogsWorkspace } from "./admin-email-logs-workspace";
import { AdminPageShell } from "./admin-page-shell";

type AdminEmailLogsPageProps = {
  area: AdminArea;
  data: EmailLogsDashboardData;
};

export function AdminEmailLogsPage({ area, data }: AdminEmailLogsPageProps) {
  const compactStats = data.stats.filter((stat) => stat.label !== "Poslední odeslání");

  return (
    <AdminPageShell
      eyebrow={area === "owner" ? "E-mailový provoz" : "Provozní sekce"}
      title="Email logy"
      description={
        area === "owner"
          ? "Rychlý provozní přehled doručování, fronty a posledních zpráv."
          : "Zjednodušený přehled e-mailů není v provozní sekci dostupný."
      }
      stats={compactStats}
      compactStats
      slimStats
      compact={area === "salon"}
      denseIntro
    >
      <AdminEmailLogsWorkspace data={data} />
    </AdminPageShell>
  );
}
