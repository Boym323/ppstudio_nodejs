import { type AdminArea } from "@/config/navigation";
import {
  AdminPageShell,
  AdminPanel,
} from "@/features/admin/components/admin-page-shell";
import { AdminServiceCategoriesList } from "@/features/admin/components/admin-service-categories-list";
import { AdminServiceCategoryForm } from "@/features/admin/components/admin-service-category-form";
import { getAdminServiceCategoriesPageData } from "@/features/admin/lib/admin-service-categories";

function buildListQueryString(searchParams?: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (
      typeof value === "string" &&
      value.length > 0 &&
      key !== "categoryId" &&
      key !== "mobileDetail" &&
      key !== "mode"
    ) {
      params.set(key, value);
    }
  }

  return params.toString();
}

function CategoryToolbar({
  currentPath,
  createHref,
  filters,
  selectedCategoryName,
}: {
  currentPath: string;
  createHref: string;
  filters: {
    query: string;
    status: string;
    sort: string;
    categoryId?: string;
  };
  selectedCategoryName?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-[1.35rem] border border-white/8 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-white">Struktura katalogu</p>
          <p className="mt-1 text-sm leading-6 text-white/62">
            Kategorie drží pořadí a orientaci pro salon i web. Novou založíte bez odchodu ze seznamu.
          </p>
        </div>

        <a
          href={createHref}
          className="inline-flex rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105"
        >
          Nová kategorie
        </a>
      </div>

      <form className="grid gap-3 rounded-[1.35rem] border border-white/8 bg-white/5 p-4 sm:grid-cols-2 xl:grid-cols-4">
        {filters.categoryId ? <input type="hidden" name="categoryId" value={filters.categoryId} /> : null}

        <label className="block sm:col-span-2 xl:col-span-2">
          <span className="text-xs uppercase tracking-[0.2em] text-white/50">Najít kategorii</span>
          <input
            type="search"
            name="query"
            defaultValue={filters.query}
            placeholder="Název nebo text"
            className="mt-2 w-full rounded-[1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[var(--color-accent)]/60"
          />
        </label>

        <SelectField name="status" label="Stav" defaultValue={filters.status}>
          <option value="all" className="text-black">Vše</option>
          <option value="active" className="text-black">Aktivní</option>
          <option value="inactive" className="text-black">Skryté</option>
        </SelectField>

        <SelectField name="sort" label="Řazení" defaultValue={filters.sort}>
          <option value="order" className="text-black">Pořadí</option>
          <option value="name" className="text-black">Název</option>
          <option value="services" className="text-black">Podle počtu služeb</option>
        </SelectField>

        <div className="flex flex-col gap-2 sm:col-span-2 xl:col-span-4">
          {selectedCategoryName ? (
            <p className="text-sm text-white/62">
              Otevřená kategorie: <span className="text-white">{selectedCategoryName}</span>
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105"
            >
              Filtrovat
            </button>
            <a
              href={currentPath}
              className="rounded-full border border-white/10 px-5 py-3 text-sm text-white/80 transition hover:border-white/18 hover:bg-white/6"
            >
              Zrušit filtr
            </a>
          </div>
        </div>
      </form>
    </div>
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

export async function AdminServiceCategoriesPage({
  area,
  searchParams,
}: {
  area: AdminArea;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const data = await getAdminServiceCategoriesPageData(area, searchParams);
  const queryString = buildListQueryString(searchParams);
  const returnTo = queryString ? `${data.currentPath}?${queryString}` : data.currentPath;
  const createHref = `${returnTo}${queryString ? "&" : "?"}mode=create${data.filters.mobileDetail === "1" ? "&mobileDetail=1" : ""}`;
  const showMobileDetail = data.filters.mobileDetail === "1" || data.filters.mode === "create";

  const detailContent =
    data.filters.mode === "create" ? (
      <AdminServiceCategoryForm
        mode="create"
        area={area}
        currentPath={data.currentPath}
        servicesPath={data.servicesPath}
        returnTo={returnTo}
        initialValues={{
          name: "",
          description: "",
          isActive: true,
        }}
      />
    ) : data.selectedCategory ? (
      <AdminServiceCategoryForm
        mode="edit"
        area={area}
        currentPath={data.currentPath}
        servicesPath={data.servicesPath}
        returnTo={returnTo}
        category={{
          id: data.selectedCategory.id,
          name: data.selectedCategory.name,
          description: data.selectedCategory.description,
          sortOrder: data.selectedCategory.sortOrder,
          isActive: data.selectedCategory.isActive,
          _count: data.selectedCategory._count,
          services: data.selectedCategory.services,
          warnings: data.categories.find((category) => category.id === data.selectedCategory?.id)?.warnings ?? [],
          counts: data.selectedCategoryCounts,
        }}
      />
    ) : (
      <div className="rounded-[1.5rem] border border-dashed border-white/14 bg-white/4 p-5">
        <p className="text-base font-medium text-white">Ve filtru není žádná kategorie k úpravě.</p>
        <p className="mt-2 text-sm leading-6 text-white/62">
          Zkuste změnit filtr nebo otevřít celý seznam kategorií.
        </p>
      </div>
    );

  return (
    <AdminPageShell
      eyebrow={area === "owner" ? "Struktura katalogu" : "Pořadí nabídky"}
      title="Kategorie služeb"
      description={
        area === "owner"
          ? "Klidná správa struktury, pořadí a kontextu navázaných služeb bez technického šumu."
          : "Rychlá orientace v kategoriích, které drží nabídku salonu přehlednou."
      }
      stats={data.stats}
      compact={area === "salon"}
    >
      <div className="xl:hidden">
        {showMobileDetail ? (
          <AdminPanel
            title={data.filters.mode === "create" ? "Nová kategorie" : data.selectedCategory ? `Editace: ${data.selectedCategory.name}` : "Detail kategorie"}
            description={
              data.filters.mode === "create"
                ? "Na mobilu je detail oddělený od seznamu, aby práce s katalogem nebyla nepříjemně dlouhá."
                : data.selectedCategory
                  ? `Na kategorii je navázáno ${data.selectedCategory._count.services} služeb.`
                  : "Vyberte kategorii ze seznamu."
            }
            compact={area === "salon"}
          >
            <a
              href={returnTo}
              className="mb-4 inline-flex rounded-full border border-white/10 px-4 py-2 text-sm text-white/80 transition hover:border-white/18 hover:bg-white/6"
            >
              Zpět na seznam
            </a>
            {detailContent}
          </AdminPanel>
        ) : (
          <AdminPanel
            title="Přehled kategorií"
            description="Kategorie mají být rychle čitelné: stav, počet služeb a varování bez zbytečného rozklikávání."
            compact={area === "salon"}
          >
            <CategoryToolbar
              currentPath={data.currentPath}
              createHref={createHref}
              filters={data.filters}
              selectedCategoryName={data.selectedCategory?.name}
            />

            <div className="mt-5">
              <AdminServiceCategoriesList
                area={area}
                currentPath={data.currentPath}
                servicesPath={data.servicesPath}
                currentCategoryId={data.selectedCategory?.id}
                queryString={queryString}
                returnTo={returnTo}
                categories={data.categories}
              />
            </div>
          </AdminPanel>
        )}
      </div>

      <div className="hidden gap-6 xl:grid xl:grid-cols-[1.05fr_0.95fr]">
        <AdminPanel
          title="Přehled kategorií"
          description="Seznam dává rychlý provozní kontext: pořadí, počty služeb a varování jsou vidět hned."
          compact={area === "salon"}
        >
          <CategoryToolbar
            currentPath={data.currentPath}
            createHref={createHref}
            filters={data.filters}
            selectedCategoryName={data.selectedCategory?.name}
          />

          <div className="mt-5 grid gap-3 text-sm text-white/64 sm:grid-cols-2 lg:grid-cols-4">
            <p><span className="text-white">Kategorií v seznamu:</span> {data.categories.length}</p>
            <p><span className="text-white">Prázdných:</span> {data.categories.filter((category) => category.counts.total === 0).length}</p>
            <p><span className="text-white">Bez veřejné služby:</span> {data.categories.filter((category) => category.isActive && category.counts.public === 0).length}</p>
            <p><span className="text-white">S upozorněním:</span> {data.categories.filter((category) => category.warnings.length > 0).length}</p>
          </div>

          <div className="mt-5">
            <AdminServiceCategoriesList
              area={area}
              currentPath={data.currentPath}
              servicesPath={data.servicesPath}
              currentCategoryId={data.selectedCategory?.id}
              queryString={queryString}
              returnTo={returnTo}
              categories={data.categories}
            />
          </div>
        </AdminPanel>

        <AdminPanel
          title={
            data.filters.mode === "create"
              ? "Nová kategorie"
              : data.selectedCategory
                ? `Editace: ${data.selectedCategory.name}`
                : "Editace kategorie"
          }
          description={
            data.filters.mode === "create"
              ? "Nová kategorie se po vytvoření rovnou otevře v detailu a můžete do ní hned přidat služby."
              : data.selectedCategory
                ? `Na kategorii je navázáno ${data.selectedCategory._count.services} služeb. Když ji vypnete, služby zůstanou uložené pro interní použití.`
                : "Vyberte kategorii ze seznamu vlevo."
          }
          compact={area === "salon"}
        >
          {detailContent}
        </AdminPanel>
      </div>
    </AdminPageShell>
  );
}
