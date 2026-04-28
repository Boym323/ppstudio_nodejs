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

type AdminVoucherListItem = Awaited<ReturnType<typeof getAdminVouchersPageData>>["vouchers"][number];
type AdminVoucherStats = Awaited<ReturnType<typeof getAdminVouchersPageData>>["stats"];

const voucherTableGridClass =
  "grid-cols-[minmax(10rem,1.05fr)_6.25rem_minmax(0,1.4fr)_6rem_7.25rem_minmax(0,0.95fr)_auto]";

function formatDateLabel(value: Date | null | undefined) {
  if (!value) {
    return "Bez data";
  }

  return formatDate.format(value);
}

function formatValidityLabel(validUntil: Date | null) {
  return validUntil ? `do ${formatDateLabel(validUntil)}` : "Bez omezení";
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

function formatRedemptionsLabel(count: number) {
  return `${count} čerpání`;
}

function getVoucherValueLabel(voucher: AdminVoucherListItem) {
  return voucher.valueLabel;
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
      compact={area === "salon"}
    >
      <AdminVoucherStatsStrip stats={data.stats} />

      <AdminPanel
        title="Seznam voucherů"
        description="Hledání pracuje s kódem, obdarovaným, kupujícím i snapshotem služby."
        compact={area === "salon"}
        denseHeader
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-white/62">
            <span className="text-white">V seznamu:</span> {data.vouchers.length}
          </p>
          <Link
            href={createHref}
            className={cn(
              "inline-flex items-center justify-center rounded-full border border-[var(--color-accent)]/45",
              "bg-[rgba(190,160,120,0.12)] px-5 py-3 text-sm font-semibold text-[var(--color-accent-soft)]",
              "transition hover:border-[var(--color-accent)]/70 hover:bg-[rgba(190,160,120,0.18)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/60",
            )}
          >
            Nový voucher
          </Link>
        </div>

        <AdminVouchersToolbar
          currentPath={data.currentPath}
          filters={data.filters}
        />

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/64">
          <p>
            <span className="text-white">Typ:</span> {typeFilterLabel(data.filters.type)}
          </p>
          <p>
            <span className="text-white">Stav:</span> {statusFilterLabel(data.filters.status)}
          </p>
        </div>

        <div className="mt-5">
          <AdminVouchersList vouchers={data.vouchers} />
        </div>
      </AdminPanel>
    </AdminPageShell>
  );
}

function AdminVoucherStatsStrip({ stats }: { stats: AdminVoucherStats }) {
  return (
    <section className="grid gap-2 rounded-[1.1rem] border border-white/10 bg-black/10 p-2 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <article
          key={stat.label}
          className={cn(
            "min-w-0 rounded-[0.85rem] border px-3 py-2.5",
            stat.tone === "accent"
              ? "border-[var(--color-accent)]/35 bg-[rgba(190,160,120,0.1)]"
              : stat.tone === "muted"
                ? "border-white/8 bg-white/[0.035]"
                : "border-white/8 bg-white/[0.025]",
          )}
        >
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate text-[11px] uppercase tracking-[0.18em] text-white/52">
              {stat.label}
            </p>
            <p className="shrink-0 font-display text-2xl leading-none text-white">{stat.value}</p>
          </div>
          {stat.detail ? (
            <p className="mt-1 truncate text-xs leading-4 text-white/56">{stat.detail}</p>
          ) : null}
        </article>
      ))}
    </section>
  );
}

