'use client';

import { useState } from 'react';
import Image from "next/image";
import Link from "next/link";

import type { AdminArea } from "@/config/navigation";

export type ServiceMediaOverviewItem = {
  id: string;
  name: string;
  slug: string;
  category: string;
  isActive: boolean;
  isPubliclyBookable: boolean;
  hero: { url: string; alt: string } | null;
  galleryCount: number;
  publishedCount: number;
  totalCount: number;
};

export function ServiceMediaOverview({ area, items }: { area: AdminArea; items: ServiceMediaOverviewItem[] }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const visibleItems = items.filter((item) => `${item.name} ${item.category}`.toLocaleLowerCase('cs-CZ').includes(search.trim().toLocaleLowerCase('cs-CZ')) && (filter === 'all' || filter === 'missing' && !item.hero || filter === 'empty' && !item.publishedCount || filter === 'active' && item.isActive));
  const servicePath = area === "owner" ? "/admin/sluzby" : "/admin/provoz/sluzby";

  return <section aria-labelledby="service-media-overview-title" className="space-y-4">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div><h2 id="service-media-overview-title" className="text-lg font-semibold text-white">Fotografické pokrytí služeb</h2><p className="mt-1 text-sm leading-6 text-white/58">Rychlý přehled hlavních fotografií, galerií a médií dostupných na veřejném webu.</p></div>
      <Link href={servicePath} className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/12 px-4 py-2 text-sm text-white hover:bg-white/5">Správa služeb</Link>
    </div>
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-white/10 p-3">
      <label className="min-w-0 flex-1 text-xs text-white/60">Hledat službu nebo kategorii<input value={search} onChange={(event) => setSearch(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-black/20 px-3 text-sm text-white"/></label>
      <label className="text-xs text-white/60">Zobrazit<select value={filter} onChange={(event) => setFilter(event.target.value)} className="mt-1 block min-h-11 rounded-lg border border-white/15 bg-[#211e24] px-3 text-sm text-white"><option value="all">Všechny služby</option><option value="missing">Bez hlavní fotografie</option><option value="empty">Bez publikovaných médií</option><option value="active">Aktivní služby</option></select></label>
      {search || filter !== 'all' ? <button type="button" onClick={() => { setSearch(''); setFilter('all'); }} className="min-h-11 text-sm text-[var(--color-accent-soft)]">Zrušit filtry</button> : null}
      <p aria-live="polite" className="py-3 text-sm text-white/50">{visibleItems.length} z {items.length} služeb</p>
    </div>
    <div className="grid gap-3 lg:grid-cols-2">
      {visibleItems.map((item) => {
        const missingHero = !item.hero;
        const available = item.publishedCount > 0;
        return <article key={item.id} className="grid gap-4 rounded-[1.15rem] border border-white/10 bg-white/[.035] p-3 sm:grid-cols-[8rem_1fr] sm:p-4">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[.9rem] bg-black/20">
            {item.hero ? <Image src={item.hero.url} alt={item.hero.alt} fill sizes="128px" className="object-cover"/> : <div className="flex h-full items-center justify-center px-3 text-center text-xs text-white/40">Bez hlavní fotografie</div>}
          </div>
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[.16em] text-[var(--color-accent-soft)]">{item.category}</p><h3 className="mt-1 truncate text-base font-semibold text-white">{item.name}</h3></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${available ? "bg-emerald-950/70 text-emerald-100" : "bg-amber-300/10 text-amber-50"}`}>{available ? "Má média" : "Bez médií"}</span></div>
            <p className="mt-1 text-xs text-white/45">{item.isActive ? 'Aktivní' : 'Neaktivní'} · {item.isPubliclyBookable ? 'Veřejně rezervovatelná' : 'Bez veřejné rezervace'}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-white/60"><span><strong className="block text-base text-white">{item.hero ? 1 : 0}</strong>hlavní</span><span><strong className="block text-base text-white">{item.galleryCount}</strong>galerie</span><span><strong className="block text-base text-white">{item.publishedCount}/{item.totalCount}</strong>publikováno</span></div>
            {missingHero ? <p className="mt-3 rounded-lg border border-amber-200/15 bg-amber-300/10 px-3 py-2 text-xs text-amber-50">Chybí hlavní fotografie služby.</p> : null}
            <div className="mt-3 flex flex-wrap gap-2"><Link href={`${servicePath}?serviceId=${encodeURIComponent(item.id)}&view=photos`} className="inline-flex min-h-10 items-center rounded-full bg-[var(--color-accent)] px-3.5 py-2 text-xs font-semibold text-[var(--color-accent-contrast)]">Spravovat fotografie</Link><Link href={`/sluzby/${encodeURIComponent(item.slug)}`} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center rounded-full border border-white/12 px-3.5 py-2 text-xs text-white/75">Veřejný detail</Link></div>
          </div>
        </article>;
      })}
    </div>
    {!visibleItems.length ? <p className="rounded-[1.1rem] border border-dashed border-white/14 p-5 text-sm text-white/58">{items.length ? 'Žádná služba neodpovídá filtrům.' : 'Zatím nejsou evidované žádné služby.'}</p> : null}
  </section>;
}
