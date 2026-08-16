"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";

import { releaseStuckEmailLogAction, retryEmailLogAction } from "../actions/email-log-actions";
import { type AdminLogItem, type AdminLogsData, type AdminLogView } from "../lib/admin-data";
import { buildAdminLogsSearchParams, type AdminLogUrlChanges } from "../lib/admin-logs-url";
import { AdminPageShell, AdminPanel } from "./admin-page-shell";
import * as Sheet from "@/components/ui/sheet";

const views: Array<{ value: AdminLogView; label: string; hint: string; ownerOnly?: boolean }> = [
  { value: "attention", label: "Pozornost", hint: "Co vyžaduje zásah" },
  { value: "events", label: "Události", hint: "Provozní historie" },
  { value: "emails", label: "E-maily", hint: "Doručování a fronta" },
  { value: "system", label: "Systém", hint: "Bezpečnost a systém", ownerOnly: true },
];

const severityLabel = { info: "Informace", success: "V pořádku", warning: "Varování", error: "Chyba" } as const;
const categoryLabel = { event: "Událost", email: "E-mail", automation: "Automatizace", system: "Systém" } as const;
const severityClasses = {
  info: "border-sky-300/25 bg-sky-400/10 text-sky-100",
  success: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100",
  warning: "border-amber-300/30 bg-amber-400/10 text-amber-100",
  error: "border-rose-300/30 bg-rose-400/10 text-rose-100",
} as const;
const severityDotClasses = {
  info: "bg-sky-300",
  success: "bg-emerald-300",
  warning: "bg-amber-300",
  error: "bg-rose-300",
} as const;
const viewStyles = {
  attention: "border-amber-300/30 bg-amber-400/10 text-amber-50",
  events: "border-[var(--color-accent)]/45 bg-[rgba(190,160,120,.12)] text-[var(--color-accent-soft)]",
  emails: "border-sky-300/25 bg-sky-400/10 text-sky-100",
  system: "border-violet-300/25 bg-violet-400/10 text-violet-100",
} as const;

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

function hrefWith(data: AdminLogsData, changes: AdminLogUrlChanges) {
  return `?${buildAdminLogsSearchParams(data.view, data.filters, changes)}`;
}

function SeverityPill({ severity }: { severity: AdminLogItem["severity"] }) {
  return <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${severityClasses[severity]}`}><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${severityDotClasses[severity]}`} />{severityLabel[severity]}</span>;
}

function CategoryPill({ category }: { category: AdminLogItem["category"] }) {
  return <span className="inline-flex w-fit rounded-full border border-white/10 bg-black/15 px-2.5 py-1 text-[11px] text-white/62">{categoryLabel[category]}</span>;
}

function Action({ item }: { item: AdminLogItem }) {
  if (item.primaryAction === "retry" && item.emailLogId) return <form action={retryEmailLogAction}><input type="hidden" name="emailLogId" value={item.emailLogId} /><button className="min-h-10 rounded-full border border-[var(--color-accent)]/45 bg-[rgba(190,160,120,.1)] px-3 text-xs font-semibold text-[var(--color-accent-soft)]">Zkusit znovu</button></form>;
  if (item.primaryAction === "release" && item.emailLogId) return <form action={releaseStuckEmailLogAction}><input type="hidden" name="emailLogId" value={item.emailLogId} /><button className="min-h-10 rounded-full border border-amber-300/35 bg-amber-400/10 px-3 text-xs font-semibold text-amber-100">Uvolnit</button></form>;
  if (item.primaryAction === "detail" && item.emailLogId) return <Link className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-3 text-xs text-white/80 transition hover:bg-white/8" href={`/admin/email-logy/${item.emailLogId}`}>Detail</Link>;
  return item.entityHref ? <Link className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-3 text-xs text-white/80 transition hover:bg-white/8" href={item.entityHref}>Otevřít</Link> : <span className="text-white/35">—</span>;
}

