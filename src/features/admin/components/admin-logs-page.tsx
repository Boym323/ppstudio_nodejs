"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { releaseStuckEmailLogAction, retryEmailLogAction } from "../actions/email-log-actions";
import { type AdminLogItem, type AdminLogsData, type AdminLogView } from "../lib/data/email-logs";
import { buildAdminLogsSearchParams, type AdminLogUrlChanges } from "../lib/admin-logs-url";
import { AdminPageShell } from "./admin-page-shell";
import * as Sheet from "@/components/ui/sheet";

const views: Array<{ value: AdminLogView; label: string; hint: string; ownerOnly?: boolean }> = [
  { value: "attention", label: "K vyřešení", hint: "Co vyžaduje zásah" },
  { value: "events", label: "Historie změn", hint: "Provozní historie" },
  { value: "emails", label: "E-maily", hint: "Doručování a fronta" },
  { value: "system", label: "Technické", hint: "Bezpečnost a systém", ownerOnly: true },
];

const severityLabel = { info: "Informace", success: "V pořádku", warning: "Varování", error: "Chyba" } as const;
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

function ActionButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="min-h-11 rounded-full border border-[var(--color-accent)]/40 bg-[rgba(190,160,120,.1)] px-3 text-sm font-medium text-[var(--color-accent-soft)] disabled:opacity-50">{pending ? "Zpracovávám…" : children}</button>;
}

function Action({ item }: { item: AdminLogItem }) {
  if (item.primaryAction === "retry" && item.emailLogId) return <form action={retryEmailLogAction}><input type="hidden" name="emailLogId" value={item.emailLogId} /><ActionButton>Zopakovat odeslání</ActionButton></form>;
  if (item.primaryAction === "release" && item.emailLogId) return <form action={releaseStuckEmailLogAction}><input type="hidden" name="emailLogId" value={item.emailLogId} /><ActionButton>Obnovit zpracování</ActionButton></form>;
  const href = item.primaryAction === "detail" && item.emailLogId ? `/admin/email-logy/${item.emailLogId}` : item.entityHref;
  const label = item.primaryAction === "detail" ? "Detail e-mailu" : item.sourceType === "booking" ? "Otevřít rezervaci" : item.sourceType === "voucher" ? "Otevřít voucher" : "Otevřít detail";
  return href ? <Link className="inline-flex min-h-11 items-center text-sm text-[var(--color-accent-soft)] underline underline-offset-4" href={href}>{label}</Link> : null;
}

function FilterFields({ data, dates = true }: { data: AdminLogsData; dates?: boolean }) {
  const controlClass = "min-h-11 rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white";
  return <>
    <select name="severity" aria-label="Závažnost" defaultValue={data.filters.severity} className={controlClass}><option value="all">Všechny stavy</option><option value="info">Informace</option><option value="success">V pořádku</option><option value="warning">Varování</option><option value="error">Chyba</option></select>
    {data.view === "attention" ? <input type="hidden" name="source" value={data.filters.source} /> : null}
    {data.view === "events" ? <select name="source" aria-label="Zdroj" defaultValue={data.filters.source} className={controlClass}><option value="all">Všechny zdroje</option><option value="booking">Rezervace</option><option value="voucher">Voucher</option><option value="service">Služby</option>{data.area === "owner" ? <option value="settings">Nastavení</option> : null}<option value="availability">Dostupnost</option></select> : null}
    {data.view === "system" ? <select name="source" aria-label="Zdroj" defaultValue={data.filters.source} className={controlClass}><option value="all">Všechny zdroje</option><option value="admin">Admin účty</option><option value="submission">Systémové zápisy</option></select> : null}
    {data.view === "emails" ? <select name="emailType" aria-label="Typ e-mailu" defaultValue={data.filters.emailType} className={controlClass}><option value="all">Všechny typy</option><option value="BOOKING_CREATED">Notifikace nové rezervace</option><option value="BOOKING_RECEIVED">Přijetí rezervace</option><option value="BOOKING_CONFIRMED">Potvrzení rezervace</option><option value="BOOKING_CANCELLED">Zrušení rezervace</option><option value="BOOKING_RESCHEDULED">Přesun rezervace</option><option value="BOOKING_REMINDER">Připomínka termínu</option><option value="VOUCHER_SENT">Voucher</option><option value="GENERIC">Ostatní</option></select> : null}
    {dates ? <><input type="date" name="dateFrom" defaultValue={data.filters.dateFrom} aria-label="Od" className={`${controlClass} [color-scheme:dark]`} />
    <input type="date" name="dateTo" defaultValue={data.filters.dateTo} aria-label="Do" className={`${controlClass} [color-scheme:dark]`} /></> : null}
  </>;
}

