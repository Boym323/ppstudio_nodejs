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
const formatMoney = new Intl.NumberFormat("cs-CZ", {
  maximumFractionDigits: 0,
  style: "currency",
  currency: "CZK",
});

type AdminVoucherListItem = Awaited<ReturnType<typeof getAdminVouchersPageData>>["vouchers"][number];
type AdminVoucherStats = Awaited<ReturnType<typeof getAdminVouchersPageData>>["stats"];

function formatDateLabel(value: Date | null | undefined) {
  if (!value) {
    return "Bez data";
  }

  return formatDate.format(value);
}

function formatValidityLabel(validUntil: Date | null) {
  return validUntil ? `do ${formatDateLabel(validUntil)}` : "Bez omezení";
}

function getVoucherStatusTone(status: VoucherStatus): "active" | "muted" | "accent" | "warning" {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "PARTIALLY_REDEEMED":
      return "accent";
    case "EXPIRED":
      return "warning";
    case "REDEEMED":
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
  if (count === 0) {
    return "Bez čerpání";
  }

  if (count === 1) {
    return "1 čerpání";
  }

  if (count >= 2 && count <= 4) {
    return `${count} čerpání`;
  }

  return `${count} čerpání`;
}

function getVoucherPrimaryLabel(voucher: AdminVoucherListItem) {
  if (voucher.type === "SERVICE") {
    return voucher.serviceNameSnapshot ?? "Služba bez snapshotu";
  }

  return voucher.valueLabel;
}

function getVoucherSecondaryLabel(voucher: AdminVoucherListItem) {
  if (voucher.type === "SERVICE") {
    return voucher.servicePriceSnapshotCzk === null
      ? "Cena služby neuvedena"
      : formatMoney.format(voucher.servicePriceSnapshotCzk);
  }

  return "Hodnotový voucher";
}

function hasActiveFilters(filters: AdminVoucherFilters) {
  return filters.q.length > 0 || filters.type !== "all" || filters.status !== "all";
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
      eyebrow="Dárkové vouchery"
      title="Vouchery"
      description="Přehled vydaných voucherů, zůstatků a platností."
      headerActions={
        <Link
          href={createHref}
          className={cn(
            "inline-flex items-center justify-center rounded-full border border-[var(--color-accent)]/45",
            "bg-[rgba(190,160,120,0.12)] px-4 py-2 text-sm font-semibold text-[var(--color-accent-soft)]",
            "transition hover:border-[var(--color-accent)]/70 hover:bg-[rgba(190,160,120,0.18)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/60",
          )}
        >
          Nový voucher
        </Link>
      }
      compact={area === "salon"}
      denseIntro
    >
      <div className="flex flex-col gap-3.5">
        <AdminVoucherStatsStrip stats={data.stats} />

        <AdminPanel
          title={`Seznam voucherů · ${data.vouchers.length} záznamů`}
          compact
          denseHeader
        >
          <div className="flex flex-col gap-3">
            <AdminVouchersToolbar currentPath={data.currentPath} filters={data.filters} />

            {hasActiveFilters(data.filters) ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/52">
                <p>
                  Typ: <span className="text-white/76">{typeFilterLabel(data.filters.type)}</span>
                </p>
                <p>
                  Stav: <span className="text-white/76">{statusFilterLabel(data.filters.status)}</span>
                </p>
              </div>
            ) : null}

            <AdminVouchersList
              vouchers={data.vouchers}
              currentPath={data.currentPath}
              filters={data.filters}
              createHref={createHref}
            />
          </div>
        </AdminPanel>
      </div>
    </AdminPageShell>
  );
}

