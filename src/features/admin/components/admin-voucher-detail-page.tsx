import Link from "next/link";
import { VoucherStatus, VoucherType } from "@prisma/client";

import { AdminPageShell, AdminPanel } from "@/features/admin/components/admin-page-shell";
import { AdminStatePill } from "@/features/admin/components/admin-state-pill";
import { type AdminVoucherDetailData } from "@/features/admin/lib/admin-vouchers";
import { cn } from "@/lib/utils";

const dateFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const czkFormatter = new Intl.NumberFormat("cs-CZ", {
  maximumFractionDigits: 0,
  style: "currency",
  currency: "CZK",
});

type DetailRowTone = "default" | "muted";

export function AdminVoucherDetailPage({ data }: { data: AdminVoucherDetailData }) {
  const redeemedValueCzk =
    data.type === VoucherType.VALUE
      ? Math.max((data.originalValueCzk ?? 0) - (data.remainingValueCzk ?? 0), 0)
      : null;
  const redeemedPercent =
    data.type === VoucherType.VALUE && data.originalValueCzk && data.originalValueCzk > 0
      ? Math.min(Math.round(((data.originalValueCzk - (data.remainingValueCzk ?? 0)) / data.originalValueCzk) * 100), 100)
      : null;

  return (
    <AdminPageShell
      eyebrow={data.area === "owner" ? "Detail voucheru" : "Provozní detail voucheru"}
      title={data.code}
      description="Read-only detail voucheru pro kontrolu stavu, platnosti, kupujícího a historie čerpání. Úpravy, zrušení, PDF i uplatnění zatím nejsou součástí obrazovky."
      stats={[
        {
          label: "Typ",
          value: data.typeLabel,
          detail: data.valueLabel,
        },
        {
          label: "Efektivní stav",
          value: data.statusLabel,
          tone: getVoucherStatusStatTone(data.effectiveStatus),
          detail: "Zohledňuje i aplikační expiraci podle data platnosti.",
        },
        {
          label: data.type === VoucherType.VALUE ? "Zbývá" : "Služba",
          value: data.remainingLabel,
          detail: data.type === VoucherType.VALUE ? "Aktuální zůstatek hodnotového voucheru." : data.serviceNameSnapshot ?? "Snapshot služby není vyplněný.",
        },
        {
          label: "Čerpání",
          value: String(data.redemptions.length),
          tone: data.redemptions.length > 0 ? "accent" : "muted",
          detail: data.redemptions.length === 1 ? "Jedno zaznamenané uplatnění." : "Počet zaznamenaných uplatnění.",
        },
      ]}
      compact={data.area === "salon"}
      compactStats
    >
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={data.listHref}
          className="rounded-full border border-white/10 px-4 py-3 text-sm text-white/78 transition hover:border-white/30 hover:text-white"
        >
          Zpět na seznam
        </Link>
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-full border border-white/8 bg-white/5 px-4 py-3 text-sm text-white/38"
        >
          Stáhnout PDF
        </button>
      </div>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[var(--radius-panel)] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03))] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <AdminStatePill tone={getVoucherStatusPillTone(data.effectiveStatus)}>
                {data.statusLabel}
              </AdminStatePill>
              <p className="mt-4 font-mono text-3xl font-semibold tracking-[0.14em] text-white sm:text-4xl">
                {data.code}
              </p>
              <p className="mt-3 text-sm leading-7 text-white/70">
                {data.typeLabel} s platností {formatDateLabel(data.validFrom)} až {formatDateLabel(data.validUntil)}.
              </p>
            </div>

            <div className="min-w-[13rem] rounded-[1.2rem] border border-white/10 bg-black/18 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-white/48">Hodnota / služba</p>
              <p className="mt-3 text-base font-medium text-white">{data.valueLabel}</p>
              <p className="mt-2 text-sm leading-6 text-white/58">{data.remainingLabel}</p>
            </div>
          </div>
        </div>

        <AdminPanel
          title="Přehled"
          description="Základní údaje pro provozní kontrolu voucheru."
          compact={data.area === "salon"}
          denseHeader
        >
          <dl className="grid gap-3 sm:grid-cols-2">
            <DetailRow label="Typ" value={data.typeLabel} />
            <DetailRow label="Stav" value={data.statusLabel} />
            <DetailRow label="Platnost od" value={formatDateLabel(data.validFrom)} />
            <DetailRow label="Platnost do" value={formatDateLabel(data.validUntil)} />
            <DetailRow label="Vystaveno" value={formatDateTimeLabel(data.issuedAt)} />
            <DetailRow label="Vytvořeno" value={formatDateTimeLabel(data.createdAt)} />
            <DetailRow
              label="Vytvořil"
              value={formatUserLabel(data.createdByUser)}
              tone={data.createdByUser ? "default" : "muted"}
            />
          </dl>
        </AdminPanel>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <AdminPanel
          title="Kupující / obdarovaný"
          description="Údaje z vystavení voucheru. Chybějící hodnoty zůstávají záměrně jemné."
          compact={data.area === "salon"}
        >
          <dl className="grid gap-3 sm:grid-cols-2">
            <DetailRow label="Kupující" value={formatOptional(data.purchaserName)} tone={data.purchaserName ? "default" : "muted"} />
            <DetailRow label="E-mail kupujícího" value={formatOptional(data.purchaserEmail)} tone={data.purchaserEmail ? "default" : "muted"} />
            <DetailRow label="Obdarovaný" value={formatOptional(data.recipientName)} tone={data.recipientName ? "default" : "muted"} />
            <DetailRow label="Věnování" value={formatOptional(data.message)} tone={data.message ? "default" : "muted"} />
          </dl>
        </AdminPanel>

        <AdminPanel
          title={data.type === VoucherType.VALUE ? "Hodnota" : "Služba"}
          description={data.type === VoucherType.VALUE ? "Finanční přehled čerpání hodnotového voucheru." : "Snapshot služby v okamžiku vystavení voucheru."}
          compact={data.area === "salon"}
        >
          {data.type === VoucherType.VALUE ? (
            <ValueSummary
              originalValueCzk={data.originalValueCzk}
              remainingValueCzk={data.remainingValueCzk}
              redeemedValueCzk={redeemedValueCzk}
              redeemedPercent={redeemedPercent}
            />
          ) : (
            <ServiceSummary data={data} />
          )}
        </AdminPanel>

        <AdminPanel
          title="Historie uplatnění"
          description="Zaznamenaná čerpání voucheru bez možnosti nového uplatnění z této obrazovky."
          compact={data.area === "salon"}
        >
          <RedemptionsList redemptions={data.redemptions} />
        </AdminPanel>

        <AdminPanel
          title="Interní poznámka"
          description="Interní poznámka je určena jen pro administraci a nesmí se propisovat do veřejného PDF ani veřejného ověření voucheru."
          compact={data.area === "salon"}
        >
          <div className="rounded-[1.25rem] border border-white/8 bg-white/5 p-4">
            <p className={cn("whitespace-pre-wrap text-sm leading-6", data.internalNote ? "text-white/82" : "text-white/42")}>
              {formatOptional(data.internalNote)}
            </p>
          </div>
        </AdminPanel>
      </div>
    </AdminPageShell>
  );
}

