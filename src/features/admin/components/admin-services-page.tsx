import * as Dialog from "@/components/ui/dialog";
import { AdminPageShell, AdminPanel } from "@/features/admin/components/admin-page-shell";
import {
  AdminRouteBackLink,
  AdminRouteDrawer,
} from "@/features/admin/components/admin-route-drawer";
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
          publicName: "",
          description: "",
          publicIntro: "",
          seoTitle: "",
          seoDescription: "",
          idealFor: [],
          includes: [],
          benefits: [],
          goodToKnow: [],
          pricingShortDescription: "",
          pricingBadge: "",
          durationMinutes: 60,
          cleanupMinutes: 0,
          priceFromCzk: "",
          categoryId: data.draftCategoryId,
          isFeaturedOnHomepage: false,
          homepageSortOrder: 10,
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
          publicName: data.selectedService.publicName,
          description: data.selectedService.description,
          publicIntro: data.selectedService.publicIntro,
          seoTitle: data.selectedService.seoTitle,
          seoDescription: data.selectedService.seoDescription,
          idealFor: data.selectedService.idealFor,
          includes: data.selectedService.includes,
          benefits: data.selectedService.benefits,
          goodToKnow: data.selectedService.goodToKnow,
          pricingShortDescription: data.selectedService.pricingShortDescription,
          pricingBadge: data.selectedService.pricingBadge,
          durationMinutes: data.selectedService.durationMinutes,
          cleanupMinutes: data.selectedService.cleanupMinutes,
          priceFromCzk: data.selectedService.priceFromCzk,
          sortOrder: data.selectedService.sortOrder,
          isFeaturedOnHomepage: data.selectedService.isFeaturedOnHomepage,
          homepageSortOrder: data.selectedService.homepageSortOrder,
          isActive: data.selectedService.isActive,
          isPubliclyBookable: data.selectedService.isPubliclyBookable,
          slug: data.selectedService.slug,
          categoryId: data.selectedService.categoryId,
          category: data.selectedService.category,
          _count: data.selectedService._count,
          warnings: data.services.find((service) => service.id === data.selectedService?.id)?.warnings ?? [],
          priceChangeLogs: data.selectedService.priceChangeLogs,
          changeLogs: data.selectedService.changeLogs,
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
      description="Rychlá správa nabídky pro web, ceník i interní provoz."
      denseIntro
      headerActions={
        <a
          href={createHref}
          className="inline-flex rounded-full bg-[var(--color-accent)] px-3.5 py-2 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105"
        >
          Nová služba
        </a>
      }
      stats={data.stats}
      compactStats
      slimStats
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
            <AdminRouteBackLink
              href={mobileBackHref}
              className="mb-4 inline-flex rounded-full border border-white/10 px-4 py-2 text-sm text-white/80 transition hover:border-white/18 hover:bg-white/6"
            >
              Zpět na seznam
            </AdminRouteBackLink>
            {detailContent}
          </AdminPanel>
        ) : (
          <AdminPanel
            title="Přehled služeb"
            compact={area === "salon"}
            denseHeader
            tighter
          >
            <AdminServicesToolbar
              currentPath={data.currentPath}
              filters={data.filters}
              categories={data.categories}
              selectedServiceName={data.selectedService?.name}
            />

            <div className="mt-3 rounded-[1rem] border border-white/8 bg-white/[0.035] px-4 py-2.5 text-sm text-white/70">
              <p>
                V seznamu: {data.summary.listed} · Skupin: {data.summary.categories} · Viditelné: {data.summary.visible} · Upozornění: {data.summary.warnings}
              </p>
              <p className="mt-1 text-xs text-white/50">{data.catalogScopeNotice}</p>
            </div>

            {data.selectedService && !selectedServiceVisible ? (
              <div className="mt-5 rounded-[1.25rem] border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-50">
                Vybraná služba není v aktuálním filtru. Detail lze stále otevřít přes akce v řádku.
              </div>
            ) : null}

            <div className="mt-3">
              <AdminServicesList
                area={area}
                currentPath={data.currentPath}
                createHref={createHref}
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
            compact={area === "salon"}
            denseHeader
            tighter
          >
          <AdminServicesToolbar
            currentPath={data.currentPath}
            filters={data.filters}
            categories={data.categories}
            selectedServiceName={data.selectedService?.name}
          />

          <div className="mt-3 rounded-[1rem] border border-white/8 bg-white/[0.035] px-4 py-2.5 text-sm text-white/70">
            <p>
              V seznamu: {data.summary.listed} · Skupin: {data.summary.categories} · Viditelné: {data.summary.visible} · Upozornění: {data.summary.warnings}
            </p>
            <p className="mt-1 text-xs text-white/50">{data.catalogScopeNotice}</p>
          </div>

          {data.selectedService && !selectedServiceVisible ? (
            <div className="mt-5 rounded-[1.25rem] border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-50">
              Vybraná služba není v aktuálním filtru. Detail vpravo zůstává otevřený, abyste o rozpracovanou editaci nepřišli.
            </div>
          ) : null}

          <div className="mt-3">
            <AdminServicesList
              area={area}
              currentPath={data.currentPath}
              createHref={createHref}
              currentServiceId={data.selectedService?.id}
              queryString={queryString}
              returnTo={returnTo}
              services={data.services}
            />
          </div>
        </AdminPanel>
      </div>

      {showDetailDrawer ? (
        <AdminRouteDrawer href={returnTo} desktopOnly>
          <Dialog.Portal>
            <Dialog.Overlay />
            <Dialog.Content className="!inset-y-0 !right-0 !left-auto z-[90] !h-[100dvh] !max-h-none !w-full !max-w-4xl !translate-x-0 !translate-y-0 !overflow-hidden border-l border-white/10 bg-[#131116] shadow-[-20px_0_70px_rgba(0,0,0,0.45)]">
              <div className="flex h-full flex-col">
                <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-[#131116]/96 px-5 pb-5 pt-[calc(1.25rem+env(safe-area-inset-top))] backdrop-blur sm:px-6 sm:py-5">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--color-accent-soft)]">
                      Detail služby
                    </p>
                    <Dialog.Title>{drawerTitle}</Dialog.Title>
                    <Dialog.Description className="max-w-2xl">{drawerDescription}</Dialog.Description>
                  </div>

                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="min-h-11 min-w-11 rounded-full border border-white/10 px-3 py-2 text-sm text-white/74 transition hover:border-white/18 hover:bg-white/6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
                    >
                      Zavřít
                    </button>
                  </Dialog.Close>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                  {detailContent}
                </div>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </AdminRouteDrawer>
      ) : null}
    </AdminPageShell>
  );
}