function LogsFiltersDialog({ data }: { data: AdminLogsData }) {
  return <Sheet.Content asChild className="md:hidden"><form method="get" className="scroll-pb-28"><input type="hidden" name="view" value={data.view} /><input type="hidden" name="query" value={data.filters.query} /><Sheet.Description className="sr-only">Upřesnění filtrů provozních logů.</Sheet.Description><div className="flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[.2em] text-[var(--color-accent-soft)]">Upřesnit přehled</p><Sheet.Title className="mt-1 text-xl">Filtry událostí</Sheet.Title></div><Sheet.Close asChild><button type="button" className="min-h-11 px-3 text-white/72">Zavřít</button></Sheet.Close></div><div className="mt-4 grid gap-3"><FilterFields data={data} /></div><div className="sticky bottom-0 mt-5 flex gap-2 border-t border-white/10 bg-[#111015]/96 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3"><Link href={`?view=${data.view}`} className="inline-flex min-h-11 items-center px-3 text-sm text-white/72 underline">Vymazat</Link><button className="min-h-11 flex-1 rounded-full bg-[var(--color-accent)] px-4 font-semibold text-[var(--color-accent-contrast)]">Použít filtry</button></div></form></Sheet.Content>;
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

  return <Sheet.Root open={open} onOpenChange={setOpen}><form method="get" className="hidden md:block"><input type="hidden" name="view" value={data.view} /><div className="flex flex-wrap items-center gap-2"><input name="query" defaultValue={data.filters.query} placeholder={searchPlaceholder} className="min-h-11 min-w-[16rem] flex-1 rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white placeholder:text-white/35" /><label className="text-xs text-white/65">Od<input type="date" name="dateFrom" defaultValue={data.filters.dateFrom} className="ml-2 min-h-11 rounded-xl border border-white/10 bg-black/25 px-2 text-sm text-white [color-scheme:dark]" /></label><label className="text-xs text-white/65">Do<input type="date" name="dateTo" defaultValue={data.filters.dateTo} className="ml-2 min-h-11 rounded-xl border border-white/10 bg-black/25 px-2 text-sm text-white [color-scheme:dark]" /></label><details className="basis-full" open={data.filters.severity !== "all" || data.filters.source !== "all" || data.filters.emailType !== "all"}><summary className="min-h-11 cursor-pointer py-3 text-sm text-white/70">Další filtry</summary><div className="flex flex-wrap gap-2 pb-2"><FilterFields data={data} dates={false} /></div></details><button className="min-h-11 rounded-full border border-[var(--color-accent)]/50 bg-[rgba(190,160,120,.1)] px-4 text-sm font-semibold text-[var(--color-accent-soft)]">Použít</button>{activeFilters ? <Link href={`?view=${data.view}`} className="min-h-11 px-2 text-sm leading-[2.75rem] text-white/62 underline">Vymazat filtry</Link> : null}</div></form><form method="get" className="flex gap-2 md:hidden"><input type="hidden" name="view" value={data.view} />{mobilePreservedFilters.map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}<input name="query" defaultValue={data.filters.query} placeholder="Hledat…" className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white placeholder:text-white/35" /><Sheet.Trigger asChild><button type="button" className={`min-h-11 rounded-full border px-4 text-sm ${activeFilters ? "border-[var(--color-accent)]/55 bg-[rgba(190,160,120,.15)] text-[var(--color-accent-soft)]" : "border-white/15 text-white/78"}`}>Filtry{activeFilters ? " •" : ""}</button></Sheet.Trigger></form><LogsFiltersDialog data={data} /></Sheet.Root>;
}