function FilterFields({ data }: { data: AdminLogsData }) {
  const controlClass = "min-h-11 rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white";
  return <>
    <select name="severity" aria-label="Závažnost" defaultValue={data.filters.severity} className={controlClass}><option value="all">Všechny stavy</option><option value="info">Informace</option><option value="success">V pořádku</option><option value="warning">Varování</option><option value="error">Chyba</option></select>
    {data.view === "events" ? <select name="source" aria-label="Zdroj" defaultValue={data.filters.source} className={controlClass}><option value="all">Všechny zdroje</option><option value="booking">Rezervace</option><option value="voucher">Voucher</option><option value="service">Služby</option>{data.area === "owner" ? <option value="settings">Nastavení</option> : null}<option value="availability">Dostupnost</option></select> : null}
    {data.view === "system" ? <select name="source" aria-label="Zdroj" defaultValue={data.filters.source} className={controlClass}><option value="all">Všechny zdroje</option><option value="admin">Admin účty</option><option value="submission">Systémové zápisy</option></select> : null}
    {data.view === "emails" ? <select name="emailType" aria-label="Typ e-mailu" defaultValue={data.filters.emailType} className={controlClass}><option value="all">Všechny typy</option><option value="BOOKING_CREATED">Notifikace nové rezervace</option><option value="BOOKING_RECEIVED">Přijetí rezervace</option><option value="BOOKING_CONFIRMED">Potvrzení rezervace</option><option value="BOOKING_CANCELLED">Zrušení rezervace</option><option value="BOOKING_RESCHEDULED">Přesun rezervace</option><option value="BOOKING_REMINDER">Připomínka termínu</option><option value="VOUCHER_SENT">Voucher</option><option value="GENERIC">Ostatní</option></select> : null}
    <input type="date" name="dateFrom" defaultValue={data.filters.dateFrom} aria-label="Od" className={`${controlClass} [color-scheme:dark]`} />
    <input type="date" name="dateTo" defaultValue={data.filters.dateTo} aria-label="Do" className={`${controlClass} [color-scheme:dark]`} />
  </>;
}

function LogsFiltersDialog({ data }: { data: AdminLogsData }) {
  return <Sheet.Content asChild className="md:hidden"><form method="get" className="scroll-pb-28"><input type="hidden" name="view" value={data.view} /><input type="hidden" name="query" value={data.filters.query} /><Sheet.Description className="sr-only">Upřesnění filtrů provozních logů.</Sheet.Description><div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[.2em] text-[var(--color-accent-soft)]">Upřesnit přehled</p><Sheet.Title className="mt-1 text-xl">Filtry logů</Sheet.Title></div><Sheet.Close asChild><button type="button" className="min-h-11 px-3 text-white/72">Zavřít</button></Sheet.Close></div><div className="mt-4 grid gap-3"><FilterFields data={data} /></div><div className="sticky bottom-0 mt-5 flex gap-2 border-t border-white/10 bg-[#111015]/96 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3"><Link href={`?view=${data.view}`} className="inline-flex min-h-11 items-center px-3 text-sm text-white/72 underline">Vymazat</Link><button className="min-h-11 flex-1 rounded-full bg-[var(--color-accent)] px-4 font-semibold text-[var(--color-accent-contrast)]">Použít filtry</button></div></form></Sheet.Content>;
}

function hasActiveFilters(data: AdminLogsData) {
  return data.filters.query.length > 0 || data.filters.severity !== "all" || data.filters.source !== "all" || data.filters.emailType !== "all" || data.filters.dateFrom.length > 0 || data.filters.dateTo.length > 0;
}

function LogsToolbar({ data }: { data: AdminLogsData }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const closeOnTablet = () => { if (mediaQuery.matches) setOpen(false); };
    mediaQuery.addEventListener("change", closeOnTablet);
    return () => mediaQuery.removeEventListener("change", closeOnTablet);
  }, []);
  const activeFilters = hasActiveFilters(data);
  const searchPlaceholder = data.view === "events"
    ? "Hledat rezervaci, voucher nebo službu…"
    : data.view === "emails"
      ? "Hledat e-mail, předmět nebo rezervaci…"
      : data.view === "system"
        ? "Hledat účet nebo systémovou událost…"
        : "Hledat e-mail nebo kritickou chybu…";
  const mobilePreservedFilters = [...buildAdminLogsSearchParams(data.view, data.filters).entries()]
    .filter(([name]) => name !== "view" && name !== "query");

  return <Sheet.Root open={open} onOpenChange={setOpen}><form method="get" className="hidden rounded-[1.1rem] border border-white/8 bg-[#151219]/95 p-3 md:block"><input type="hidden" name="view" value={data.view} /><div className="flex flex-wrap items-center gap-2"><input name="query" defaultValue={data.filters.query} placeholder={searchPlaceholder} className="min-h-11 min-w-[16rem] flex-1 rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white placeholder:text-white/35" /><FilterFields data={data} /><button className="min-h-11 rounded-full border border-[var(--color-accent)]/50 bg-[rgba(190,160,120,.1)] px-4 text-sm font-semibold text-[var(--color-accent-soft)]">Použít</button>{activeFilters ? <Link href={`?view=${data.view}`} className="min-h-11 px-2 text-sm leading-[2.75rem] text-white/62 underline">Vymazat filtry</Link> : null}</div></form><form method="get" className="flex gap-2 md:hidden"><input type="hidden" name="view" value={data.view} />{mobilePreservedFilters.map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}<input name="query" defaultValue={data.filters.query} placeholder="Hledat…" className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white placeholder:text-white/35" /><Sheet.Trigger asChild><button type="button" className={`min-h-11 rounded-full border px-4 text-sm ${activeFilters ? "border-[var(--color-accent)]/55 bg-[rgba(190,160,120,.15)] text-[var(--color-accent-soft)]" : "border-white/15 text-white/78"}`}>Filtry{activeFilters ? " •" : ""}</button></Sheet.Trigger></form><LogsFiltersDialog data={data} /></Sheet.Root>;
}

