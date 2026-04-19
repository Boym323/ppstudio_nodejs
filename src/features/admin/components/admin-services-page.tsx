import { AdminPageShell, AdminPanel } from "@/features/admin/components/admin-page-shell";
import { AdminServiceForm } from "@/features/admin/components/admin-service-form";
import { AdminServicesList } from "@/features/admin/components/admin-services-list";
import { AdminServicesToolbar } from "@/features/admin/components/admin-services-toolbar";
import { formatServicePrice } from "@/features/admin/lib/admin-service-format";
import { getAdminServicesPageData } from "@/features/admin/lib/admin-services";
import { type AdminArea } from "@/config/navigation";

function toQueryString(searchParams?: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (typeof value === "string" && value.length > 0 && key !== "serviceId") {
      params.set(key, value);
    }
  }

  return params.toString();
}

export async function AdminServicesPage({
  area,
  searchParams,
}: {
  area: AdminArea;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const data = await getAdminServicesPageData(area, searchParams);
  const queryString = toQueryString(searchParams);
  const selectedServiceVisible =
    Boolean(data.selectedService) && data.services.some((service) => service.id === data.selectedService?.id);

  return (
    <AdminPageShell
      eyebrow={area === "owner" ? "Katalog služeb" : "Provozní nabídka"}
      title="Služby"
      description={
        area === "owner"
          ? "Jedno místo pro cenu, délku, pořadí i veřejnou rezervovatelnost. Změny se propsají do booking flow bez přepisu historických rezervací."
          : "Klidný přehled nabídky pro běžný provoz. Na mobilu jde rychle zkontrolovat délku i cenu a upravit to, co je potřeba."
      }
      stats={data.stats}
      compact={area === "salon"}
    >
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <AdminPanel
          title="Přehled služeb"
          description="Filtr je schválně krátký. V běžném provozu stačí najít službu, otevřít ji a upravit jen to, co je potřeba."
          compact={area === "salon"}
        >
          <AdminServicesToolbar
            currentPath={data.currentPath}
            filters={data.filters}
            selectedServiceName={data.selectedService?.name}
          />

          <div className="mt-5 grid gap-3 text-sm text-white/64 sm:grid-cols-2 lg:grid-cols-3">
            <p><span className="text-white">Služeb v seznamu:</span> {data.services.length}</p>
            <p><span className="text-white">Kategorií:</span> {data.categories.length}</p>
            <p><span className="text-white">Veřejně nabízené:</span> {data.services.filter((service) => service.isPubliclyBookable).length}</p>
          </div>

          {data.selectedService && !selectedServiceVisible ? (
            <div className="mt-5 rounded-[1.25rem] border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-50">
              Vybraná služba je mimo aktuální filtr. Seznam zůstává zúžený, ale editace dole je pořád otevřená.
            </div>
          ) : null}

          <div className="mt-5">
            <AdminServicesList
              currentPath={data.currentPath}
              currentServiceId={data.selectedService?.id}
              queryString={queryString}
              services={data.services}
            />
          </div>
        </AdminPanel>

        <AdminPanel
          title={data.selectedService ? `Editace: ${data.selectedService.name}` : "Editace služby"}
          description={
            data.selectedService
              ? `Kategorie ${data.selectedService.category.name} • ${data.selectedService.durationMinutes} min • ${formatServicePrice(data.selectedService.priceFromCzk)}`
              : "Vyberte službu ze seznamu vlevo."
          }
          compact={area === "salon"}
        >
          {data.selectedService ? (
            <AdminServiceForm
              area={area}
              service={{
                id: data.selectedService.id,
                name: data.selectedService.name,
                shortDescription: data.selectedService.shortDescription,
                description: data.selectedService.description,
                durationMinutes: data.selectedService.durationMinutes,
                priceFromCzk: data.selectedService.priceFromCzk,
                sortOrder: data.selectedService.sortOrder,
                isActive: data.selectedService.isActive,
                isPubliclyBookable: data.selectedService.isPubliclyBookable,
                categoryId: data.selectedService.categoryId,
                category: data.selectedService.category,
                _count: data.selectedService._count,
              }}
              categories={data.categories}
            />
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-white/14 bg-white/4 p-5">
              <p className="text-base font-medium text-white">Ve filtru není žádná služba k editaci.</p>
              <p className="mt-2 text-sm leading-6 text-white/62">
                Zkuste změnit filtr nebo znovu otevřít kompletní seznam služeb.
              </p>
            </div>
          )}
        </AdminPanel>
      </div>
    </AdminPageShell>
  );
}
