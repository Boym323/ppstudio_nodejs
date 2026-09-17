"use client";

import Link from "next/link";
import { VoucherPrintBatchStatus, VoucherStockItemStatus, VoucherType } from "@/generated/prisma/browser";
import { useActionState, useState } from "react";

import { type AdminArea } from "@/config/navigation";
import {
  closeVoucherPrintBatchAction,
  createVoucherPrintBatchAction,
  lookupVoucherStockItemAction,
  activateVoucherStockItemAction,
  receiveVoucherPrintBatchAction,
  voidVoucherStockItemAction,
} from "@/features/admin/actions/voucher-stock-actions";
import {
  initialCreateVoucherPrintBatchState,
  initialVoucherStockActivationState,
  initialVoucherStockLookupState,
} from "@/features/admin/actions/voucher-stock-action-state";
import { AdminPageShell, AdminPanel } from "@/features/admin/components/admin-page-shell";
import { AdminStatePill } from "@/features/admin/components/admin-state-pill";
import {
  getAdminVoucherActivationHref,
  getAdminVoucherStockBatchHref,
  getAdminVoucherStockCreateHref,
  getVoucherPrintBatchStatusLabel,
  getVoucherStockItemStatusLabel,
} from "@/features/admin/lib/admin-voucher-stock-paths";
import type {
  AdminVoucherActivationPageData,
  AdminVoucherStockBatchDetailData,
  AdminVoucherStockCreatePageData,
  AdminVoucherStockPageData,
} from "@/features/admin/lib/admin-voucher-stock";
import { cn } from "@/lib/utils";

const dateFormatter = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });
const dateTimeFormatter = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
const moneyFormatter = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0, style: "currency", currency: "CZK" });

export function AdminVoucherTabs({ area, active }: { area: AdminArea; active: "issued" | "stock" }) {
  const baseHref = area === "owner" ? "/admin/vouchery" : "/admin/provoz/vouchery";
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Vouchery">
      <Link href={baseHref} className={tabClassName(active === "issued")}>Vydané</Link>
      <Link href={`${baseHref}/predtistene`} className={tabClassName(active === "stock")}>Předtištěné</Link>
    </nav>
  );
}

function tabClassName(active: boolean) {
  return cn(
    "inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm font-semibold transition",
    active
      ? "border-[var(--color-accent)]/55 bg-[rgba(190,160,120,0.15)] text-[var(--color-accent-soft)]"
      : "border-white/10 bg-white/[0.035] text-white/70 hover:border-white/18 hover:text-white",
  );
}

function batchStatusTone(status: VoucherPrintBatchStatus) {
  return status === VoucherPrintBatchStatus.PENDING_PRINT ? "warning" as const : status === VoucherPrintBatchStatus.RECEIVED ? "active" as const : "muted" as const;
}

function itemStatusTone(status: VoucherStockItemStatus) {
  return status === VoucherStockItemStatus.AVAILABLE ? "active" as const : status === VoucherStockItemStatus.ACTIVATED ? "accent" as const : status === VoucherStockItemStatus.VOID ? "muted" as const : "warning" as const;
}

