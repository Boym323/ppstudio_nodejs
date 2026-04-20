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
          ? "Jeden přehled pro kontakty, historii rezervací a interní kontext ke vztahu se salonem."
          : "Rychlý adresář klientek s historií a poznámkami pro běžný provoz."
      }
      stats={data.stats}
      compact={area === "salon"}
    >
      <div className="grid gap-6">
        <AdminPanel
          title="Seznam klientů"
          description="Najdi klientku podle jména, kontaktu nebo poznámky a otevři její detail."
          compact={area === "salon"}
        >
          <AdminClientsToolbar currentPath={data.currentPath} filters={data.filters} />

          <div className="mt-5 grid gap-3 text-sm text-white/64 sm:grid-cols-3">
            <p><span className="text-white">V seznamu:</span> {data.clients.length}</p>
            <p><span className="text-white">Aktivní filtr:</span> {labelForStatus(data.filters.status)}</p>
            <p><span className="text-white">Řazení:</span> {labelForSort(data.filters.sort)}</p>
          </div>

          <div className="mt-5">
            <AdminClientsList area={area} clients={data.clients} />
          </div>
        </AdminPanel>
      </div>
    </AdminPageShell>
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