function AttentionSummary({ data }: { data: AdminLogsData }) {
  const items = [
    { label: "Problémy s doručením", value: data.attention.failed },
    { label: "Čeká na další pokus", value: data.attention.retry },
    { label: "Zpracování se zdrželo", value: data.attention.stuck },
    ...(data.area === "owner" ? [{ label: "Systémové chyby", value: data.attention.critical }] : []),
  ].filter((item) => item.value > 0);
  if (!items.length) return null;
  return <div aria-label="Aktuální stav doručování" className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/70">{items.map((item) => <span key={item.label}>{item.label}: <strong className="text-white">{item.value}</strong></span>)}</div>;
}

function LogStatus({ item, view }: { item: AdminLogItem; view: AdminLogView }) {
  const warning = item.severity === "error" || item.severity === "warning";
  return <div className="space-y-1 text-xs text-white/70">{view === "emails" ? <><p>{item.queueState}</p><p>{item.trackingState}</p></> : null}{warning ? <SeverityPill severity={item.severity} /> : null}</div>;
}

function LogDescription({ item, view }: { item: AdminLogItem; view: AdminLogView }) {
  if (!item.description) return null;
  if (view === "attention" || view === "emails") return <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-white/70">{item.description}</p>;
  return <details className="mt-1 text-sm text-white/65"><summary className="cursor-pointer py-1">Podrobnosti změny</summary><p className="whitespace-pre-wrap break-words py-1">{item.description}</p></details>;
}

function EntityLink({ item }: { item: AdminLogItem }) {
  return item.entityLabel ? <p className="mt-1 break-words text-sm text-white/80">{item.entityHref ? <Link href={item.entityHref} className="underline decoration-white/30 underline-offset-4">{item.entityLabel}</Link> : item.entityLabel}</p> : null;
}

function LogCard({ item, view }: { item: AdminLogItem; view: AdminLogView }) {
  return <article className={`min-w-0 border-b border-white/8 px-3 py-3 last:border-b-0 sm:px-4 ${view === "attention" && item.severity === "error" ? "border-l-2 border-l-rose-400 bg-rose-400/[.035]" : ""}`}>
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <h3 className="min-w-0 break-words text-sm font-medium text-white">{item.title}</h3>
      <time dateTime={item.occurredAt} className="shrink-0 text-xs text-white/55">{formatLogTime(item.occurredAt)}</time>
    </div>
    <EntityLink item={item} />
    <LogDescription item={item} view={view} />
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap items-center gap-2"><LogStatus item={item} view={view} />{item.actorLabel ? <span className="text-xs text-white/55">{item.actorLabel}</span> : null}</div><Action item={item} /></div>
  </article>;
}

const logDay = new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "long", year: "numeric" });

function HistoryList({ items }: { items: AdminLogItem[] }) {
  const groups = new Map<string, AdminLogItem[]>();
  for (const item of items) {
    const date = new Date(item.occurredAt);
    const day = Number.isNaN(date.getTime()) ? "Bez data" : logDay.format(date);
    groups.set(day, [...(groups.get(day) ?? []), item]);
  }
  return <div className="space-y-4">{[...groups].map(([day, entries]) => <section key={day} aria-label={day}><h2 className="px-3 pb-2 text-sm font-medium text-white/65">{day}</h2><div className="rounded-xl border border-white/8">{entries.map((item) => <LogCard key={item.id} item={item} view="events" />)}</div></section>)}</div>;
}

function LogTable({ data }: { data: AdminLogsData }) {
  const emails = data.view === "emails";
  return <><div className="hidden overflow-x-auto rounded-xl border border-white/8 md:block"><table className="w-full min-w-[680px] text-left text-sm">
    <thead className="border-b border-white/10 text-xs text-white/60"><tr><th scope="col" className="p-3 font-medium">{emails ? "Zpráva a příjemce" : "Událost"}</th><th scope="col" className="p-3 font-medium">{emails ? "Doručování" : "Stav"}</th><th scope="col" className="p-3 font-medium">Čas</th><th scope="col" className="p-3"><span className="sr-only">Akce</span></th></tr></thead>
    <tbody>{data.items.map((item) => <tr key={item.id} className="border-b border-white/8 last:border-0 hover:bg-white/[.025]">
      <td className="max-w-xl p-3 align-top"><p className="break-words font-medium text-white">{item.title}</p><EntityLink item={item} /><LogDescription item={item} view={data.view} />{item.actorLabel ? <p className="mt-1 text-xs text-white/55">{item.actorLabel}</p> : null}</td>
      <td className="p-3 align-top"><LogStatus item={item} view={data.view} /></td>
      <td className="whitespace-nowrap p-3 align-top text-xs text-white/55"><time dateTime={item.occurredAt}>{formatLogTime(item.occurredAt)}</time></td>
      <td className="p-3 align-top"><Action item={item} /></td>
    </tr>)}</tbody>
  </table></div><div className="rounded-xl border border-white/8 md:hidden">{data.items.map((item) => <LogCard key={item.id} item={item} view={data.view} />)}</div></>;
}

