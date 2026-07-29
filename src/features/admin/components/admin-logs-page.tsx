"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";

import { releaseStuckEmailLogAction, retryEmailLogAction } from "../actions/email-log-actions";
import { type AdminLogItem, type AdminLogsData, type AdminLogView } from "../lib/admin-data";
import { AdminPageShell, AdminPanel } from "./admin-page-shell";
import { useAdminModalFocus } from "./admin-drawer-escape-close";

const views: Array<{ value: AdminLogView; label: string; ownerOnly?: boolean }> = [{ value: "attention", label: "Pozornost" }, { value: "events", label: "Události" }, { value: "emails", label: "E-maily" }, { value: "system", label: "Systém", ownerOnly: true }];
const severityLabel = { info: "Informace", success: "V pořádku", warning: "Varování", error: "Chyba" } as const;
const categoryLabel = { event: "Událost", email: "E-mail", automation: "Automatizace", system: "Systém" } as const;

const pragueDateTime = new Intl.DateTimeFormat("cs-CZ", {
  timeZone: "Europe/Prague",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatLogTime(occurredAt: string) {
  const date = new Date(occurredAt);
  return Number.isNaN(date.getTime()) ? "—" : pragueDateTime.format(date);
}

function hrefWith(data: AdminLogsData, changes: Record<string, string | undefined>) {
  const values = { view: data.view, query: data.filters.query, severity: data.filters.severity === "all" ? "" : data.filters.severity, source: data.filters.source === "all" ? "" : data.filters.source, emailType: data.filters.emailType === "all" ? "" : data.filters.emailType, dateFrom: data.filters.dateFrom, dateTo: data.filters.dateTo, ...changes };
  const params = new URLSearchParams(); Object.entries(values).forEach(([key, value]) => { if (value) params.set(key, value); }); return `?${params}`;
}

function Action({ item }: { item: AdminLogItem }) {
  if (item.primaryAction === "retry" && item.emailLogId) return <form action={retryEmailLogAction}><input type="hidden" name="emailLogId" value={item.emailLogId} /><button className="min-h-11 rounded-full border border-[var(--color-accent)]/45 px-3 text-xs font-semibold">Zkusit znovu</button></form>;
  if (item.primaryAction === "release" && item.emailLogId) return <form action={releaseStuckEmailLogAction}><input type="hidden" name="emailLogId" value={item.emailLogId} /><button className="min-h-11 rounded-full border border-amber-300/35 px-3 text-xs font-semibold">Uvolnit</button></form>;
  if (item.primaryAction === "detail" && item.emailLogId) return <Link className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-3 text-xs" href={`/admin/email-logy/${item.emailLogId}`}>Detail</Link>;
  return item.entityHref ? <Link className="inline-flex min-h-11 items-center rounded-full border border-white/15 px-3 text-xs" href={item.entityHref}>Otevřít</Link> : <span>—</span>;
}

function FilterFields({ data }: { data: AdminLogsData }) { return <><select name="severity" defaultValue={data.filters.severity} className="min-h-11 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white"><option value="all">Závažnost</option><option value="info">Informace</option><option value="success">V pořádku</option><option value="warning">Varování</option><option value="error">Chyba</option></select>{data.view === "events" ? <select name="source" defaultValue={data.filters.source} className="min-h-11 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white"><option value="all">Zdroj</option><option value="booking">Rezervace</option><option value="voucher">Voucher</option></select> : null}{data.view === "emails" ? <select name="emailType" defaultValue={data.filters.emailType} className="min-h-11 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white"><option value="all">Typ e-mailu</option><option value="BOOKING_CREATED">Přijetí rezervace</option><option value="BOOKING_CONFIRMED">Potvrzení rezervace</option><option value="BOOKING_CANCELLED">Zrušení rezervace</option><option value="BOOKING_RESCHEDULED">Přesun rezervace</option><option value="BOOKING_REMINDER">Připomínka termínu</option><option value="VOUCHER_SENT">Voucher</option><option value="GENERIC">Ostatní</option></select> : null}<input type="date" name="dateFrom" defaultValue={data.filters.dateFrom} aria-label="Od" className="min-h-11 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white [color-scheme:dark]"/><input type="date" name="dateTo" defaultValue={data.filters.dateTo} aria-label="Do" className="min-h-11 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white [color-scheme:dark]"/></>; }

function LogsFiltersDialog({ data, onClose }: { data: AdminLogsData; onClose: () => void }) {
  const sheetRef = useRef<HTMLFormElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useAdminModalFocus({ open: true, containerRef: sheetRef, initialFocusRef: closeRef, onClose });

  return <div role="dialog" aria-modal="true" aria-label="Filtry logů" className="fixed inset-0 z-50 md:hidden"><div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-black/65"/><form ref={sheetRef} method="get" className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-[1.6rem] border border-white/10 bg-[#111015] px-4 pt-4 shadow-[0_-16px_40px_rgba(0,0,0,.35)]"><input type="hidden" name="view" value={data.view}/><input type="hidden" name="query" value={data.filters.query}/><div className="flex justify-between"><h2 className="font-display text-xl text-white">Filtry</h2><button ref={closeRef} type="button" onClick={onClose} className="min-h-11 px-3 text-white/72">Zavřít</button></div><div className="mt-4 grid gap-3"><FilterFields data={data}/></div><div className="sticky bottom-0 mt-5 flex gap-2 border-t border-white/10 bg-[#111015]/96 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3"><Link href={`?view=${data.view}`} className="inline-flex min-h-11 items-center px-3 text-white/72 underline">Vymazat</Link><button className="min-h-11 flex-1 rounded-full bg-[var(--color-accent)] px-4 font-semibold text-[var(--color-accent-contrast)]">Použít filtry</button></div></form></div>;
}

function LogsToolbar({ data }: { data: AdminLogsData }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); requestAnimationFrame(() => trigger.current?.focus()); };
  return <><form method="get" className="hidden gap-2 rounded-[1.1rem] border border-white/8 bg-[#151219]/95 p-3 md:grid md:grid-cols-[minmax(0,1fr)_10rem_10rem_auto]"><input type="hidden" name="view" value={data.view}/><input name="query" defaultValue={data.filters.query} placeholder="Hledat událost, klientku nebo e-mail…" className="min-h-11 rounded-[.8rem] border border-white/10 bg-black/25 px-3 text-sm text-white placeholder:text-white/35"/><FilterFields data={data}/><button className="min-h-11 rounded-full border border-[var(--color-accent)]/50 bg-[rgba(190,160,120,.1)] px-4 text-sm font-semibold text-[var(--color-accent-soft)]">Filtry</button><Link href={`?view=${data.view}`} className="self-center text-sm text-white/62 underline">Vymazat filtry</Link></form><form method="get" className="flex gap-2 md:hidden"><input type="hidden" name="view" value={data.view}/><input name="query" defaultValue={data.filters.query} placeholder="Hledat…" className="min-h-11 min-w-0 flex-1 rounded-[.8rem] border border-white/10 bg-black/25 px-3 text-sm text-white placeholder:text-white/35"/><button ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)} className="min-h-11 rounded-full border border-[var(--color-accent)]/35 bg-[rgba(190,160,120,.08)] px-4 text-sm text-[var(--color-accent-soft)]">Filtry</button></form>{open ? <LogsFiltersDialog data={data} onClose={close} /> : null}</>;
}

