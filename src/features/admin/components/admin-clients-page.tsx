import { type AdminArea } from "@/config/navigation";
import Link from "next/link";
import { AdminClientsList } from "@/features/admin/components/admin-clients-list";
import { AdminClientsToolbar } from "@/features/admin/components/admin-clients-toolbar";
import { AdminPageShell, AdminPanel } from "@/features/admin/components/admin-page-shell";
import { getAdminClientsPageData } from "@/features/admin/lib/admin-clients";

export async function AdminClientsPage({ area, searchParams }: { area: AdminArea; searchParams?: Record<string, string | string[] | undefined> }) {
  const data = await getAdminClientsPageData(area, searchParams);
  return <AdminPageShell eyebrow="Klientská databáze" title="Klienti" description="Rychlý seznam kontaktů, rezervací a poznámek." mobileDescription={`${data.views.find((view) => view.value === "all")?.count ?? 0} klientek v databázi`} mobileCompactIntro denseIntro><div className="grid min-w-0 max-w-full gap-3 overflow-x-clip sm:gap-4">
    <OutreachPanel outreach={data.outreach} isOutreach={data.filters.view === "outreach"} />
    <AdminPanel title="Seznam klientů" description={data.filters.view === "outreach" ? `Retenční stav k ${new Intl.DateTimeFormat("cs-CZ", { dateStyle: "medium", timeZone: "Europe/Prague" }).format(data.retentionReference)}.` : undefined} denseHeader compact={area === "salon"} className="min-w-0 max-w-full overflow-x-clip">
      <ViewNavigation views={data.views} />
      <div className="mt-3"><AdminClientsToolbar currentPath={data.currentPath} filters={data.filters} /></div>
      <div className="mt-4 grid gap-2 text-sm text-white/62 sm:grid-cols-2"><p><span className="text-white">V seznamu:</span> {data.pagination.firstItemNumber}–{data.pagination.lastItemNumber} z {data.pagination.totalCount} klientek</p><p><span className="text-white">Pohled:</span> {data.views.find((view) => view.isActive)?.label}</p></div>
      <div className="mt-4"><AdminClientsList clients={data.clients} resetHref={data.currentPath} emptyState={data.emptyState} /></div>
      {data.pagination.totalCount > 0 ? <ClientsPagination currentPath={data.currentPath} filters={data.filters} pagination={data.pagination} /> : null}
    </AdminPanel>
  </div></AdminPageShell>;
}

function ViewNavigation({ views }: { views: Array<{ value: string; label: string; count: number; href: string; isActive: boolean }> }) {
  return <div className="relative min-w-0 after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-8 after:bg-gradient-to-l after:from-[#111015] sm:after:hidden"><nav aria-label="CRM pohledy" className="flex snap-x snap-mandatory flex-nowrap gap-2 overflow-x-auto pb-1 pr-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{views.map((view) => <Link key={view.value} href={view.href} className={["inline-flex shrink-0 snap-start items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition", view.isActive ? "border-[var(--color-accent)]/60 bg-[rgba(190,160,120,0.16)] text-white" : "border-white/10 bg-white/4 text-white/64 hover:border-white/18 hover:bg-white/7 hover:text-white/82"].join(" ")}>{view.label} <span className="text-white/48">{view.count}</span></Link>)}</nav></div>;
}

function OutreachPanel({ outreach, isOutreach }: { outreach: { totalCount: number; bands: Array<{ value: string; label: string; count: number; href: string }> }; isOutreach: boolean }) {
  const outreachHref = outreach.bands[0]?.href.replace(/([?&])retention=8_11&?/, "$1").replace(/[?&]$/, "") ?? "#";
  return <section className="rounded-[1.1rem] border border-white/8 bg-white/4 px-4 py-3 text-sm text-white/70"><Link href={outreachHref} className="flex items-center justify-between gap-3 sm:hidden"><span><span className="font-medium text-white">K oslovení:</span> {outreach.totalCount} klientek</span><span aria-hidden="true" className="text-white/48">→</span></Link><div className="hidden sm:block"><div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-medium text-white">K oslovení <span className="text-white/52">{outreach.totalCount}</span></h2>{outreach.totalCount === 0 ? <p>Žádná klientka nyní není k oslovení.</p> : null}</div><div className="mt-2 flex flex-wrap gap-2">{outreach.bands.map((band) => <Link key={band.value} href={band.href} className="rounded-full border border-white/10 px-3 py-1.5 text-white/76 transition hover:border-white/20 hover:bg-white/6">{band.label}: <span className="text-white">{band.count}</span></Link>)}</div></div>{isOutreach ? <div className="mt-1 grid grid-cols-3 gap-2 sm:hidden">{outreach.bands.map((band) => <Link key={band.value} href={band.href} className="min-w-0 rounded-lg border border-white/10 px-2 py-2 text-center text-xs text-white/70"><span className="block truncate">{band.label}</span><span className="mt-0.5 block text-base text-white">{band.count}</span></Link>)}</div> : null}</section>;
}

function buildPageHref(currentPath: string, filters: { query: string; view: string; sort: string; quick: string; retention?: string; retentionAt?: string }, page: number) {
  const params = new URLSearchParams();
  if (filters.query) params.set("query", filters.query);
  if (filters.view !== "all") params.set("view", filters.view);
  if (["all", "no_contact", "inactive"].includes(filters.view) && filters.sort !== "recent") params.set("sort", filters.sort);
  if (["all", "no_contact", "inactive"].includes(filters.view) && filters.quick !== "all") params.set("quick", filters.quick);
  if (filters.view === "outreach" && filters.retention) params.set("retention", filters.retention);
  if (filters.view === "outreach" && filters.retentionAt) params.set("retentionAt", filters.retentionAt);
  if (page > 1) params.set("page", String(page));
  const query = params.toString(); return query ? `${currentPath}?${query}` : currentPath;
}

function ClientsPagination({ currentPath, filters, pagination }: { currentPath: string; filters: { query: string; view: string; sort: string; quick: string; retention?: string; retentionAt?: string }; pagination: { page: number; totalPages: number; hasPreviousPage: boolean; hasNextPage: boolean } }) {
  return <nav aria-label="Stránkování klientek" className="mt-4 grid min-w-0 grid-cols-3 items-center gap-2 text-center text-xs text-white/72 sm:flex sm:flex-wrap sm:justify-center sm:gap-3 sm:text-sm">{pagination.hasPreviousPage ? <Link href={buildPageHref(currentPath, filters, pagination.page - 1)} className="inline-flex min-h-10 min-w-0 items-center justify-center rounded-full border border-white/10 px-2 transition hover:border-white/18 hover:bg-white/6 sm:px-4">Předchozí</Link> : <span className="inline-flex min-h-10 min-w-0 items-center justify-center rounded-full border border-white/6 px-2 text-white/30 sm:px-4">Předchozí</span>}<span className="min-w-0 whitespace-nowrap">Stránka {pagination.page} z {pagination.totalPages}</span>{pagination.hasNextPage ? <Link href={buildPageHref(currentPath, filters, pagination.page + 1)} className="inline-flex min-h-10 min-w-0 items-center justify-center rounded-full border border-white/10 px-2 transition hover:border-white/18 hover:bg-white/6 sm:px-4">Další</Link> : <span className="inline-flex min-h-10 min-w-0 items-center justify-center rounded-full border border-white/6 px-2 text-white/30 sm:px-4">Další</span>}</nav>;
}
