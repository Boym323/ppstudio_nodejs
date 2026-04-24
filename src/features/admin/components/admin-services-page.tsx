import Link from "next/link";

import { AdminPageShell, AdminPanel } from "@/features/admin/components/admin-page-shell";
import { AdminServiceForm } from "@/features/admin/components/admin-service-form";
import { AdminServicesList } from "@/features/admin/components/admin-services-list";
import { AdminServicesToolbar } from "@/features/admin/components/admin-services-toolbar";
import { formatServicePrice } from "@/features/admin/lib/admin-service-format";
import { getAdminServicesPageData } from "@/features/admin/lib/admin-services";
import { type AdminArea } from "@/config/navigation";

function buildListQueryString(searchParams?: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (
      typeof value === "string" &&
      value.length > 0 &&
      key !== "serviceId" &&
      key !== "mobileDetail" &&
      key !== "mode"
    ) {
      params.set(key, value);
    }
  }

  return params.toString();
}

function buildReturnTo(currentPath: string, queryString: string) {
  return queryString ? `${currentPath}?${queryString}` : currentPath;
}

export async function AdminServicesPage({
  area,
  searchParams,
}: {
  area: AdminArea;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const data = await getAdminServicesPageData(area, searchParams);
  const queryString = buildListQueryString(searchParams);
  const returnTo = buildReturnTo(data.currentPath, queryString);
  const createHref = `${returnTo}${queryString ? "&" : "?"}mode=create${data.filters.mobileDetail === "1" ? "&mobileDetail=1" : ""}`;
  const mobileBackHref = returnTo;
  const showMobileDetail = data.filters.mobileDetail === "1" || data.filters.mode === "create";
  const selectedServiceVisible =
    Boolean(data.selectedService) && data.services.some((service) => service.id === data.selectedService?.id);
  const showDetailDrawer = data.filters.mode === "create" || Boolean(data.filters.serviceId);
  const drawerTitle =
    data.filters.mode === "create"
      ? "Nová služba"
      : data.selectedService
        ? `Editace: ${data.selectedService.name}`
        : "Editace služby";
  const drawerDescription =
    data.filters.mode === "create"
      ? "Nová služba se po vytvoření rovnou otevře v detailu a zůstane v kontextu aktuálního seznamu."
      : data.selectedService
        ? `Kategorie ${data.selectedService.category.name} • ${data.selectedService.durationMinutes} min • ${formatServicePrice(data.selectedService.priceFromCzk)}`
        : "Vyberte službu ze seznamu vlevo.";

  const detailContent =
    data.filters.mode === "create" ? (
      <AdminServiceForm
        key="service-form-create"
        mode="create"
        area={area}
        returnTo={returnTo}
        categories={data.categories}
        initialValues={{
          name: "",
          description: "",
          publicIntro: "",
          seoDescription: "",
          pricingShortDescription: "",
          pricingBadge: "",
          durationMinutes: 60,
          priceFromCzk: "",
          categoryId: data.draftCategoryId,
          isActive: true,
          isPubliclyBookable: true,
        }}
      />
    ) : data.selectedService ? (
      <AdminServiceForm
        key={`service-form-edit-${data.selectedService.id}`}
        mode="edit"
        area={area}
        returnTo={returnTo}
        service={{
          id: data.selectedService.id,
          name: data.selectedService.name,
          description: data.selectedService.description,
          publicIntro: data.selectedService.publicIntro,
          seoDescription: data.selectedService.seoDescription,
          pricingShortDescription: data.selectedService.pricingShortDescription,
          pricingBadge: data.selectedService.pricingBadge,
          durationMinutes: data.selectedService.durationMinutes,
          priceFromCzk: data.selectedService.priceFromCzk,
          sortOrder: data.selectedService.sortOrder,
          isActive: data.selectedService.isActive,
          isPubliclyBookable: data.selectedService.isPubliclyBookable,
          categoryId: data.selectedService.categoryId,
          category: data.selectedService.category,
          _count: data.selectedService._count,
          warnings: data.services.find((service) => service.id === data.selectedService?.id)?.warnings ?? [],
        }}
        categories={data.categories}
      />
    ) : (
      <div className="rounded-[1.5rem] border border-dashed border-white/14 bg-white/4 p-5">
        <p className="text-base font-medium text-white">Ve filtru není žádná služba k úpravě.</p>
        <p className="mt-2 text-sm leading-6 text-white/62">
          Zkuste změnit filtr nebo otevřít celý seznam služeb.
        </p>
      </div>
    );

  return (
    <AdminPageShell
      eyebrow={area === "owner" ? "Katalog služeb" : "Provozní nabídka"}
      title="Služby"
      description={
        area === "owner"
          ? "Rychlá správa nabídky pro web, ceník i interní provoz bez zbytečného přepínání mezi stránkami."
          : "Klidný provozní přehled, kde jde většina změn udělat rovnou ze seznamu."
      }
      stats={data.stats}
      compactStats
      compact={area === "salon"}
    >
      <div className="xl:hidden">
        {showMobileDetail ? (
          <AdminPanel
            title={data.filters.mode === "create" ? "Nová služba" : data.selectedService ? `Editace: ${data.selectedService.name}` : "Detail služby"}
            description={
              data.filters.mode === "create"
                ? "Na mobilu je detail otevřený samostatně, aby se admin zbytečně neroztahoval do dlouhého scrollu."
                : data.selectedService
                  ? `Kategorie ${data.selectedService.category.name} • ${data.selectedService.durationMinutes} min • ${formatServicePrice(data.selectedService.priceFromCzk)}`
                  : "Vyberte službu ze seznamu."
            }
            compact={area === "salon"}
          >
            <a
              href={mobileBackHref}
              className="mb-4 inline-flex rounded-full border border-white/10 px-4 py-2 text-sm text-white/80 transition hover:border-white/18 hover:bg-white/6"
            >
              Zpět na seznam
            </a>
            {detailContent}
          </AdminPanel>
        ) : (
          <AdminPanel
            title="Přehled služeb"
            description="Najděte službu, proveďte rychlé akce a detail otevírejte jen tehdy, když je to opravdu potřeba."
            compact={area === "salon"}
            denseHeader
          >
            <AdminServicesToolbar
              currentPath={data.currentPath}
              createHref={createHref}
              filters={data.filters}
              categories={data.categories}
              selectedServiceName={data.selectedService?.name}
            />

            {data.selectedService && !selectedServiceVisible ? (
              <div className="mt-5 rounded-[1.25rem] border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-50">
                Vybraná služba není v aktuálním filtru. Detail lze stále otevřít přes akce v řádku.
              </div>
            ) : null}

            <div className="mt-4">
              <AdminServicesList
                area={area}
                currentPath={data.currentPath}
                currentServiceId={data.selectedService?.id}
                queryString={queryString}
                returnTo={returnTo}
                services={data.services}
              />
            </div>
          </AdminPanel>
        )}
      </div>

      <div className="hidden xl:block">
        <AdminPanel
          title="Přehled služeb"
          description="Seznam je primárně provozní: filtrace, stavové kontexty a akce jsou hned po ruce."
          compact={area === "salon"}
          denseHeader
        >
          <AdminServicesToolbar
            currentPath={data.currentPath}
            createHref={createHref}
            filters={data.filters}
            categories={data.categories}
            selectedServiceName={data.selectedService?.name}
          />

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[1rem] border border-white/8 bg-white/[0.035] px-4 py-3 text-sm text-white/64">
            <p><span className="text-white">Aktivní:</span> provozně zapnutá služba</p>
            <p><span className="text-white">Neaktivní:</span> zůstává jen v evidenci</p>
            <p><span className="text-white">Veřejná:</span> může ji vybrat klientka</p>
            <p><span className="text-white">Interní:</span> jen pro interní práci</p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[1rem] border border-white/8 bg-white/[0.035] px-4 py-3 text-sm text-white/64">
            <p><span className="text-white">V seznamu:</span> {data.services.length}</p>
            <p><span className="text-white">Skupin:</span> {new Set(data.services.map((service) => service.category.id)).size}</p>
            <p><span className="text-white">Viditelné:</span> {data.services.filter((service) => service.isEffectivelyVisible).length}</p>
            <p><span className="text-white">Upozornění:</span> {data.services.filter((service) => service.warnings.length > 0).length}</p>
          </div>

          {data.selectedService && !selectedServiceVisible ? (
            <div className="mt-5 rounded-[1.25rem] border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-50">
              Vybraná služba není v aktuálním filtru. Detail vpravo zůstává otevřený, abyste o rozpracovanou editaci nepřišli.
            </div>
          ) : null}

          <div className="mt-4">
            <AdminServicesList
              area={area}
              currentPath={data.currentPath}
              currentServiceId={data.selectedService?.id}
              queryString={queryString}
              returnTo={returnTo}
              services={data.services}
            />
          </div>
        </AdminPanel>
      </div>

      {showDetailDrawer ? (
        <div className="fixed inset-0 z-50 hidden xl:block">
          <Link
            aria-label="Zavřít detail služby"
            href={returnTo}
            className="absolute inset-0 bg-black/62 backdrop-blur-sm"
          />
          <aside className="absolute inset-y-0 right-0 w-full max-w-4xl overflow-hidden border-l border-white/10 bg-[#131116] shadow-[-20px_0_70px_rgba(0,0,0,0.45)]">
            <div className="flex h-full flex-col">
              <header className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-6">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--color-accent-soft)]">
                    Detail služby
                  </p>
                  <h2 className="mt-2 text-2xl font-display text-white">{drawerTitle}</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-white/66">{drawerDescription}</p>
                </div>

                <Link
                  href={returnTo}
                  className="rounded-full border border-white/10 px-3 py-2 text-sm text-white/74 transition hover:border-white/18 hover:bg-white/6"
                >
                  Zavřít
                </Link>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                {detailContent}
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </AdminPageShell>
  );
}