function AttentionSummary({ data, isOwner }: { data: AdminLogsData; isOwner: boolean }) {
  const items = [
    { label: "Aktivní incidenty", value: data.attention.failed, tone: "text-rose-100" },
    { label: "Čeká na retry", value: data.attention.retry, tone: "text-amber-100" },
    { label: "Zaseknuté", value: data.attention.stuck, tone: "text-amber-100" },
    ...(isOwner ? [{ label: "Systémové chyby", value: data.attention.critical, tone: "text-rose-100" }] : []),
  ];
  return <section className="rounded-[1.15rem] border border-amber-300/25 bg-[linear-gradient(120deg,rgba(251,191,36,.13),rgba(251,191,36,.04))] p-3.5 sm:p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-100/75">Pozornost</p><p className="mt-1 text-sm text-amber-50/85">Položky, které mohou potřebovat provozní zásah.</p></div><span className="rounded-full border border-amber-200/20 bg-amber-100/10 px-2.5 py-1 text-xs text-amber-50">aktuální stav</span></div><dl className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">{items.map((item) => <div key={item.label} className="rounded-xl border border-amber-100/10 bg-black/15 px-3 py-2.5"><dt className="text-[10px] uppercase tracking-[.14em] text-amber-100/60">{item.label}</dt><dd className={`mt-1 font-display text-2xl leading-none ${item.tone}`}>{item.value}</dd></div>)}</dl></section>;
}

function MobileLogCard({ item }: { item: AdminLogItem }) {
  return <article className={`overflow-hidden rounded-[1.1rem] border border-white/10 bg-white/[.035] ${item.severity === "error" ? "shadow-[inset_3px_0_0_rgba(251,113,133,.9)]" : item.severity === "warning" ? "shadow-[inset_3px_0_0_rgba(252,211,77,.9)]" : "shadow-[inset_3px_0_0_rgba(255,255,255,.14)]"}`}><div className="p-3.5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><CategoryPill category={item.category} /><SeverityPill severity={item.severity} /></div><h3 className="mt-2 break-words font-medium text-white">{item.title}</h3></div><time className="shrink-0 text-right text-[11px] leading-4 text-white/50">{formatLogTime(item.occurredAt)}</time></div>{item.description ? <p className="mt-2 break-words text-sm leading-5 text-white/68">{item.description}</p> : null}<div className="mt-3 grid gap-1.5 border-t border-white/8 pt-3 text-xs"><p className="text-white/52"><span className="text-white/38">Kontext: </span>{item.entityHref ? <Link href={item.entityHref} className="text-white/78 underline underline-offset-2">{item.entityLabel}</Link> : item.entityLabel ?? "—"}</p>{item.actorLabel ? <p className="text-white/52"><span className="text-white/38">Provedl: </span>{item.actorLabel}</p> : null}</div><div className="mt-3"><Action item={item} /></div></div></article>;
}