export function AdminVoucherStockPage({ data }: { data: AdminVoucherStockPageData }) {
  return (
    <AdminPageShell
      eyebrow="Dárkové vouchery"
      title="Předtištěné vouchery"
      description="Tiskové série a fyzická zásoba voucherů připravených k prodeji ve studiu."
      compact={data.area === "salon"}
      denseIntro
      headerActions={data.canCreate ? <Link className={primaryButtonClassName} href={getAdminVoucherStockCreateHref()}>Nová tisková série</Link> : null}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <AdminVoucherTabs area={data.area} active="stock" />
          <Link className={secondaryButtonClassName} href={getAdminVoucherActivationHref(data.area)}>Aktivovat voucher</Link>
        </div>

        <AdminPanel title={`Tiskové série · ${data.batches.length} záznamů`} compact={data.area === "salon"} denseHeader>
          <form action={data.currentPath} className="mb-4 grid gap-2 rounded-[1rem] border border-white/8 bg-white/[0.03] p-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end">
            <label>
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/46">Hledat</span>
              <input name="q" defaultValue={data.filters.q} placeholder="Série nebo kód" className={inputClassName} />
            </label>
            <label>
              <span className="text-[11px] uppercase tracking-[0.18em] text-white/46">Stav série</span>
              <select name="status" defaultValue={data.filters.status} className={inputClassName}>
                <option value="all" className="text-black">Vše</option>
                <option value="pending_print" className="text-black">Čeká na tisk</option>
                <option value="received" className="text-black">Převzaté</option>
                <option value="closed" className="text-black">Uzavřené</option>
              </select>
            </label>
            <button type="submit" className={primaryButtonClassName}>Filtrovat</button>
          </form>

          {data.batches.length === 0 ? (
            <div className="rounded-[1rem] border border-dashed border-white/12 px-4 py-8 text-center">
              <p className="text-base font-medium text-white">Nenalezeny žádné tiskové série.</p>
              <p className="mt-2 text-sm text-white/56">Novou sérii vytvoří OWNER po přechodu do předtisku.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {data.batches.map((batch) => (
                <Link key={batch.id} href={batch.detailHref} className="block rounded-[1rem] border border-white/8 bg-white/[0.025] p-3.5 transition hover:border-[var(--color-accent)]/35 hover:bg-white/[0.05]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-lg font-semibold tracking-[0.08em] text-white">{batch.batchNumber}</p>
                      <p className="mt-1 text-sm text-white/60">{batch.templateLabel} · {batch.quantity} kusů</p>
                    </div>
                    <AdminStatePill tone={batchStatusTone(batch.status)}>{getVoucherPrintBatchStatusLabel(batch.status)}</AdminStatePill>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-white/56 sm:grid-cols-4">
                    <span>K dispozici: <strong className="text-white/82">{batch.counts.available}</strong></span>
                    <span>Aktivováno: <strong className="text-white/82">{batch.counts.activated}</strong></span>
                    <span>Znehodnoceno: <strong className="text-white/82">{batch.counts.voided}</strong></span>
                    <span>Vytvořeno: <strong className="text-white/82">{dateFormatter.format(batch.createdAt)}</strong></span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </AdminPanel>
      </div>
    </AdminPageShell>
  );
}

export function AdminVoucherStockCreatePage({ data }: { data: AdminVoucherStockCreatePageData }) {
  const [state, formAction, pending] = useActionState(createVoucherPrintBatchAction, initialCreateVoucherPrintBatchState);
  const [quantity, setQuantity] = useState("50");

  return (
    <AdminPageShell eyebrow="Předtištěné vouchery" title="Nová tisková série" description="Vytvořte sérii unikátních kódů pro copycentrum. Hodnota, služba a platnost se doplní až při prodeji." compact>
      <AdminPanel title="Parametry série" description="Každý kus dostane vlastní kód a QR, ale před tiskem zůstane bez hodnoty a platnosti." compact denseHeader>
        <form action={formAction} className="max-w-2xl space-y-5">
          {state.formError ? <ErrorBox>{state.formError}</ErrorBox> : null}
          <label className="block">
            <span className="text-xs uppercase tracking-[0.2em] text-white/50">Vzhled</span>
            <div className="mt-2 overflow-hidden rounded-[1rem] border border-[var(--color-accent)]/35 bg-black/20">
              {data.templates.map((template) => (
                <label key={template.key} className="flex cursor-pointer items-center gap-3 p-3.5">
                  <input type="radio" name="templateKey" value={template.key} defaultChecked={template.key === data.templates[0]?.key} />
                  <span><strong className="block text-sm text-white">{template.label}</strong><span className="text-xs text-white/50">{template.key}</span></span>
                </label>
              ))}
            </div>
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-[0.2em] text-white/50">Počet kusů</span>
                  <input name="quantity" type="number" min={1} max={500} step={1} value={quantity ?? ""} onChange={(event) => setQuantity(event.target.value)} className={inputClassName} />
            {state.fieldErrors?.quantity ? <span className="mt-1 block text-sm text-red-300">{state.fieldErrors.quantity}</span> : null}
            <div className="mt-2 flex flex-wrap gap-2">
              {[25, 50, 100].map((value) => <button key={value} type="button" onClick={() => setQuantity(String(value))} className={secondaryButtonClassName}>{value}</button>)}
            </div>
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="submit" disabled={pending} className={primaryButtonClassName}>{pending ? "Vytvářím sérii…" : "Vytvořit tiskovou sérii"}</button>
            <Link href={data.listHref} className={secondaryButtonClassName}>Zpět na předtištěné</Link>
          </div>
        </form>
      </AdminPanel>
    </AdminPageShell>
  );
}

export function AdminVoucherStockBatchDetailPage({ data }: { data: AdminVoucherStockBatchDetailData }) {
  const canReceive = data.area === "owner" && data.status === VoucherPrintBatchStatus.PENDING_PRINT;
  const canClose = data.area === "owner" && data.status !== VoucherPrintBatchStatus.CLOSED;

  return (
    <AdminPageShell eyebrow="Předtištěné vouchery" title={`Série ${data.batchNumber}`} description={`${data.templateLabel} · ${data.quantity} kusů`} compact={data.area === "salon"}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={data.listHref} className={secondaryButtonClassName}>Zpět na série</Link>
          <div className="flex flex-wrap gap-2">
            {data.area === "owner" ? <a href={data.pdfHref} className={primaryButtonClassName}>Stáhnout tiskové PDF</a> : null}
            {canReceive ? <form action={receiveVoucherPrintBatchAction}><input type="hidden" name="batchId" value={data.id} /><button className={primaryButtonClassName}>Označit jako převzaté</button></form> : null}
            {canClose ? <form action={closeVoucherPrintBatchAction} onSubmit={(event) => {
              const remaining = data.counts.pendingPrint + data.counts.available;
              const confirmed = window.confirm(`Opravdu chcete uzavřít a zneplatnit tuto sérii? ${remaining} dosud neaktivovaných kusů bude znehodnoceno. Aktivované kusy zůstanou zachovány. Tuto akci nelze vrátit.`);
              if (!confirmed) event.preventDefault();
            }}><input type="hidden" name="batchId" value={data.id} /><button className={secondaryButtonClassName} title="Neaktivované kusy budou znehodnoceny a sérii už nelze znovu otevřít.">Uzavřít a zneplatnit sérii</button></form> : null}
          </div>
        </div>
        <AdminVoucherTabs area={data.area} active="stock" />
        <section className="grid gap-2 sm:grid-cols-4">
          <Metric label="Celkem" value={String(data.quantity)} />
          <Metric label="K dispozici" value={String(data.counts.available)} tone="accent" />
          <Metric label="Aktivováno" value={String(data.counts.activated)} />
          <Metric label="Znehodnoceno" value={String(data.counts.voided)} />
        </section>

        <AdminPanel title="Detaily série" description={`Vytvořeno ${dateTimeFormatter.format(data.createdAt)} · ${data.createdByUser.name}`} compact={data.area === "salon"} denseHeader>
          <div className="grid gap-3 text-sm text-white/70 sm:grid-cols-3">
            <p>Stav: <AdminStatePill tone={batchStatusTone(data.status)}>{getVoucherPrintBatchStatusLabel(data.status)}</AdminStatePill></p>
            <p>Vzhled: <strong className="text-white">{data.templateLabel}</strong></p>
            <p>Převzato: <strong className="text-white">{data.receivedAt ? dateTimeFormatter.format(data.receivedAt) : "—"}</strong></p>
          </div>
        </AdminPanel>

        <AdminPanel title={`Jednotlivé kusy · ${data.items.length}`} compact={data.area === "salon"} denseHeader>
          <form action={getAdminVoucherStockBatchHref(data.area, data.id)} className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end">
            <label><span className="text-[11px] uppercase tracking-[0.18em] text-white/46">Hledat kód</span><input name="q" defaultValue={data.filters.q} placeholder="PP-2026-…" className={inputClassName} /></label>
            <label><span className="text-[11px] uppercase tracking-[0.18em] text-white/46">Stav kusu</span><select name="status" defaultValue={data.filters.status} className={inputClassName}><option value="all" className="text-black">Vše</option><option value="pending_print" className="text-black">Čeká na tisk</option><option value="available" className="text-black">K dispozici</option><option value="activated" className="text-black">Aktivovaný</option><option value="void" className="text-black">Znehodnocený</option></select></label>
            <button type="submit" className={secondaryButtonClassName}>Filtrovat</button>
          </form>
          <div className="space-y-2">
            {data.items.map((item) => <StockItemRow key={item.id} area={data.area} batchId={data.id} item={item} />)}
            {data.items.length === 0 ? <p className="rounded-[1rem] border border-dashed border-white/12 p-5 text-center text-sm text-white/56">Žádné kusy neodpovídají filtru.</p> : null}
          </div>
        </AdminPanel>
      </div>
    </AdminPageShell>
  );
}

function StockItemRow({ area, batchId, item }: { area: AdminArea; batchId: string; item: AdminVoucherStockBatchDetailData["items"][number] }) {
  return (
    <article className="rounded-[1rem] border border-white/8 bg-white/[0.025] p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><span className="text-xs text-white/42">#{item.sequenceNumber}</span><span className="font-mono text-sm font-semibold tracking-[0.08em] text-white">{item.code}</span><AdminStatePill tone={itemStatusTone(item.status)}>{item.statusLabel}</AdminStatePill></div>
        <div className="flex flex-wrap gap-2">
          {item.status === VoucherStockItemStatus.AVAILABLE ? <Link href={item.activationHref} className={primaryButtonClassName}>Aktivovat</Link> : null}
          {item.voucherHref ? <Link href={item.voucherHref} className={secondaryButtonClassName}>Otevřít voucher</Link> : null}
        </div>
      </div>
      {item.status === VoucherStockItemStatus.PENDING_PRINT || item.status === VoucherStockItemStatus.AVAILABLE ? (
        <form action={voidVoucherStockItemAction} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <input type="hidden" name="area" value={area} /><input type="hidden" name="batchId" value={batchId} /><input type="hidden" name="stockItemId" value={item.id} />
          <label className="min-w-0 flex-1"><span className="text-[11px] uppercase tracking-[0.18em] text-white/42">Důvod znehodnocení</span><input name="reason" required minLength={3} placeholder="Vadný tisk, poškozený…" className={inputClassName} /></label>
          <button type="submit" className={secondaryButtonClassName}>Znehodnotit</button>
        </form>
      ) : item.voidReason ? <p className="mt-2 text-xs text-white/48">Důvod: {item.voidReason}</p> : null}
    </article>
  );
}

export function AdminVoucherActivationPage({ data }: { data: AdminVoucherActivationPageData }) {
  const [lookupState, lookupAction, lookupPending] = useActionState(lookupVoucherStockItemAction, data.initialStockItem ? { status: "found" as const, item: data.initialStockItem } : initialVoucherStockLookupState);
  const [activationState, activationAction, activationPending] = useActionState(activateVoucherStockItemAction, initialVoucherStockActivationState);
  const [code, setCode] = useState(data.defaultCode ?? "");
  const [type, setType] = useState<VoucherType>(VoucherType.VALUE);
  const [serviceId, setServiceId] = useState("");
  const [validFrom, setValidFrom] = useState(data.defaultValidFrom ?? "");
  const [validUntil, setValidUntil] = useState(data.defaultValidUntil ?? "");

  const selectedItem = lookupState.status === "found"
    ? lookupState.item ?? null
    : lookupState.status === "not_found"
      ? null
      : data.initialStockItem;

  if (activationState.status === "success" && activationState.voucherId && activationState.code) {
    return <ActivationSuccess area={data.area} state={{ voucherId: activationState.voucherId, code: activationState.code, type: activationState.type, originalValueCzk: activationState.originalValueCzk, serviceNameSnapshot: activationState.serviceNameSnapshot, servicePriceSnapshotCzk: activationState.servicePriceSnapshotCzk, validFrom: activationState.validFrom, validUntil: activationState.validUntil }} onNext={() => window.location.reload()} />;
  }

  const alreadyActivatedVoucherId = activationState.status === "already_activated" ? activationState.voucherId : selectedItem?.voucher?.id;
  const unavailableMessage = selectedItem?.status === VoucherStockItemStatus.VOID
    ? "Tento fyzický voucher je znehodnocený a nelze ho aktivovat."
    : selectedItem?.status === VoucherStockItemStatus.PENDING_PRINT
      ? "Série ještě nebyla převzatá. Po převzetí bude kus dostupný k aktivaci."
      : null;

  return (
    <AdminPageShell eyebrow="Dárkové vouchery" title="Aktivovat voucher" description="Předtištěný kus aktivujte až při fyzickém prodeji ve studiu." compact={data.area === "salon"}>
      <div className="space-y-4">
        <AdminVoucherTabs area={data.area} active="issued" />
        <AdminPanel title="Najít předtištěný kus" description="Na iPhonu můžete QR kód naskenovat přímo aplikací Fotoaparát. Aktivace probíhá podle kódu a vyžaduje ruční potvrzení prodeje." compact={data.area === "salon"} denseHeader>
            <form action={lookupAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1"><span className="text-xs uppercase tracking-[0.2em] text-white/50">Kód voucheru</span><input name="code" value={code ?? ""} onChange={(event) => setCode(event.target.value)} placeholder="PP-2026-XXXXXX" autoComplete="off" className={cn(inputClassName, "font-mono tracking-[0.08em]")} /></label>
            <button type="submit" disabled={lookupPending} className={primaryButtonClassName}>{lookupPending ? "Načítám…" : "Načíst voucher"}</button>
          </form>
          {lookupState.formError ? <ErrorBox>{lookupState.formError}</ErrorBox> : null}
        </AdminPanel>

        {selectedItem ? (
          <AdminPanel title="Předtištěný voucher" compact={data.area === "salon"} denseHeader>
            <div className="rounded-[1rem] border border-[var(--color-accent)]/25 bg-[rgba(190,160,120,0.07)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-mono text-lg font-semibold tracking-[0.08em] text-white">{selectedItem.code}</p><p className="mt-1 text-sm text-white/60">{selectedItem.batch.templateKey} · Série {selectedItem.batch.batchNumber}</p></div><AdminStatePill tone={itemStatusTone(selectedItem.status)}>{getVoucherStockItemStatusLabel(selectedItem.status)}</AdminStatePill></div>
              {alreadyActivatedVoucherId ? <div className="mt-4"><p className="text-sm font-semibold text-white">Tento voucher byl již aktivován.</p><Link href={data.area === "owner" ? `/admin/vouchery/${alreadyActivatedVoucherId}` : `/admin/provoz/vouchery/${alreadyActivatedVoucherId}`} className={cn(primaryButtonClassName, "mt-3")}>Otevřít voucher</Link></div> : unavailableMessage ? <p className="mt-4 text-sm text-white/72">{unavailableMessage}</p> : null}
            </div>
          </AdminPanel>
        ) : null}

        {selectedItem?.status === VoucherStockItemStatus.AVAILABLE && !alreadyActivatedVoucherId ? (
          <AdminPanel title="Údaje při prodeji" description="Tyto údaje se uloží do vzniklého standardního voucheru." compact={data.area === "salon"} denseHeader>
            <form action={activationAction} className="space-y-4" onSubmit={(event) => {
              const confirmed = window.confirm(`Potvrzujete prodej a aktivaci voucheru ${selectedItem.code}? Aktivací vznikne platný voucher a tuto akci už nebude možné vrátit.`);
              if (!confirmed) event.preventDefault();
            }}>
              <input type="hidden" name="area" value={data.area} /><input type="hidden" name="code" value={selectedItem.code ?? ""} /><input type="hidden" name="type" value={type ?? VoucherType.VALUE} />
              {activationState.formError ? <ErrorBox>{activationState.formError}</ErrorBox> : null}
              <div className="grid gap-2 sm:grid-cols-2"><TypeChoice active={type === VoucherType.VALUE} label="Hodnota" onClick={() => setType(VoucherType.VALUE)} /><TypeChoice active={type === VoucherType.SERVICE} label="Služba" onClick={() => setType(VoucherType.SERVICE)} /></div>
              {type === VoucherType.VALUE ? <label key="value" className="block"><span className="text-xs uppercase tracking-[0.2em] text-white/50">Hodnota v Kč</span><input name="originalValueCzk" type="number" min={1} step={1} required className={inputClassName} placeholder="1500" />{activationState.fieldErrors?.originalValueCzk ? <span className="mt-1 block text-sm text-red-300">{activationState.fieldErrors.originalValueCzk}</span> : null}</label> : <label key="service" className="block"><span className="text-xs uppercase tracking-[0.2em] text-white/50">Aktivní služba</span><input type="hidden" name="serviceId" value={serviceId ?? ""} /><select aria-label="Aktivní služba" value={serviceId} onChange={(event) => setServiceId(event.target.value)} className="mt-2 min-h-12 w-full rounded-[0.9rem] border border-white/10 bg-black/20 px-3 text-sm text-white sm:hidden"><option value="">Vyberte službu</option>{data.services.map((service) => <option key={service.id} value={service.id}>{service.publicName ?? service.name} · {service.category.name}</option>)}</select><div className="mt-2 hidden gap-2 sm:grid">{data.services.map((service) => <button key={service.id} type="button" onClick={() => setServiceId(service.id)} className={cn("rounded-[0.9rem] border p-3 text-left", service.id === serviceId ? "border-[var(--color-accent)]/60 bg-[rgba(190,160,120,0.13)]" : "border-white/8 bg-white/[0.02]")}><span className="block text-sm font-medium text-white">{service.publicName ?? service.name}</span><span className="mt-1 block text-xs text-white/48">{service.category.name} · {service.priceFromCzk === null ? "Cena na dotaz" : moneyFormatter.format(service.priceFromCzk)}</span></button>)}</div></label>}
              <div className="grid gap-3 sm:grid-cols-2"><label><span className="text-xs uppercase tracking-[0.2em] text-white/50">Platnost od</span><input name="validFrom" type="date" required value={validFrom ?? ""} onChange={(event) => setValidFrom(event.target.value)} className={inputClassName} /></label><label><span className="text-xs uppercase tracking-[0.2em] text-white/50">Platnost do</span><input name="validUntil" type="date" required value={validUntil ?? ""} onChange={(event) => setValidUntil(event.target.value)} className={inputClassName} /></label></div>
              <div className="rounded-[0.95rem] border border-amber-200/25 bg-amber-300/[0.08] px-3.5 py-3 text-sm leading-6 text-amber-50">Aktivací vznikne platný voucher. Zkontrolujte typ, hodnotu nebo službu a datum platnosti; aktivaci už nebude možné vrátit.</div>
              <button type="submit" disabled={activationPending} className={primaryButtonClassName}>{activationPending ? "Aktivuji…" : "Potvrdit prodej a aktivovat"}</button>
            </form>
          </AdminPanel>
        ) : null}
      </div>
    </AdminPageShell>
  );
}

function ActivationSuccess({ area, state, onNext }: { area: AdminArea; state: { voucherId: string; code: string; type?: VoucherType; originalValueCzk?: number | null; serviceNameSnapshot?: string | null; servicePriceSnapshotCzk?: number | null; validFrom?: Date; validUntil?: Date }; onNext: () => void }) {
  const isValueVoucher = state.type === VoucherType.VALUE;
  const soldLabel = isValueVoucher ? "HODNOTA VOUCHERU" : "SLUŽBA";
  const soldValue = isValueVoucher ? state.originalValueCzk : state.serviceNameSnapshot;
  const amountDue = isValueVoucher ? state.originalValueCzk : state.servicePriceSnapshotCzk;

  return (
    <AdminPageShell eyebrow="Aktivace dokončena" title="Voucher aktivován" description="Zkontrolujte údaje pro zákazníka a doplňte je na fyzický voucher." compact={area === "salon"}>
      <div className="max-w-xl rounded-[1.15rem] border border-emerald-300/25 bg-emerald-400/[0.08] p-4 sm:p-5">
        <dl className="grid gap-4">
          <div>
            <dt className="text-xs uppercase tracking-[0.16em] text-white/48">KÓD VOUCHERU</dt>
            <dd className="mt-1 break-all font-mono text-lg font-semibold tracking-[0.08em] text-white">{state.code}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.16em] text-white/48">{soldLabel}</dt>
            <dd className="mt-1 text-base font-semibold text-white">{isValueVoucher && typeof soldValue === "number" ? moneyFormatter.format(soldValue) : soldValue ?? "—"}</dd>
          </div>
          <div className="rounded-[0.95rem] border border-[var(--color-accent)]/45 bg-[rgba(190,160,120,0.13)] px-3.5 py-3">
            <dt className="text-xs uppercase tracking-[0.16em] text-white/65">K ÚHRADĚ</dt>
            <dd className="mt-1 font-display text-3xl leading-tight text-white">{typeof amountDue === "number" ? moneyFormatter.format(amountDue) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.16em] text-white/48">PLATNOST DO</dt>
            <dd className="mt-1 text-sm text-white">{state.validUntil ? dateFormatter.format(state.validUntil) : "—"}</dd>
          </div>
        </dl>

        <div className="mt-5 rounded-[0.95rem] border border-white/10 bg-black/10 px-3.5 py-3.5">
          <p className="text-sm font-semibold text-white">Na fyzický voucher doplňte:</p>
          <dl className="mt-3 grid gap-3">
            <div>
              <dt className="text-xs uppercase tracking-[0.16em] text-white/48">VĚNOVÁNO NA</dt>
              <dd className="mt-1 text-sm font-semibold text-white">{isValueVoucher && typeof soldValue === "number" ? moneyFormatter.format(soldValue) : soldValue ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.16em] text-white/48">PLATNOST DO</dt>
              <dd className="mt-1 text-sm font-semibold text-white">{state.validUntil ? dateFormatter.format(state.validUntil) : "—"}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={onNext} className={cn(primaryButtonClassName, "w-full sm:w-auto")}>Aktivovat další</button>
          <Link href={area === "owner" ? `/admin/vouchery/${state.voucherId}` : `/admin/provoz/vouchery/${state.voucherId}`} className={cn(secondaryButtonClassName, "w-full sm:w-auto")}>Otevřít voucher</Link>
        </div>
      </div>
    </AdminPageShell>
  );
}

function TypeChoice({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={cn("min-h-14 rounded-[0.95rem] border px-4 text-left text-sm font-semibold transition", active ? "border-[var(--color-accent)]/60 bg-[rgba(190,160,120,0.15)] text-white" : "border-white/10 bg-white/[0.03] text-white/65 hover:border-white/18")}>{label}</button>;
}

function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "accent" }) {
  return <article className={cn("rounded-[1rem] border px-3.5 py-3", tone === "accent" ? "border-[var(--color-accent)]/35 bg-[rgba(190,160,120,0.10)]" : "border-white/8 bg-white/[0.03]")}><p className="text-[10px] uppercase tracking-[0.16em] text-white/45">{label}</p><p className="mt-1 font-display text-2xl text-white">{value}</p></article>;
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[1rem] border border-red-300/20 bg-red-400/10 px-3.5 py-3 text-sm leading-6 text-red-50">{children}</div>;
}

const inputClassName = "mt-1 w-full rounded-[0.9rem] border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[var(--color-accent)]/60";
const primaryButtonClassName = "inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--color-accent)]/45 bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105 disabled:cursor-wait disabled:opacity-70";
const secondaryButtonClassName = "inline-flex min-h-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white";