function ValueSummary({
  originalValueCzk,
  remainingValueCzk,
  redeemedValueCzk,
  redeemedPercent,
}: {
  originalValueCzk: number | null;
  remainingValueCzk: number | null;
  redeemedValueCzk: number | null;
  redeemedPercent: number | null;
}) {
  return (
    <div className="grid gap-4">
      <dl className="grid gap-3 sm:grid-cols-3">
        <DetailRow label="Původní hodnota" value={formatCzk(originalValueCzk)} tone={originalValueCzk === null ? "muted" : "default"} />
        <DetailRow label="Zbývající hodnota" value={formatCzk(remainingValueCzk)} tone={remainingValueCzk === null ? "muted" : "default"} />
        <DetailRow label="Vyčerpáno" value={formatCzk(redeemedValueCzk)} />
      </dl>
      <div className="rounded-[1.25rem] border border-white/8 bg-white/5 p-4">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-white/58">Čerpání</span>
          <span className="font-medium text-white">{redeemedPercent === null ? "Nelze spočítat" : `${redeemedPercent} %`}</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[var(--color-accent)]"
            style={{ width: `${redeemedPercent ?? 0}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function ServiceSummary({ data }: { data: AdminVoucherDetailData }) {
  const linkedServiceName = data.service
    ? data.service.publicName ?? data.service.name
    : null;

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      <DetailRow label="Služba při vystavení" value={formatOptional(data.serviceNameSnapshot)} tone={data.serviceNameSnapshot ? "default" : "muted"} />
      <DetailRow label="Cena při vystavení" value={formatCzk(data.servicePriceSnapshotCzk)} tone={data.servicePriceSnapshotCzk === null ? "muted" : "default"} />
      <DetailRow label="Délka při vystavení" value={formatDuration(data.serviceDurationSnapshot)} tone={data.serviceDurationSnapshot === null ? "muted" : "default"} />
      <DetailRow label="Aktuální služba" value={formatOptional(linkedServiceName)} tone={linkedServiceName ? "default" : "muted"} />
    </dl>
  );
}

function RedemptionsList({
  redemptions,
}: {
  redemptions: AdminVoucherDetailData["redemptions"];
}) {
  if (redemptions.length === 0) {
    return (
      <div className="rounded-[1.25rem] border border-dashed border-white/14 bg-white/4 p-5">
        <p className="text-sm leading-6 text-white/68">Voucher zatím nebyl uplatněn.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {redemptions.map((redemption) => (
        <article key={redemption.id} className="rounded-[1.25rem] border border-white/8 bg-white/5 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-base font-medium text-white">{formatDateTimeLabel(redemption.redeemedAt)}</p>
              <p className="mt-1 text-sm leading-6 text-white/58">
                {formatCzk(redemption.amountCzk)} • {formatOptional(redemption.serviceNameSnapshot)}
              </p>
            </div>
            {redemption.bookingHref ? (
              <Link
                href={redemption.bookingHref}
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-white/70 transition hover:border-white/20 hover:text-white"
              >
                Rezervace
              </Link>
            ) : null}
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <DetailRow label="Rezervace" value={formatBookingLabel(redemption.booking)} tone={redemption.booking ? "default" : "muted"} />
            <DetailRow label="Uplatnil" value={formatUserLabel(redemption.redeemedByUser)} tone={redemption.redeemedByUser ? "default" : "muted"} />
            <DetailRow label="Poznámka" value={formatOptional(redemption.note)} tone={redemption.note ? "default" : "muted"} />
          </dl>
        </article>
      ))}
    </div>
  );
}

function DetailRow({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: DetailRowTone;
}) {
  return (
    <div className="rounded-[1.15rem] border border-white/8 bg-white/5 p-4">
      <dt className="text-xs uppercase tracking-[0.22em] text-white/48">{label}</dt>
      <dd className={cn("mt-2 text-sm leading-6", tone === "muted" ? "text-white/42" : "text-white/86")}>
        {value}
      </dd>
    </div>
  );
}

function getVoucherStatusPillTone(status: VoucherStatus): "active" | "muted" | "accent" {
  switch (status) {
    case VoucherStatus.ACTIVE:
    case VoucherStatus.PARTIALLY_REDEEMED:
      return "active";
    case VoucherStatus.REDEEMED:
    case VoucherStatus.EXPIRED:
    case VoucherStatus.CANCELLED:
      return "muted";
    case VoucherStatus.DRAFT:
      return "accent";
  }
}

function getVoucherStatusStatTone(status: VoucherStatus): "default" | "accent" | "muted" {
  return getVoucherStatusPillTone(status) === "active" ? "accent" : "muted";
}

function formatDateLabel(value: Date | null | undefined) {
  return value ? dateFormatter.format(value) : "Nevyplněno";
}

function formatDateTimeLabel(value: Date | null | undefined) {
  return value ? dateTimeFormatter.format(value) : "Nevyplněno";
}

function formatOptional(value: string | null | undefined) {
  return value?.trim() ? value : "Nevyplněno";
}

function formatCzk(value: number | null | undefined) {
  return typeof value === "number" ? czkFormatter.format(value) : "Nevyplněno";
}

function formatDuration(value: number | null | undefined) {
  return typeof value === "number" ? `${value} min` : "Nevyplněno";
}

function formatUserLabel(user: { name: string; email: string } | null | undefined) {
  if (!user) {
    return "Nevyplněno";
  }

  return `${user.name} (${user.email})`;
}

function formatBookingLabel(
  booking: AdminVoucherDetailData["redemptions"][number]["booking"],
) {
  if (!booking) {
    return "Nevyplněno";
  }

  return `${booking.clientNameSnapshot} • ${booking.serviceNameSnapshot} • ${formatDateTimeLabel(booking.scheduledStartsAt)}`;
}