export function AdminLogsPage({ data }: { data: AdminLogsData }) {
  const isOwner = data.area === "owner";
  const currentView = views.find((view) => view.value === data.view) ?? views[1];
  const columns: ColumnDef<AdminLogItem>[] = [
    { accessorKey: "occurredAt", header: "Čas", cell: ({ row }) => <time className="whitespace-nowrap text-xs text-white/58">{formatLogTime(row.original.occurredAt)}</time> },
    { accessorKey: "title", header: "Událost", cell: ({ row }) => <div className="min-w-[17rem]"><div className="flex flex-wrap items-center gap-2"><b className="text-white">{row.original.title}</b><SeverityPill severity={row.original.severity} /></div>{row.original.description ? <p className="mt-1 max-w-xl break-words text-xs leading-5 text-white/60">{row.original.description}</p> : null}</div> },
    { accessorKey: "entityLabel", header: "Kontext", cell: ({ row }) => <div className="min-w-[10rem] text-sm text-white/75">{row.original.entityHref ? <Link href={row.original.entityHref} className="underline decoration-white/25 underline-offset-4 transition hover:text-white">{row.original.entityLabel}</Link> : row.original.entityLabel ?? "—"}</div> },
    { accessorKey: "actorLabel", header: "Provedl", cell: ({ row }) => <span className="text-sm text-white/65">{row.original.actorLabel ?? "—"}</span> },
    { id: "action", header: "", cell: ({ row }) => <div className="flex justify-end"><Action item={row.original} /></div> },
  ];
  // TanStack Table vrací nestabilní API; React Compiler tuto komponentu správně přeskočí.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: data.items, columns, getCoreRowModel: getCoreRowModel(), getRowId: (row) => row.id });
  const empty = data.view === "system" ? "Nejsou dostupné žádné systémové události." : data.view === "attention" ? "Nic nyní nevyžaduje pozornost." : "Zatím nejsou evidované žádné provozní události.";
  const rangeStart = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const rangeEnd = Math.min(data.page * data.pageSize, data.total);

  return <AdminPageShell eyebrow={isOwner ? "Provozní přehled" : "Provoz salonu"} title="Události a logy" description="Přehled provozní historie, doručování a bezpečnostně významných změn." denseIntro><div className="space-y-3.5"><nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Pohledy logů">{views.filter((item) => !item.ownerOnly || isOwner).map((item) => <Link key={item.value} href={hrefWith(data, { view: item.value, source: undefined, emailType: undefined, page: undefined })} className={`group shrink-0 rounded-[1rem] border px-3.5 py-2.5 text-left transition sm:px-4 ${data.view === item.value ? viewStyles[item.value] : "border-white/10 bg-white/[.025] text-white/62 hover:bg-white/[.06] hover:text-white"}`}><span className="block text-sm font-medium">{item.label}</span><span className={`mt-0.5 block text-[10px] ${data.view === item.value ? "opacity-75" : "text-white/38 group-hover:text-white/52"}`}>{item.hint}</span></Link>)}</nav>{data.view === "attention" ? <AttentionSummary data={data} isOwner={isOwner} /> : null}<AdminPanel title={currentView.label} description={currentView.hint} compact denseHeader tighter><div className="flex flex-wrap items-center justify-between gap-2"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${viewStyles[data.view]}`}>{data.total} {data.total === 1 ? "záznam" : data.total >= 2 && data.total <= 4 ? "záznamy" : "záznamů"}</span><span className="text-xs text-white/45">Řazeno od nejnovějších</span></div><div className="mt-3"><LogsToolbar data={data} /></div>{data.items.length ? <><div className="mt-3 hidden overflow-x-auto rounded-[1rem] border border-white/8 md:block"><table className="min-w-[860px] w-full"><thead className="bg-black/25">{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th key={header.id} className="p-3 text-left text-[10px] font-medium uppercase tracking-[.16em] text-white/42">{flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.map((row) => <tr key={row.id} className="border-t border-white/8 transition hover:bg-white/[.045]">{row.getVisibleCells().map((cell) => <td key={cell.id} className="p-3 align-top text-sm text-white/78">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody></table></div><div className="mt-3 space-y-2 md:hidden">{table.getRowModel().rows.map((row) => <MobileLogCard key={row.id} item={row.original} />)}</div></> : <div className="mt-3 rounded-[1rem] border border-dashed border-white/14 bg-white/[.025] px-4 py-9 text-center"><p className="font-medium text-white/80">{empty}</p><p className="mt-1 text-sm text-white/52">Zkuste změnit pohled nebo upravit filtry.</p></div>}<div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-3"><p className="text-sm text-white/52">{rangeStart}–{rangeEnd} z {data.total} · stránka {data.page} z {data.pageCount}</p><div className="flex gap-2">{data.page > 1 ? <Link href={hrefWith(data, { page: String(data.page - 1) })} className="inline-flex min-h-10 items-center rounded-full border border-white/10 px-3 text-sm text-white/75 transition hover:bg-white/8">Předchozí</Link> : null}{data.page < data.pageCount ? <Link href={hrefWith(data, { page: String(data.page + 1) })} className="inline-flex min-h-10 items-center rounded-full border border-white/10 px-3 text-sm text-white/75 transition hover:bg-white/8">Další</Link> : null}</div></div></AdminPanel>{isOwner ? <details className="rounded-[1rem] border border-white/10 bg-white/[.025] p-4 text-white transition open:bg-white/[.04]"><summary className="cursor-pointer text-sm font-medium marker:text-[var(--color-accent-soft)]">E-mailová fronta <span className="ml-1 font-normal text-white/48">· technický stav doručování</span></summary><p className="mt-2 text-sm leading-6 text-white/62">{data.workerSummary}</p></details> : null}</div></AdminPageShell>;
}