function AdminVoucherStatsStrip({ stats }: { stats: AdminVoucherStats }) {
  return (
    <section className="rounded-[1.05rem] border border-white/10 bg-black/12 px-2.5 py-2 sm:px-3 sm:py-2.5">
      <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, index) => (
          <article
            key={stat.label}
            className={cn(
              "min-w-0 rounded-[0.8rem] px-2.5 py-1.5 sm:px-3",
              stat.tone === "warning"
                ? "bg-rose-400/[0.06]"
                : stat.tone === "accent"
                  ? "bg-[rgba(190,160,120,0.08)]"
                  : undefined,
              index > 0 ? "border-t border-white/8 sm:border-l sm:border-t-0" : "",
            )}
          >
            <p className="truncate text-[10px] font-medium uppercase tracking-[0.14em] text-white/42">
              {stat.label}
            </p>
            <p className="mt-1 whitespace-nowrap font-display text-[1.32rem] leading-none text-white sm:text-[1.5rem]">
              {stat.value}
            </p>
            {stat.detail ? <p className="mt-1 truncate text-[10px] text-white/42">{stat.detail}</p> : null}
          </article>
        ))}
      </div>
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
    <form
      action={currentPath}
      className="rounded-[1rem] border border-white/8 bg-white/[0.04] px-3 py-2.5 sm:px-3.5 sm:py-2.5"
    >
      <div className="flex flex-col gap-2.5 xl:flex-row xl:items-end">
        <label className="block xl:min-w-0 xl:flex-[1.45]">
          <span className="text-[11px] uppercase tracking-[0.18em] text-white/46">Hledat</span>
          <input
            type="search"
            name="q"
            defaultValue={filters.q}
            placeholder="Kód, kupující nebo služba"
            className={cn(
              "mt-1 w-full rounded-[0.9rem] border border-white/10 bg-black/20 px-3 py-2.25",
              "text-sm text-white outline-none transition placeholder:text-white/28",
              "focus:border-[var(--color-accent)]/60",
            )}
          />
        </label>

        <SelectField name="type" label="Typ" defaultValue={filters.type} className="xl:w-[10rem]">
          <option value="all" className="text-black">
            Vše
          </option>
          <option value="value" className="text-black">
            Hodnota
          </option>
          <option value="service" className="text-black">
            Služba
          </option>
        </SelectField>

        <SelectField name="status" label="Stav" defaultValue={filters.status} className="xl:w-[12rem]">
          <option value="all" className="text-black">
            Vše
          </option>
          <option value="active" className="text-black">
            Aktivní
          </option>
          <option value="partially_redeemed" className="text-black">
            Částečně čerpaný
          </option>
          <option value="redeemed" className="text-black">
            Uplatněný
          </option>
          <option value="expired" className="text-black">
            Propadlý
          </option>
          <option value="cancelled" className="text-black">
            Zrušený
          </option>
          <option value="draft" className="text-black">
            Rozpracovaný
          </option>
        </SelectField>

        <div className="flex flex-col gap-2 sm:flex-row xl:ml-auto xl:shrink-0">
          <button
            type="submit"
            className={cn(
              "inline-flex items-center justify-center rounded-full bg-[var(--color-accent)] px-4 py-2.5",
              "text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105",
            )}
          >
            Filtrovat
          </button>
          <Link
            href={currentPath}
            className={cn(
              "inline-flex items-center justify-center rounded-full border border-white/10 px-4 py-2.5",
              "text-sm text-white/80 transition hover:border-white/18 hover:bg-white/6",
            )}
          >
            Zrušit
          </Link>
        </div>
      </div>
    </form>
  );
}

