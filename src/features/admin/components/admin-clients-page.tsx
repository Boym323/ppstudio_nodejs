import { type AdminArea } from "@/config/navigation";
import { AdminClientsList } from "@/features/admin/components/admin-clients-list";
import { AdminClientsToolbar } from "@/features/admin/components/admin-clients-toolbar";
import { AdminPageShell, AdminPanel } from "@/features/admin/components/admin-page-shell";
import { getAdminClientsPageData } from "@/features/admin/lib/admin-clients";

export async function AdminClientsPage({
  area,
  searchParams,
}: {
  area: AdminArea;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const data = await getAdminClientsPageData(area, searchParams);

  return (
    <AdminPageShell
      eyebrow={area === "owner" ? "Klientská databáze" : "Provozní klientky"}
      title={area === "owner" ? "Klienti" : "Klientky"}
      description={
        area === "owner"
          ? "Rychlý seznam kontaktů, rezervací a poznámek."
          : "Rychlý adresář klientek pro běžný provoz."
      }
      compact={area === "salon"}
    >
      <div className="grid gap-4">
        <ClientsStatsStrip stats={data.stats} />

        <AdminPanel
          title="Seznam klientů"
          description="Najdi klienta podle jména, kontaktu nebo poznámky."
          denseHeader
          compact={area === "salon"}
        >
          <AdminClientsToolbar currentPath={data.currentPath} filters={data.filters} />

          <div className="mt-4 grid gap-2 text-sm text-white/62 sm:grid-cols-3">
            <p><span className="text-white">V seznamu:</span> {data.clients.length}</p>
            <p><span className="text-white">Aktivní filtr:</span> {labelForStatus(data.filters.status)}</p>
            <p><span className="text-white">Řazení:</span> {labelForSort(data.filters.sort)}</p>
          </div>

          <div className="mt-4">
            <AdminClientsList area={area} clients={data.clients} />
          </div>
        </AdminPanel>
      </div>
    </AdminPageShell>
  );
}

function ClientsStatsStrip({
  stats,
}: {
  stats: Array<{
    label: string;
    value: string;
  }>;
}) {
  const compactStats = stats.map((stat) => {
    switch (stat.label) {
      case "Aktivní klienti":
        return { label: "Aktivní", value: stat.value };
      case "Neaktivní klienti":
        return { label: "Neaktivní", value: stat.value };
      case "S interní poznámkou":
        return { label: "S poznámkou", value: stat.value };
      case "Aktivní za 30 dní":
        return { label: "Aktivní za 30 dní", value: stat.value };
      default:
        return stat;
    }
  });

  return (
    <section className="rounded-[1.1rem] border border-white/8 bg-white/4 px-4 py-2.5 text-sm text-white/70">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {compactStats.map((stat, index) => (
          <span key={stat.label} className="inline-flex items-center gap-2 whitespace-nowrap">
            <span className="text-white/58">{stat.label}</span>
            <span className="font-medium text-white">{stat.value}</span>
            {index < compactStats.length - 1 ? <span className="text-white/28">·</span> : null}
          </span>
        ))}
      </div>
    </section>
  );
}

function labelForStatus(status: string) {
  switch (status) {
    case "active":
      return "jen aktivní";
    case "inactive":
      return "jen neaktivní";
    default:
      return "vše";
  }
}

function labelForSort(sort: string) {
  switch (sort) {
    case "bookings":
      return "počet rezervací";
    case "name":
      return "jméno";
    case "created":
      return "nově přidané";
    case "recent":
    default:
      return "poslední návštěva";
  }
}