function AdminVouchersToolbar({
  currentPath,
  filters,
}: {
  currentPath: string;
  filters: AdminVoucherFilters;
}) {
  return (
    <form action={currentPath} className="rounded-[1.35rem] border border-white/8 bg-white/5 p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,0.95fr)]">
        <label className="block">
          <span className="text-xs uppercase tracking-[0.2em] text-white/50">Hledat</span>
          <input
            type="search"
            name="q"
            defaultValue={filters.q}
            placeholder="Kód, obdarovaný nebo služba"
            className={cn(
              "mt-2 w-full rounded-[1rem] border border-white/10 bg-black/20 px-4 py-3",
              "text-sm text-white outline-none transition placeholder:text-white/30",
              "focus:border-[var(--color-accent)]/60",
            )}
          />
        </label>

        <SelectField name="type" label="Typ" defaultValue={filters.type}>
          <option value="all" className="text-black">
            Všechny
          </option>
          <option value="value" className="text-black">
            Hodnotové
          </option>
          <option value="service" className="text-black">
            Služba
          </option>
        </SelectField>

        <SelectField name="status" label="Stav" defaultValue={filters.status}>
          <option value="all" className="text-black">
            Všechny
          </option>
          <option value="active" className="text-black">
            Aktivní
          </option>
          <option value="partially_redeemed" className="text-black">
            Částečně čerpané
          </option>
          <option value="redeemed" className="text-black">
            Uplatněné
          </option>
          <option value="expired" className="text-black">
            Propadlé
          </option>
          <option value="cancelled" className="text-black">
            Zrušené
          </option>
          <option value="draft" className="text-black">
            Rozpracované
          </option>
        </SelectField>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
        <button
          type="submit"
          className={cn(
            "inline-flex w-full items-center justify-center rounded-full bg-[var(--color-accent)] px-5 py-3",
            "text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105",
            "sm:w-auto",
          )}
        >
          Filtrovat
        </button>
        <Link
          href={currentPath}
          className={cn(
            "inline-flex w-full items-center justify-center rounded-full border border-white/10 px-5 py-3",
            "text-sm text-white/80 transition hover:border-white/18 hover:bg-white/6",
            "sm:w-auto",
          )}
        >
          Zrušit filtr
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
        className={cn(
          "mt-2 w-full rounded-[1rem] border border-white/10 bg-black/20 px-4 py-3",
          "text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60",
        )}
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
    <div>
      <div className="grid gap-3 lg:hidden">
        {vouchers.map((voucher) => (
          <VoucherCard key={voucher.id} voucher={voucher} />
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-[1.25rem] border border-white/8 lg:block">
        <div
          className={cn(
            "grid gap-3 border-b border-white/8 bg-white/[0.035] px-4 py-3",
            "text-xs uppercase tracking-[0.18em] text-white/44",
            voucherTableGridClass,
          )}
        >
          <span>Kód</span>
          <span>Typ</span>
          <span>Hodnota / služba</span>
          <span>Zbývá</span>
          <span>Stav</span>
          <span>Platnost</span>
          <span />
        </div>

        <div className="divide-y divide-white/8">
          {vouchers.map((voucher) => (
            <article
              key={voucher.id}
              className={cn(
                "grid",
                voucherTableGridClass,
                "gap-3 bg-white/[0.025] px-4 py-4 transition hover:bg-white/[0.045]",
                "items-center",
              )}
            >
              <div className="min-w-0">
                <p className="font-mono text-base font-semibold tracking-[0.08em] text-white">
                  {voucher.code}
                </p>
              </div>

              <p className="whitespace-nowrap text-sm text-white/70">{getVoucherTypeShortLabel(voucher.type)}</p>

              <div className="min-w-0">
                <p className="break-words text-sm font-medium leading-6 text-white">
                  {getVoucherValueLabel(voucher)}
                </p>
                <p className="mt-1 text-xs text-white/42">{formatRedemptionsLabel(voucher._count.redemptions)}</p>
              </div>

              <p className="whitespace-nowrap text-sm font-semibold tabular-nums text-white/94">
                {voucher.remainingLabel}
              </p>

              <AdminStatePill tone={getVoucherStatusTone(voucher.effectiveStatus)}>
                {voucher.statusLabel}
              </AdminStatePill>

              <p className="whitespace-nowrap text-sm leading-5 text-white/66">
                {formatValidityLabel(voucher.validUntil)}
              </p>

              <Link
                href={voucher.detailHref}
                className={cn(
                  "inline-flex justify-center rounded-full border border-white/10 px-4 py-2",
                  "text-sm text-white/80 transition hover:border-white/18 hover:bg-white/6",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/60",
                )}
              >
                Detail
              </Link>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function VoucherCard({ voucher }: { voucher: AdminVoucherListItem }) {
  return (
    <article className="rounded-[1.25rem] border border-white/8 bg-white/[0.025] p-4 transition hover:bg-white/[0.045]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-base font-semibold tracking-[0.08em] text-white">{voucher.code}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/42">
            {getVoucherTypeShortLabel(voucher.type)}
          </p>
        </div>

        <AdminStatePill tone={getVoucherStatusTone(voucher.effectiveStatus)}>
          {voucher.statusLabel}
        </AdminStatePill>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase tracking-[0.18em] text-white/44">Hodnota / služba</dt>
          <dd className="mt-1 break-words text-sm font-medium leading-6 text-white">
            {getVoucherValueLabel(voucher)}
          </dd>
          <p className="mt-1 text-xs text-white/42">{formatRedemptionsLabel(voucher._count.redemptions)}</p>
        </div>

        <div>
          <dt className="text-xs uppercase tracking-[0.18em] text-white/44">Zbývá</dt>
          <dd className="mt-1 text-base font-semibold tabular-nums text-white/94">{voucher.remainingLabel}</dd>
        </div>

        <div>
          <dt className="text-xs uppercase tracking-[0.18em] text-white/44">Platnost</dt>
          <dd className="mt-1 text-sm leading-6 text-white/68">
            {formatValidityLabel(voucher.validUntil)}
          </dd>
        </div>

        <div>
          <dt className="text-xs uppercase tracking-[0.18em] text-white/44">Typ</dt>
          <dd className="mt-1 text-sm text-white/78">{getVoucherTypeShortLabel(voucher.type)}</dd>
        </div>

      </dl>

      <div className="mt-4">
        <Link
          href={voucher.detailHref}
          className={cn(
            "inline-flex w-full items-center justify-center rounded-full border border-white/10 px-4 py-2",
            "text-sm text-white/80 transition hover:border-white/18 hover:bg-white/6",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/60",
          )}
        >
          Detail
        </Link>
      </div>
    </article>
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
