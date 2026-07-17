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
      eyebrow="Klientská databáze"
      title="Klienti"
      description="Rychlý seznam kontaktů, rezervací a poznámek."
      denseIntro
    >
      <div className="grid gap-4">
        <ClientsStatsStrip stats={data.stats} />

        <AdminPanel
          title="Seznam klientů"
          description={data.filters.retention ? `Retenční stav k ${new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeZone: "Europe/Prague" }).format(data.retentionReference)}.` : undefined}
          denseHeader
          compact={area === "salon"}
        >
          <AdminClientsToolbar currentPath={data.currentPath} filters={data.filters} />

          <div className="mt-4 grid gap-2 text-sm text-white/62 sm:grid-cols-3">
            <p><span className="text-white">V seznamu:</span> {data.clients.length} z {data.pagination.totalCount}</p>
            <p><span className="text-white">Filtr:</span> {labelForQuickFilter(data.filters.quick)} · {labelForStatus(data.filters.status)}</p>
            <p><span className="text-white">Řazení:</span> {labelForSort(data.filters.sort)}</p>
          </div>

          <div className="mt-4">
            <AdminClientsList area={area} clients={data.clients} resetHref={data.currentPath} retentionReference={data.filters.retention ? data.retentionReference : undefined} />
          </div>
          {data.pagination.hasNextPage && data.pagination.nextCursor ? (
            <div className="mt-4 flex justify-center">
              <a
                href={buildNextPageHref(data.currentPath, data.filters, data.pagination.nextCursor)}
                className="inline-flex rounded-full border border-white/10 px-4 py-2 text-sm text-white/80 transition hover:border-white/18 hover:bg-white/6"
              >
                Načíst dalších 50 klientů
              </a>
            </div>
          ) : null}
        </AdminPanel>
      </div>
    </AdminPageShell>
  );
}

function buildNextPageHref(
  currentPath: string,
  filters: { query: string; status: string; sort: string; quick: string; retention?: string; retentionAt?: string },
  cursor: string,
) {
  const params = new URLSearchParams({ cursor });

  if (filters.query) params.set("query", filters.query);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.sort !== "recent") params.set("sort", filters.sort);
  if (filters.quick !== "all") params.set("quick", filters.quick);
  if (filters.retention) params.set("retention", filters.retention);
  if (filters.retentionAt) params.set("retentionAt", filters.retentionAt);

  return `${currentPath}?${params.toString()}`;
}

function ClientsStatsStrip({
  stats,
}: {
  stats: Array<{
    label: string;
    value: string;
  }>;
}) {
  return (
    <section className="rounded-[1.1rem] border border-white/8 bg-white/4 px-4 py-3 text-sm text-white/70">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0">
            <p className="truncate text-[11px] uppercase tracking-[0.18em] text-white/48">{stat.label}</p>
            <p className="mt-1 font-display text-2xl leading-none text-white">{stat.value}</p>
          </div>
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

function labelForQuickFilter(quickFilter: string) {
  switch (quickFilter) {
    case "with_booking":
      return "s rezervací";
    case "without_booking":
      return "bez rezervace";
    case "no_contact":
      return "bez kontaktu";
    case "noted":
      return "s poznámkou";
    case "new_30":
      return "nové za 30 dní";
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
