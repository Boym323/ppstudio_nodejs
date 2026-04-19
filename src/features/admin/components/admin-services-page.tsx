import { AdminPageShell, AdminPanel } from "@/features/admin/components/admin-page-shell";
import { AdminServiceForm } from "@/features/admin/components/admin-service-form";
import { AdminServicesList } from "@/features/admin/components/admin-services-list";
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
          description="Filtr zůstává jednoduchý: rychlé hledání, stav služby a veřejná rezervovatelnost."
          compact={area === "salon"}
        >
          <form className="grid gap-3 rounded-[1.35rem] border border-white/8 bg-white/5 p-4 sm:grid-cols-2 xl:grid-cols-4">
            <label className="block sm:col-span-2 xl:col-span-1">
              <span className="text-xs uppercase tracking-[0.2em] text-white/50">Hledat</span>
              <input
                type="search"
                name="query"
                defaultValue={data.filters.query}
                placeholder="Název, slug nebo kategorie"
                className="mt-2 w-full rounded-[1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[var(--color-accent)]/60"
              />
            </label>

            <SelectField name="status" label="Stav" defaultValue={data.filters.status}>
              <option value="all" className="text-black">Všechny</option>
              <option value="active" className="text-black">Aktivní</option>
              <option value="inactive" className="text-black">Neaktivní</option>
            </SelectField>

            <SelectField name="bookable" label="Rezervace" defaultValue={data.filters.bookable}>
              <option value="all" className="text-black">Všechny</option>
              <option value="public" className="text-black">Veřejné</option>
              <option value="private" className="text-black">Jen interní</option>
            </SelectField>

            <SelectField name="sort" label="Řazení" defaultValue={data.filters.sort}>
              <option value="category" className="text-black">Kategorie</option>
              <option value="order" className="text-black">Pořadí</option>
              <option value="name" className="text-black">Název</option>
              <option value="duration" className="text-black">Délka</option>
              <option value="price" className="text-black">Cena</option>
            </SelectField>

            <div className="flex items-end gap-3 sm:col-span-2 xl:col-span-4">
              <button
                type="submit"
                className="rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105"
              >
                Filtrovat
              </button>
              <a
                href={data.currentPath}
                className="rounded-full border border-white/10 px-5 py-3 text-sm text-white/80 transition hover:border-white/18 hover:bg-white/6"
              >
                Reset
              </a>
            </div>
          </form>

          <div className="mt-5 grid gap-3 text-sm text-white/64 sm:grid-cols-2 lg:grid-cols-4">
            <p><span className="text-white">Služeb:</span> {data.services.length}</p>
            <p><span className="text-white">Aktivní výběr:</span> {data.selectedService?.name ?? "Žádná"}</p>
            <p><span className="text-white">Kategorie:</span> {data.categories.length}</p>
            <p><span className="text-white">Ceny:</span> v Kč bez DPH logiky navíc</p>
          </div>

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

function SelectField({
  name,
  label,
  defaultValue,
  children,
}: {
  name: string;
  label: string;
  defaultValue: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.2em] text-white/50">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-[1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
      >
        {children}
      </select>
    </label>
  );
}