export function AdminLogsPage({ data }: { data: AdminLogsData }) {
  const isOwner = data.area === "owner";
  const currentView = views.find((view) => view.value === data.view) ?? views[1];
  const filtered = hasActiveFilters(data);
  const empty = filtered ? "Zadaným filtrům neodpovídají žádné záznamy." : data.view === "attention" ? "Vše je v pořádku. Nic nyní nevyžaduje pozornost." : data.view === "emails" ? "Zatím nejsou evidované žádné e-maily." : "Zatím nejsou evidované žádné události.";
  const rangeStart = data.total === 0 ? 0 : (data.page - 1) * data.pageSize + 1;
  const rangeEnd = Math.min(data.page * data.pageSize, data.total);
  return <AdminPageShell eyebrow={isOwner ? "Administrace" : "Provoz salonu"} title="Události" description="" mobileCompactIntro denseIntro>
    <div className="min-w-0 space-y-4">
      <nav className="flex gap-1 overflow-x-auto border-b border-white/10" aria-label="Pohledy událostí">{views.filter((item) => !item.ownerOnly || isOwner).map((item) => <Link key={item.value} href={hrefWith(data, { view: item.value, source: undefined, emailType: undefined, page: undefined })} aria-current={data.view === item.value ? "page" : undefined} className={`inline-flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm transition ${data.view === item.value ? "border-[var(--color-accent)] font-semibold text-[var(--color-accent-soft)]" : "border-transparent text-white/60 hover:text-white"}`}>{item.label}</Link>)}</nav>
      {data.view === "attention" ? <AttentionSummary data={data} /> : null}
      <LogsToolbar key={`${data.view}:${buildAdminLogsSearchParams(data.view, data.filters)}`} data={data} />
      <section aria-label={currentView.label} className="min-w-0 space-y-3">
        <p className="text-xs text-white/55">{data.total} záznamů · od nejnovějších{filtered ? " · filtrováno" : ""}</p>
        {data.items.length ? data.view === "attention" ? <div className="overflow-hidden rounded-xl border border-white/8">{data.items.map((item) => <LogCard key={item.id} item={item} view={data.view} />)}</div> : data.view === "events" ? <HistoryList items={data.items} /> : <LogTable data={data} /> : <div className={`rounded-xl px-4 py-7 text-sm ${data.view === "attention" && !filtered ? "bg-emerald-400/[.04] text-emerald-100" : "bg-white/[.025] text-white/75"}`}><p>{empty}</p>{filtered ? <Link href={`?view=${data.view}`} className="mt-2 inline-flex min-h-11 items-center underline underline-offset-4">Vymazat filtry</Link> : null}</div>}
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-3 text-sm text-white/60"><p>{rangeStart}–{rangeEnd} z {data.total} · stránka {data.page} z {data.pageCount}</p><div className="flex gap-3">{data.page > 1 ? <Link href={hrefWith(data, { page: String(data.page - 1) })} className="inline-flex min-h-11 items-center underline underline-offset-4">Předchozí</Link> : null}{data.page < data.pageCount ? <Link href={hrefWith(data, { page: String(data.page + 1) })} className="inline-flex min-h-11 items-center underline underline-offset-4">Další</Link> : null}</div></div>
      {isOwner && data.view === "system" ? <details className="border-t border-white/8 pt-3"><summary className="min-h-11 cursor-pointer text-sm text-white/65">Technický stav e-mailové fronty</summary><p className="text-sm text-white/60">{data.workerSummary}</p></details> : null}
    </div>
  </AdminPageShell>;
}
