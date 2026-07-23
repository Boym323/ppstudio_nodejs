"use client";

import { useEffect, useRef, useState } from "react";

import { type ClientListViewValue } from "@/features/admin/lib/admin-client-validation";

type AdminClientsToolbarProps = { currentPath: string; filters: { query: string; view: ClientListViewValue; sort: string; quick: string; retention?: string; retentionAt?: string } };

export function AdminClientsToolbar({ currentPath, filters }: AdminClientsToolbarProps) {
  const fixedView = ["upcoming", "outreach", "new"].includes(filters.view);
  const [query, setQuery] = useState(filters.query);
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = () => { setIsOpen(false); requestAnimationFrame(() => triggerRef.current?.focus()); };
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  return <>
    <form action={currentPath} className="hidden gap-2 rounded-[1.1rem] border border-white/8 bg-white/5 p-3 lg:grid lg:grid-cols-[minmax(220px,1fr)_180px_180px_auto_auto] lg:items-end">
      <HiddenFilters filters={filters} includeQuery={false} />
      <SearchField defaultValue={filters.query} />
      {!fixedView ? <ExtraFilters filters={filters} /> : null}
      <button type="submit" className="h-10 rounded-full bg-[var(--color-accent)] px-4 text-sm font-semibold text-[var(--color-accent-contrast)]">Filtrovat</button>
      <ClearFilters currentPath={currentPath} filters={filters} fixedView={fixedView} />
    </form>
    <form action={currentPath} className="flex w-full min-w-0 gap-2 lg:hidden">
      <HiddenFilters filters={filters} includeQuery={false} />
      <label className="min-w-0 flex-1 basis-0"><span className="sr-only">Hledat</span><input type="search" name="query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Hledat klientku…" className="h-11 min-w-0 w-full rounded-[0.85rem] border border-white/10 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[var(--color-accent)]/60" /></label>
      <button ref={triggerRef} type="button" aria-haspopup="dialog" aria-expanded={isOpen} aria-controls="admin-client-filters" onClick={() => setIsOpen(true)} className="inline-flex min-h-11 flex-none items-center rounded-full border border-white/12 px-4 text-sm font-medium text-white/84">Filtry{filters.quick !== "all" || filters.sort !== "recent" ? <span className="ml-1.5 rounded-full bg-white/12 px-1.5 py-0.5 text-[11px]">1</span> : null}</button>
    </form>
    {isOpen ? <MobileFiltersSheet currentPath={currentPath} filters={filters} query={query} fixedView={fixedView} onClose={close} /> : null}
  </>;
}

function HiddenFilters({ filters, includeQuery }: { filters: AdminClientsToolbarProps["filters"]; includeQuery: boolean }) {
  return <>{includeQuery ? <input type="hidden" name="query" value={filters.query} /> : null}<input type="hidden" name="view" value={filters.view} />{filters.view === "outreach" && filters.retention ? <input type="hidden" name="retention" value={filters.retention} /> : null}{filters.view === "outreach" && filters.retentionAt ? <input type="hidden" name="retentionAt" value={filters.retentionAt} /> : null}</>;
}
function SearchField({ defaultValue }: { defaultValue: string }) { return <label className="block"><span className="text-[11px] uppercase tracking-[0.18em] text-white/48">Hledat</span><input type="search" name="query" defaultValue={defaultValue} placeholder="Jméno, kontakt nebo poznámka" className="mt-1.5 h-10 w-full rounded-[0.85rem] border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[var(--color-accent)]/60" /></label>; }
function ExtraFilters({ filters }: { filters: AdminClientsToolbarProps["filters"] }) { return <><SelectField name="quick" label="Další filtr" defaultValue={filters.quick}><option value="all">Vše</option><option value="with_booking">S rezervací</option><option value="without_booking">Bez rezervace</option><option value="noted">S poznámkou</option></SelectField><SelectField name="sort" label="Řazení" defaultValue={filters.sort}><option value="recent">Poslední návštěva</option><option value="bookings">Počet rezervací</option><option value="name">Jméno</option><option value="created">Nově přidané</option></SelectField></>; }
function ClearFilters({ currentPath, filters, fixedView }: { currentPath: string; filters: AdminClientsToolbarProps["filters"]; fixedView: boolean }) { const hasFilters = filters.query || filters.quick !== "all" || (!fixedView && filters.sort !== "recent") || Boolean(filters.retention); return <div className="min-h-10">{hasFilters ? <a href={currentPath} className="inline-flex h-10 items-center rounded-full border border-white/10 px-4 text-sm text-white/80">Zrušit filtr</a> : null}</div>; }
function SelectField({ name, label, defaultValue, children }: { name: string; label: string; defaultValue: string; children: React.ReactNode }) { return <label className="block"><span className="text-[11px] uppercase tracking-[0.18em] text-white/48">{label}</span><select name={name} defaultValue={defaultValue} className="mt-1.5 h-10 w-full rounded-[0.85rem] border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-[var(--color-accent)]/60">{children}</select></label>; }

function MobileFiltersSheet({ currentPath, filters, query, fixedView, onClose }: { currentPath: string; filters: AdminClientsToolbarProps["filters"]; query: string; fixedView: boolean; onClose: () => void }) {
  return <div id="admin-client-filters" role="dialog" aria-modal="true" aria-labelledby="admin-client-filters-title" className="fixed inset-0 z-50 lg:hidden"><button type="button" aria-label="Zavřít filtry" onClick={onClose} className="absolute inset-0 bg-black/65" /><form action={currentPath} className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-[1.6rem] border border-white/10 bg-[#111015] px-4 pt-4 shadow-[0_-16px_40px_rgba(0,0,0,0.35)]"><HiddenFilters filters={{ ...filters, query }} includeQuery /> <div className="flex items-center justify-between gap-3"><h2 id="admin-client-filters-title" className="font-display text-xl text-white">Filtry</h2><button type="button" onClick={onClose} className="min-h-11 rounded-full px-3 text-sm text-white/70">Zavřít</button></div>{filters.view === "outreach" && filters.retention ? <p className="mt-3 text-sm text-white/62">Retenční pásmo: {filters.retention}</p> : null}{!fixedView ? <div className="mt-4 grid gap-3"><ExtraFilters filters={filters} /></div> : <p className="mt-4 text-sm text-white/62">Tento CRM pohled má pevně nastavené filtrování a řazení.</p>}<div className="sticky bottom-0 mt-5 flex gap-2 border-t border-white/10 bg-[#111015]/96 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur"><a href={currentPath} className="inline-flex min-h-11 items-center rounded-full border border-white/10 px-4 text-sm text-white/80">Vymazat</a><button type="submit" className="min-h-11 flex-1 rounded-full bg-[var(--color-accent)] px-4 text-sm font-semibold text-[var(--color-accent-contrast)]">Použít filtry</button></div></form></div>;
}