function SelectField({
  name,
  label,
  defaultValue,
  className,
  children,
}: {
  name: string;
  label: string;
  defaultValue: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="text-[11px] uppercase tracking-[0.18em] text-white/46">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className={cn(
          "mt-1 w-full rounded-[0.9rem] border border-white/10 bg-black/20 px-3 py-2.25",
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
  currentPath,
  filters,
  createHref,
}: {
  vouchers: Awaited<ReturnType<typeof getAdminVouchersPageData>>["vouchers"];
  currentPath: string;
  filters: AdminVoucherFilters;
  createHref: string;
}) {
  if (vouchers.length === 0) {
    const filtered = hasActiveFilters(filters);

    return (
      <div className="rounded-[1.15rem] border border-dashed border-white/14 bg-white/[0.03] px-5 py-6 text-center">
        <p className="text-base font-medium text-white">Nenalezeny žádné vouchery.</p>
        <p className="mt-2 text-sm text-white/58">
          {filtered ? "Zkuste upravit nebo zrušit filtr." : "Vytvořte první voucher pro další práci."}
        </p>
        <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
          {filtered ? (
            <Link
              href={currentPath}
              className="inline-flex items-center justify-center rounded-full border border-white/10 px-4 py-2.5 text-sm text-white/80 transition hover:border-white/18 hover:bg-white/6"
            >
              Zrušit filtr
            </Link>
          ) : null}
          <Link
            href={createHref}
            className="inline-flex items-center justify-center rounded-full border border-[var(--color-accent)]/45 bg-[rgba(190,160,120,0.12)] px-4 py-2.5 text-sm font-semibold text-[var(--color-accent-soft)] transition hover:border-[var(--color-accent)]/70 hover:bg-[rgba(190,160,120,0.18)]"
          >
            Nový voucher
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="grid gap-3 lg:hidden">
        {vouchers.map((voucher) => (
          <VoucherCard key={voucher.id} voucher={voucher} />
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-[1.15rem] border border-white/8 bg-white/[0.02] lg:block">
        <table className="min-w-full table-fixed border-collapse">
          <thead className="bg-white/[0.04]">
            <tr className="text-left text-[11px] uppercase tracking-[0.16em] text-white/42">
              <th className="w-[12rem] px-4 py-2.5 font-medium">Kód</th>
              <th className="w-[6.25rem] px-3 py-2.5 font-medium">Typ</th>
              <th className="w-[32%] px-3 py-2.5 font-medium">Voucher</th>
              <th className="w-[9.5rem] px-3 py-2.5 font-medium">Čerpání / zůstatek</th>
              <th className="w-[10.5rem] px-3 py-2.5 font-medium">Stav</th>
              <th className="w-[8.75rem] px-3 py-2.5 font-medium">Platnost</th>
              <th className="w-[6rem] px-4 py-2.5 text-right font-medium">Akce</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8">
            {vouchers.map((voucher) => (
              <tr key={voucher.id} className="align-middle transition hover:bg-white/[0.04]">
                <td className="px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[14px] font-semibold tracking-[0.08em] text-white">
                      {voucher.code}
                    </p>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <span className="inline-flex rounded-full border border-white/10 bg-black/12 px-2.5 py-0.5 text-[11px] text-white/72">
                    {getVoucherTypeShortLabel(voucher.type)}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-medium leading-5 text-white">
                      {getVoucherPrimaryLabel(voucher)}
                    </p>
                    <p className="truncate text-[11px] text-white/48">{getVoucherSecondaryLabel(voucher)}</p>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="whitespace-nowrap text-sm font-semibold tabular-nums text-white/92">
                      {voucher.remainingLabel}
                    </p>
                    <p className="truncate text-[11px] text-white/48">
                      {formatRedemptionsLabel(voucher._count.redemptions)}
                    </p>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <AdminStatePill
                    tone={getVoucherStatusTone(voucher.effectiveStatus)}
                    className="whitespace-nowrap px-2.5 py-0.5 text-[11px]"
                  >
                    {voucher.statusLabel}
                  </AdminStatePill>
                </td>
                <td className="px-3 py-2.5">
                  <p className="whitespace-nowrap text-sm leading-5 text-white/66">
                    {formatValidityLabel(voucher.validUntil)}
                  </p>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <Link
                    href={voucher.detailHref}
                    className={cn(
                      "inline-flex items-center justify-center rounded-full border border-white/8 px-2.5 py-1.5",
                      "text-xs font-medium text-white/72 transition hover:border-white/16 hover:bg-white/6 hover:text-white/86",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/60",
                    )}
                  >
                    Detail
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VoucherCard({ voucher }: { voucher: AdminVoucherListItem }) {
  return (
    <article className="rounded-[1.1rem] border border-white/8 bg-white/[0.025] p-4 transition hover:bg-white/[0.045]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-[15px] font-semibold tracking-[0.08em] text-white">
            {voucher.code}
          </p>
          <p className="mt-1 text-xs text-white/48">{getVoucherTypeShortLabel(voucher.type)}</p>
        </div>

        <AdminStatePill
          tone={getVoucherStatusTone(voucher.effectiveStatus)}
          className="whitespace-nowrap px-2.5 py-1"
        >
          {voucher.statusLabel}
        </AdminStatePill>
      </div>

      <div className="mt-3 space-y-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Voucher</p>
          <p className="mt-1 text-sm font-medium text-white">{getVoucherPrimaryLabel(voucher)}</p>
          <p className="text-xs text-white/48">{getVoucherSecondaryLabel(voucher)}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Čerpání / zůstatek</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-white/92">{voucher.remainingLabel}</p>
            <p className="text-xs text-white/48">{formatRedemptionsLabel(voucher._count.redemptions)}</p>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">Platnost</p>
            <p className="mt-1 text-sm text-white/68">{formatValidityLabel(voucher.validUntil)}</p>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <Link
          href={voucher.detailHref}
          className={cn(
            "inline-flex w-full items-center justify-center rounded-full border border-white/10 px-4 py-2.5",
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
      return "hodnota";
    case "service":
      return "služba";
    case "all":
      return "vše";
  }
}

function statusFilterLabel(status: AdminVoucherFilters["status"]) {
  switch (status) {
    case "active":
      return "aktivní";
    case "partially_redeemed":
      return "částečně čerpaný";
    case "redeemed":
      return "uplatněný";
    case "expired":
      return "propadlý";
    case "cancelled":
      return "zrušený";
    case "draft":
      return "rozpracovaný";
    case "all":
      return "vše";
  }
}
