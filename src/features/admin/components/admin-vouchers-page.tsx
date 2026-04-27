import Link from "next/link";
import { type VoucherStatus, type VoucherType } from "@prisma/client";

import { type AdminArea } from "@/config/navigation";
import { AdminPageShell, AdminPanel } from "@/features/admin/components/admin-page-shell";
import { AdminStatePill } from "@/features/admin/components/admin-state-pill";
import {
  getAdminVouchersHref,
  getAdminVouchersPageData,
  type AdminVoucherFilters,
} from "@/features/admin/lib/admin-vouchers";
import { cn } from "@/lib/utils";

const formatDate = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

function formatDateLabel(value: Date | null | undefined) {
  if (!value) {
    return "Bez data";
  }

  return formatDate.format(value);
}

function formatValidityLabel(validFrom: Date, validUntil: Date | null) {
  return validUntil
    ? `${formatDateLabel(validFrom)} - ${formatDateLabel(validUntil)}`
    : `Od ${formatDateLabel(validFrom)}`;
}

function getVoucherStatusTone(status: VoucherStatus): "active" | "muted" | "accent" {
  switch (status) {
    case "ACTIVE":
    case "PARTIALLY_REDEEMED":
      return "active";
    case "REDEEMED":
    case "EXPIRED":
    case "CANCELLED":
      return "muted";
    case "DRAFT":
      return "accent";
  }
}

function getVoucherTypeShortLabel(type: VoucherType) {
  return type === "VALUE" ? "Hodnota" : "Služba";
}

export async function AdminVouchersPage({
  area,
  searchParams,
}: {
  area: AdminArea;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const data = await getAdminVouchersPageData(area, searchParams);
  const createHref = `${getAdminVouchersHref(area)}/novy`;

  return (
    <AdminPageShell
      eyebrow={area === "owner" ? "Dárkové vouchery" : "Provozní evidence"}
      title="Vouchery"
      description={
        area === "owner"
          ? "Přehled vydaných voucherů, zůstatků, platností a stavu čerpání bez destruktivních akcí."
          : "Rychlá kontrola kódu, platnosti a zbývající hodnoty voucheru pro běžný provoz."
      }
      stats={data.stats}
      compactStats
      compact={area === "salon"}
    >
      <AdminPanel
        title="Seznam voucherů"
        description="Hledání pracuje s kódem, obdarovaným, kupujícím i snapshotem služby."
        compact={area === "salon"}
        denseHeader
      >
        <AdminVouchersToolbar
          currentPath={data.currentPath}
          createHref={createHref}
          filters={data.filters}
        />

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[1rem] border border-white/8 bg-white/[0.035] px-4 py-3 text-sm text-white/64">
          <p><span className="text-white">V seznamu:</span> {data.vouchers.length}</p>
          <p><span className="text-white">Typ:</span> {typeFilterLabel(data.filters.type)}</p>
          <p><span className="text-white">Stav:</span> {statusFilterLabel(data.filters.status)}</p>
        </div>

        <div className="mt-4">
          <AdminVouchersList vouchers={data.vouchers} />
        </div>
      </AdminPanel>
    </AdminPageShell>
  );
}

function AdminVouchersToolbar({
  currentPath,
  createHref,
  filters,
}: {
  currentPath: string;
  createHref: string;
  filters: AdminVoucherFilters;
}) {
  return (
    <form
      action={currentPath}
      className="grid gap-3 rounded-[1.35rem] border border-white/8 bg-white/5 p-4 md:grid-cols-3 xl:grid-cols-[1.4fr_0.85fr_1fr_auto]"
    >
      <label className="block md:col-span-3 xl:col-span-1">
        <span className="text-xs uppercase tracking-[0.2em] text-white/50">Hledat</span>
        <input
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="Kód, obdarovaný nebo služba"
          className="mt-2 w-full rounded-[1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[var(--color-accent)]/60"
        />
      </label>

      <SelectField name="type" label="Typ" defaultValue={filters.type}>
        <option value="all" className="text-black">Všechny</option>
        <option value="value" className="text-black">Hodnotové</option>
        <option value="service" className="text-black">Služba</option>
      </SelectField>

      <SelectField name="status" label="Stav" defaultValue={filters.status}>
        <option value="all" className="text-black">Všechny</option>
        <option value="active" className="text-black">Aktivní</option>
        <option value="partially_redeemed" className="text-black">Částečně čerpané</option>
        <option value="redeemed" className="text-black">Uplatněné</option>
        <option value="expired" className="text-black">Propadlé</option>
        <option value="cancelled" className="text-black">Zrušené</option>
        <option value="draft" className="text-black">Rozpracované</option>
      </SelectField>

      <div className="flex flex-wrap items-end gap-3 md:col-span-3 xl:col-span-1">
        <button
          type="submit"
          className="rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105"
        >
          Filtrovat
        </button>
        <Link
          href={currentPath}
          className="rounded-full border border-white/10 px-5 py-3 text-sm text-white/80 transition hover:border-white/18 hover:bg-white/6"
        >
          Zrušit filtr
        </Link>
        <Link
          href={createHref}
          className="rounded-full border border-[var(--color-accent)]/45 bg-[rgba(190,160,120,0.12)] px-5 py-3 text-sm font-semibold text-[var(--color-accent-soft)] transition hover:border-[var(--color-accent)]/70 hover:bg-[rgba(190,160,120,0.18)]"
        >
          Nový voucher
        </Link>
      </div>
    </form>
  );
}

function SelectField({
  name,
  label,
  defaultValue,
  children,
}: {
  name: string;
  label: string;
  defaultValue: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.2em] text-white/50">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-[1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
      >
        {children}
      </select>
    </label>
  );
}

