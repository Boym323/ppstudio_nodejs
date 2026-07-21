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
  return <div className="min-w-0 rounded-[1.2rem] border border-white/10 bg-[#151219]/95 px-3 py-3 backdrop-blur">
    <nav aria-label="Pohledy rezervací" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-3 [scrollbar-width:thin] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      {views.map((view) => <Link key={view.key} href={view.href} scroll={false} className={cn("inline-flex min-h-10 shrink-0 items-center rounded-full border px-3 py-1.5 text-sm transition", view.isActive ? "border-[var(--color-accent)]/52 bg-[rgba(190,160,120,0.18)] text-white" : "border-white/10 bg-black/12 text-white/78 hover:bg-white/6")}><span className="font-medium">{view.label}</span>{view.key === "attention" ? <span className="ml-2 text-white/58">{view.count}</span> : null}</Link>)}
    </nav>
    <Form action={currentPath} scroll={false} className="space-y-3">
      <input type="hidden" name="view" value={filters.view} />
      <div className="flex flex-wrap items-end gap-2"><div className="min-w-[15rem] flex-1"><AdminBookingSearchField defaultValue={filters.query} placeholder="Klientka, telefon, e-mail nebo služba" /></div><details className="min-w-[8rem] rounded-[.9rem] border border-white/10 bg-black/15" open={filters.status !== "all" || filters.source !== "all" || Boolean(filters.dateFrom || filters.dateTo)}><summary className="min-h-10 cursor-pointer px-3 py-2 text-sm text-white/80">Filtry</summary><div className="grid gap-2 border-t border-white/8 p-3 sm:grid-cols-2 lg:grid-cols-4"><Select name="status" label="Stav" value={filters.status}><option value="all">Vše</option><option value="pending">Čeká</option><option value="confirmed">Potvrzené</option><option value="completed">Hotovo</option><option value="cancelled">Zrušené</option><option value="no_show">Nedorazila</option></Select><Select name="source" label="Zdroj" value={filters.source}><option value="all">Vše</option><option value="web">Web</option><option value="phone">Telefon</option><option value="instagram">Instagram zpráva</option><option value="in_person">Osobně</option><option value="other">Ostatní</option></Select><Date name="dateFrom" label="Datum od" value={filters.dateFrom}/><Date name="dateTo" label="Datum do" value={filters.dateTo}/><button type="submit" className="min-h-10 rounded-full border border-[var(--color-accent)]/45 px-4 text-sm font-semibold">Použít filtry</button><Link href={`${currentPath}?view=${filters.view}`} scroll={false} className="min-h-10 rounded-full border border-white/10 px-4 py-2 text-center text-sm text-white/74">Vymazat filtry</Link></div></details><p className="min-h-10 pt-2 text-sm text-white/58">Výsledky: <span className="font-medium text-white">{resultCount}</span></p></div>
      {filters.hasActiveFilters ? <div className="flex flex-wrap gap-2 text-xs">{filters.query ? <Tag href={filterHref("query")} label={`Hledání: ${filters.query}`}/> : null}{filters.status !== "all" ? <Tag href={filterHref("status")} label={`Stav: ${filters.status}`}/> : null}{filters.source !== "all" ? <Tag href={filterHref("source")} label={`Zdroj: ${filters.source}`}/> : null}{filters.dateFrom ? <Tag href={filterHref("dateFrom")} label={`Od: ${filters.dateFrom}`}/> : null}{filters.dateTo ? <Tag href={filterHref("dateTo")} label={`Do: ${filters.dateTo}`}/> : null}</div> : null}
    </Form></div>;
}
function Tag({href,label}:{href:string;label:string}) { return <Link href={href} scroll={false} className="rounded-full border border-white/10 px-2.5 py-1 text-white/72">{label} ×</Link>; }
function Select({name,label,value,children}:{name:string;label:string;value:string;children:React.ReactNode}) { return <label className="text-xs text-white/55">{label}<select name={name} defaultValue={value} className="mt-1 block min-h-10 w-full rounded-[.75rem] bg-black/25 px-2 text-sm text-white">{children}</select></label>; }
function Date({name,label,value}:{name:string;label:string;value:string}) { return <label className="text-xs text-white/55">{label}<input type="date" name={name} defaultValue={value} className="mt-1 block min-h-10 w-full rounded-[.75rem] bg-black/25 px-2 text-sm text-white"/></label>; }
