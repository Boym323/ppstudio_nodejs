import Form from "next/form";
import Link from "next/link";

import { bookingListSourceValues, bookingListStatusValues, type BookingListViewValue } from "@/features/admin/lib/admin-booking-list-validation";
import { cn } from "@/lib/utils";
import { AdminBookingSearchField } from "./admin-booking-search-field";

type Props = { currentPath: string; filters: { view: BookingListViewValue; query: string; status: (typeof bookingListStatusValues)[number]; source: (typeof bookingListSourceValues)[number]; dateFrom: string; dateTo: string; hasActiveFilters: boolean }; resultCount: number; views: Array<{ key: BookingListViewValue; label: string; count: number; href: string; isActive: boolean }> };

export function AdminBookingsToolbar({ currentPath, filters, resultCount, views }: Props) {
  const filterHref = (key: "query" | "status" | "source" | "dateFrom" | "dateTo") => {
    const params = new URLSearchParams(); params.set("view", filters.view);
    for (const [name, value] of Object.entries(filters)) if (["query", "status", "source", "dateFrom", "dateTo"].includes(name) && name !== key && value && value !== "all") params.set(name, String(value));
    return `${currentPath}?${params}`;
  };
  return <div className="min-w-0 rounded-[1.2rem] border border-white/10 bg-[#151219]/95 px-2.5 py-2.5 backdrop-blur xl:px-3 xl:py-3">
    <nav aria-label="Pohledy rezervací" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-3 [scrollbar-width:thin] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      {views.map((view) => <Link key={view.key} href={view.href} scroll={false} className={cn("inline-flex min-h-10 shrink-0 items-center rounded-full border px-2.5 py-1.5 text-xs transition xl:px-3 xl:text-sm", view.isActive ? "border-[var(--color-accent)]/52 bg-[rgba(190,160,120,0.18)] text-white" : "border-white/10 bg-black/12 text-white/78 hover:bg-white/6")}><span className="font-medium">{view.label}</span>{view.key === "attention" ? <span className="ml-2 text-white/58">{view.count}</span> : null}</Link>)}
    </nav>
    <Form action={currentPath} scroll={false} className="space-y-2.5 xl:space-y-3" autoComplete="off">
      <input type="hidden" name="view" value={filters.view} />
      <div className="grid min-w-0 gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-[1_1_18rem]"><AdminBookingSearchField defaultValue={filters.query} placeholder="Klientka, telefon nebo služba" /></div>
          <p className="flex h-11 shrink-0 items-center gap-2 text-sm text-white/60">Výsledky <span className="rounded-lg bg-white/[0.06] px-2.5 py-1 font-semibold tabular-nums text-white">{resultCount}</span></p>
        </div>
        <details className="group min-w-0 rounded-xl border border-white/10 bg-black/10" open={filters.status !== "all" || filters.source !== "all" || Boolean(filters.dateFrom || filters.dateTo)}>
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] [&::-webkit-details-marker]:hidden">
            <span>Filtry rezervací</span>
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="size-4 shrink-0 text-white/55 transition-transform group-open:rotate-180"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </summary>
          <div className="space-y-4 border-t border-white/8 p-3.5">
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Select name="status" label="Stav" value={filters.status}><option value="all">Vše</option><option value="pending">Čeká</option><option value="confirmed">Potvrzené</option><option value="completed">Hotovo</option><option value="cancelled">Zrušené</option><option value="no_show">Nedorazila</option></Select>
              <Select name="source" label="Zdroj" value={filters.source}><option value="all">Vše</option><option value="web">Web</option><option value="phone">Telefon</option><option value="instagram">Instagram zpráva</option><option value="in_person">Osobně</option><option value="other">Ostatní</option></Select>
              <Date name="dateFrom" label="Datum od" value={filters.dateFrom}/>
              <Date name="dateTo" label="Datum do" value={filters.dateTo}/>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-white/8 pt-3">
              <button type="submit" className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-[var(--color-accent)]/45 bg-[var(--color-accent)]/15 px-5 text-sm font-semibold text-[var(--color-accent-soft)] transition hover:bg-[var(--color-accent)]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] sm:flex-none">Použít filtry</button>
              <Link href={`${currentPath}?view=${filters.view}`} scroll={false} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl px-4 text-sm text-white/65 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] sm:flex-none">Vymazat filtry</Link>
            </div>
          </div>
        </details>
      </div>
      {filters.hasActiveFilters ? <div className="flex flex-wrap gap-2 text-xs">{filters.query ? <Tag href={filterHref("query")} label={`Hledání: ${filters.query}`}/> : null}{filters.status !== "all" ? <Tag href={filterHref("status")} label={`Stav: ${filters.status}`}/> : null}{filters.source !== "all" ? <Tag href={filterHref("source")} label={`Zdroj: ${filters.source}`}/> : null}{filters.dateFrom ? <Tag href={filterHref("dateFrom")} label={`Od: ${filters.dateFrom}`}/> : null}{filters.dateTo ? <Tag href={filterHref("dateTo")} label={`Do: ${filters.dateTo}`}/> : null}</div> : null}
    </Form></div>;
}
function Tag({href,label}:{href:string;label:string}) { return <Link href={href} scroll={false} className="rounded-full border border-white/10 px-2.5 py-1 text-white/72">{label} ×</Link>; }
const filterControlClass = "block h-11 min-h-11 w-full min-w-0 rounded-xl border border-white/15 bg-[#100e13] px-3 text-base text-white/90 outline-none transition hover:border-white/25 focus:border-[var(--color-accent)]/65 focus:ring-2 focus:ring-[var(--color-accent)]/15 sm:text-sm [color-scheme:dark]";

function Select({name,label,value,children}:{name:string;label:string;value:string;children:React.ReactNode}) {
  return <label className="block min-w-0 text-xs font-medium text-white/65">{label}<span className="relative mt-1.5 block"><select name={name} defaultValue={value} className={`${filterControlClass} appearance-none pr-10`}>{children}</select><svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-white/55"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span></label>;
}
function Date({name,label,value}:{name:string;label:string;value:string}) {
  return <label className="block min-w-0 text-xs font-medium text-white/65">{label}<input type="date" name={name} defaultValue={value} className={`${filterControlClass} mt-1.5 [&::-webkit-date-and-time-value]:text-left`}/></label>;
}