export function AdminLogsPage({ data }: { data: AdminLogsData }) {
  const isOwner = data.area === "owner";
  const columns: ColumnDef<AdminLogItem>[] = [{ accessorKey: "occurredAt", header: "Čas", cell: ({ row }) => formatLogTime(row.original.occurredAt) }, { accessorKey: "title", header: "Událost", cell: ({ row }) => <><b>{row.original.title}</b><p className="break-words text-xs text-white/60">{row.original.description}</p></> }, { accessorKey: "category", header: "Kategorie", cell: ({ row }) => categoryLabel[row.original.category] }, { accessorKey: "severity", header: "Závažnost / stav", cell: ({ row }) => severityLabel[row.original.severity] }, { accessorKey: "entityLabel", header: "Kontext", cell: ({ row }) => row.original.entityHref ? <Link href={row.original.entityHref} className="underline">{row.original.entityLabel}</Link> : row.original.entityLabel }, { accessorKey: "actorLabel", header: "Provedl" }, { id: "action", header: "Akce", cell: ({ row }) => <Action item={row.original}/> }];
  // TanStack Table vrací nestabilní API; React Compiler tuto komponentu správně přeskočí.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: data.items, columns, getCoreRowModel: getCoreRowModel(), getRowId: (row) => row.id });
  const empty = data.view === "system" ? "Nejsou dostupné žádné systémové události." : data.view === "attention" ? "Nic nyní nevyžaduje pozornost." : "Zatím nejsou evidované žádné provozní události.";
  const rangeStart = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const rangeEnd = Math.min(data.page * data.pageSize, data.total);
  return <AdminPageShell eyebrow={isOwner ? "Provozní přehled" : "Provoz salonu"} title="Události a logy" description="Jednotný přehled skutečně uložených provozních událostí a e-mailů." denseIntro><div className="space-y-3"><nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Pohledy logů">{views.filter((item) => !item.ownerOnly || isOwner).map((item) => <Link key={item.value} href={hrefWith(data, { view: item.value, source: undefined, emailType: undefined, page: undefined })} className={`shrink-0 rounded-full border px-4 py-2 text-sm transition ${data.view === item.value ? "border-[var(--color-accent)]/55 bg-[rgba(190,160,120,.14)] text-[var(--color-accent-soft)]" : "border-white/10 bg-white/[.025] text-white/65 hover:bg-white/[.06] hover:text-white"}`}>{item.label}</Link>)}</nav>{data.view === "attention" ? <section className="rounded-[1rem] border border-amber-300/20 bg-amber-400/10 p-3 text-sm text-amber-50">Vyžaduje pozornost: {data.attention.failed} selhaných e-mailů · {data.attention.retry} čeká na retry · {data.attention.stuck} zaseknutých procesů</section> : null}<AdminPanel title="Přehled" compact denseHeader tighter><LogsToolbar data={data}/>{data.items.length ? <><div className="mt-3 hidden overflow-x-auto rounded-[1rem] border border-white/8 md:block"><table className="min-w-[900px] w-full"><thead className="bg-black/20">{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th key={header.id} className="p-3 text-left text-[10px] uppercase tracking-[.16em] text-white/45">{flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.map((row) => <tr key={row.id} className="border-t border-white/8 transition hover:bg-white/[.035]">{row.getVisibleCells().map((cell) => <td key={cell.id} className="p-3 align-top text-sm text-white/78">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody></table></div><div className="mt-3 space-y-2 md:hidden">{table.getRowModel().rows.map((row) => <article key={row.id} className="rounded-[1rem] border border-white/10 bg-white/[.03] p-3"><p className="text-xs text-white/55">{formatLogTime(row.original.occurredAt)}</p><h3 className="mt-1 font-medium text-white">{row.original.title}</h3><p className="break-words text-sm text-white/65">{row.original.description}</p><p className="mt-2 text-xs text-white/52">{categoryLabel[row.original.category]} · {severityLabel[row.original.severity]}</p><div className="mt-3"><Action item={row.original}/></div></article>)}</div></> : <p className="py-8 text-center text-white/60">{empty}</p>}<div className="mt-3 flex items-center justify-between gap-3 border-t border-white/8 pt-3 text-sm"><span className="text-white/52">{rangeStart}–{rangeEnd} z {data.total}</span><div className="flex gap-2">{data.page > 1 ? <Link href={hrefWith(data, { page: String(data.page - 1) })} className="rounded-full border border-white/10 px-3 py-2 text-white/72">Předchozí</Link> : null}{data.page < data.pageCount ? <Link href={hrefWith(data, { page: String(data.page + 1) })} className="rounded-full border border-white/10 px-3 py-2 text-white/72">Další</Link> : null}</div></div></AdminPanel>{isOwner ? <details className="rounded-[1rem] border border-white/10 bg-white/[.03] p-4 text-white"><summary className="cursor-pointer font-medium">Technický stav služeb</summary><p className="mt-2 text-sm text-white/62">{data.workerSummary}</p></details> : null}</div></AdminPageShell>;
}