function AdminVouchersList({
  vouchers,
}: {
  vouchers: Awaited<ReturnType<typeof getAdminVouchersPageData>>["vouchers"];
}) {
  if (vouchers.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-white/14 bg-white/4 p-5">
        <p className="text-base font-medium text-white">Filtru zatím neodpovídá žádný voucher.</p>
        <p className="mt-2 text-sm leading-6 text-white/62">
          Zkuste upravit kód, typ nebo stav voucheru.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-white/8">
      <div className="hidden grid-cols-[1.15fr_0.7fr_1.35fr_0.7fr_0.8fr_1fr_0.9fr_0.8fr_auto] gap-3 border-b border-white/8 bg-white/[0.035] px-4 py-3 text-xs uppercase tracking-[0.18em] text-white/44 xl:grid">
        <span>Kód</span>
        <span>Typ</span>
        <span>Hodnota / služba</span>
        <span>Zbývá</span>
        <span>Stav</span>
        <span>Platnost</span>
        <span>Obdarovaný</span>
        <span>Vytvořeno</span>
        <span />
      </div>

      <div className="divide-y divide-white/8">
        {vouchers.map((voucher) => (
          <article
            key={voucher.id}
            className="grid gap-4 bg-white/[0.025] px-4 py-4 transition hover:bg-white/[0.045] xl:grid-cols-[1.15fr_0.7fr_1.35fr_0.7fr_0.8fr_1fr_0.9fr_0.8fr_auto] xl:items-center xl:gap-3"
          >
            <div className="min-w-0">
              <p className="font-mono text-base font-semibold tracking-[0.08em] text-white">
                {voucher.code}
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/42 xl:hidden">
                {getVoucherTypeShortLabel(voucher.type)}
              </p>
            </div>

            <p className="hidden text-sm text-white/70 xl:block">{getVoucherTypeShortLabel(voucher.type)}</p>

            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{voucher.valueLabel}</p>
              <p className="mt-1 text-xs text-white/42">{voucher._count.redemptions} čerpání</p>
            </div>

            <p className="text-sm text-white/74">
              <span className="text-white/42 xl:hidden">Zbývá: </span>
              {voucher.remainingLabel}
            </p>

            <AdminStatePill tone={getVoucherStatusTone(voucher.effectiveStatus)}>
              {voucher.statusLabel}
            </AdminStatePill>

            <p className="text-sm leading-5 text-white/66">
              <span className="text-white/42 xl:hidden">Platnost: </span>
              {formatValidityLabel(voucher.validFrom, voucher.validUntil)}
            </p>

            <p className="min-w-0 truncate text-sm text-white/70">
              <span className="text-white/42 xl:hidden">Obdarovaný: </span>
              {voucher.recipientName ?? "Neuvedeno"}
            </p>

            <p className="text-sm text-white/58">
              <span className="text-white/42 xl:hidden">Vytvořeno: </span>
              {formatDateLabel(voucher.createdAt)}
            </p>

            <Link
              href={voucher.detailHref}
              className={cn(
                "inline-flex justify-center rounded-full border border-white/10 px-4 py-2 text-sm text-white/80 transition hover:border-white/18 hover:bg-white/6",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/60",
              )}
            >
              Detail
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}

function typeFilterLabel(type: AdminVoucherFilters["type"]) {
  switch (type) {
    case "value":
      return "hodnotové";
    case "service":
      return "služba";
    case "all":
      return "všechny";
  }
}

function statusFilterLabel(status: AdminVoucherFilters["status"]) {
  switch (status) {
    case "active":
      return "aktivní";
    case "partially_redeemed":
      return "částečně čerpané";
    case "redeemed":
      return "uplatněné";
    case "expired":
      return "propadlé";
    case "cancelled":
      return "zrušené";
    case "draft":
      return "rozpracované";
    case "all":
      return "všechny";
  }
}
