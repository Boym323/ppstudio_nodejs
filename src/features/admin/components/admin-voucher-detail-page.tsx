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
  const summaryValueLabel =
    data.type === VoucherType.VALUE
      ? formatCzk(data.originalValueCzk)
      : formatOptional(data.serviceNameSnapshot);
  const summaryBalanceLabel =
    data.type === VoucherType.VALUE
      ? formatVoucherBalanceLabel(data.redemptions.length, data.remainingValueCzk)
      : formatServiceVoucherBalanceLabel(data.redemptions.length);
  const buyerFields = buildPartyFields([
    { label: "Kupující", value: data.purchaserName },
    { label: "E-mail kupujícího", value: data.purchaserEmail },
  ]);

  return (
    <AdminPageShell
      eyebrow={data.area === "owner" ? "Dárkové vouchery" : "Provozní evidence"}
      title={data.area === "owner" ? "Detail voucheru" : "Provozní detail voucheru"}
      description="Read-only detail voucheru s aktuálními daty, historií čerpání a stažením PDF."
      compact={data.area === "salon"}
    >
      <section className="rounded-[var(--radius-panel)] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03))] p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <AdminStatePill tone={getVoucherStatusPillTone(data.effectiveStatus)}>
                {data.statusLabel}
              </AdminStatePill>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/62">
                {data.typeLabel}
              </span>
            </div>

            <div className="space-y-2">
              <p className="font-mono text-3xl font-semibold tracking-[0.14em] text-white sm:text-4xl">
                {data.code}
              </p>
              <p className="max-w-3xl text-sm leading-7 text-white/70">
                {summaryValueLabel}
                {data.type === VoucherType.VALUE ? " · hodnotový voucher" : " · službový voucher"}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryMetric label="Typ voucheru" value={data.typeLabel} />
              <SummaryMetric
                label={data.type === VoucherType.VALUE ? "Hodnota" : "Služba"}
                value={summaryValueLabel}
                tone="strong"
              />
              <SummaryMetric
                label="Platnost"
                value={`${formatDateLabel(data.validFrom)} až ${formatDateLabel(data.validUntil)}`}
              />
              <SummaryMetric
                label="Čerpání / zůstatek"
                value={summaryBalanceLabel}
                tone={data.type === VoucherType.VALUE && (data.remainingValueCzk ?? 0) > 0 ? "accent" : "default"}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            <Link
              href={data.listHref}
              className="rounded-full border border-white/10 px-4 py-3 text-sm text-white/78 transition hover:border-white/30 hover:text-white"
            >
              Zpět na seznam
            </Link>
            <Link
              href={data.pdfHref}
              className="rounded-full bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105"
            >
              Stáhnout PDF
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <AdminPanel title="Detaily" description="Základní provozní údaje o voucheru." compact={data.area === "salon"} denseHeader>
          <dl className="grid gap-3 sm:grid-cols-2">
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

        <AdminPanel
          title="Kupující"
          description="Zobrazeny jsou jen vyplněné údaje o kupujícím."
          compact={data.area === "salon"}
          denseHeader
        >
          {buyerFields.length === 0 ? (
            <p className="rounded-[1.1rem] border border-dashed border-white/12 bg-white/4 px-4 py-5 text-sm leading-6 text-white/58">
              Zatím nejsou vyplněné žádné údaje.
            </p>
          ) : (
            <dl className="grid gap-3 sm:grid-cols-2">
              {buyerFields.map((field) => (
                <DetailRow key={field.label} label={field.label} value={field.value} />
              ))}
            </dl>
          )}
        </AdminPanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <AdminPanel
          title="Hodnota / služba"
          description={
            data.type === VoucherType.VALUE
              ? "Přehled zůstatku hodnotového voucheru."
              : "Snapshot služby při vystavení voucheru."
          }
          compact={data.area === "salon"}
          denseHeader
        >
          {data.type === VoucherType.VALUE ? (
            <ValueSummary
              originalValueCzk={data.originalValueCzk}
              remainingValueCzk={data.remainingValueCzk}
              redeemedValueCzk={redeemedValueCzk}
            />
          ) : (
            <ServiceSummary data={data} />
          )}
        </AdminPanel>

        <AdminPanel
          title="Historie uplatnění"
          description="Datum, částka nebo služba, rezervace, kdo uplatnil a poznámka."
          compact={data.area === "salon"}
          denseHeader
        >
          <RedemptionsList redemptions={data.redemptions} />
        </AdminPanel>
      </div>

      {data.internalNote?.trim() ? (
        <AdminPanel
          title="Interní poznámka"
          description="Interní poznámka je viditelná pouze v administraci."
          compact={data.area === "salon"}
          denseHeader
        >
          <div className="rounded-[1.1rem] border border-white/8 bg-white/5 p-4">
            <p className="whitespace-pre-wrap text-sm leading-6 text-white/82">
              {data.internalNote.trim()}
            </p>
          </div>
        </AdminPanel>
      ) : null}
    </AdminPageShell>
  );
}

function ValueSummary({
  originalValueCzk,
  remainingValueCzk,
  redeemedValueCzk,
}: {
  originalValueCzk: number | null;
  remainingValueCzk: number | null;
  redeemedValueCzk: number | null;
}) {
  return (
    <dl className="grid gap-3 sm:grid-cols-3">
      <DetailRow
        label="Původní hodnota"
        value={formatCzk(originalValueCzk)}
        tone={originalValueCzk === null ? "muted" : "default"}
      />
      <DetailRow
        label="Zbývá"
        value={formatCzk(remainingValueCzk)}
        tone={remainingValueCzk === null ? "muted" : "default"}
      />
      <DetailRow label="Vyčerpáno" value={formatCzk(redeemedValueCzk)} />
    </dl>
  );
}

function ServiceSummary({ data }: { data: AdminVoucherDetailData }) {
  const linkedServiceName = data.service ? data.service.publicName ?? data.service.name : null;

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      <DetailRow
        label="Služba při vystavení"
        value={formatOptional(data.serviceNameSnapshot)}
        tone={data.serviceNameSnapshot ? "default" : "muted"}
      />
      <DetailRow
        label="Cena při vystavení"
        value={formatCzk(data.servicePriceSnapshotCzk)}
        tone={data.servicePriceSnapshotCzk === null ? "muted" : "default"}
      />
      <DetailRow
        label="Délka při vystavení"
        value={formatDuration(data.serviceDurationSnapshot)}
        tone={data.serviceDurationSnapshot === null ? "muted" : "default"}
      />
      <DetailRow
        label="Aktuální služba"
        value={formatOptional(linkedServiceName)}
        tone={linkedServiceName ? "default" : "muted"}
      />
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
    <>
      <div className="hidden overflow-hidden rounded-[1.1rem] border border-white/8 md:block">
        <table className="min-w-full border-separate border-spacing-0">
          <thead className="bg-white/4">
            <tr className="text-left text-xs uppercase tracking-[0.18em] text-white/48">
              <th className="px-4 py-3 font-medium">Datum</th>
              <th className="px-4 py-3 font-medium">Částka / služba</th>
              <th className="px-4 py-3 font-medium">Rezervace</th>
              <th className="px-4 py-3 font-medium">Uplatnil</th>
              <th className="px-4 py-3 font-medium">Poznámka</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8 bg-white/[0.03]">
            {redemptions.map((redemption) => (
              <tr key={redemption.id} className="align-top">
                <td className="px-4 py-4 text-sm text-white/86">{formatDateTimeLabel(redemption.redeemedAt)}</td>
                <td className="px-4 py-4 text-sm leading-6 text-white/86">
                  {formatRedemptionAmountServiceLabel(redemption.amountCzk, redemption.serviceNameSnapshot)}
                </td>
                <td className="px-4 py-4 text-sm leading-6 text-white/86">
                  {redemption.bookingHref ? (
                    <Link
                      href={redemption.bookingHref}
                      className="group block max-w-full rounded-[1rem] border border-white/10 bg-white/[0.03] px-3.5 py-3 transition hover:border-white/20 hover:bg-white/[0.05]"
                    >
                      <BookingCell booking={redemption.booking} interactive />
                    </Link>
                  ) : (
                    <BookingCell booking={redemption.booking} />
                  )}
                </td>
                <td className="px-4 py-4 text-sm leading-6 text-white/86">
                  {formatUserLabel(redemption.redeemedByUser)}
                </td>
                <td className="px-4 py-4 text-sm leading-6 text-white/64">{formatOptional(redemption.note)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {redemptions.map((redemption) => (
          <article key={redemption.id} className="rounded-[1.1rem] border border-white/8 bg-white/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-medium text-white">{formatDateTimeLabel(redemption.redeemedAt)}</p>
                <p className="mt-1 text-sm leading-6 text-white/58">
                  {formatRedemptionAmountServiceLabel(redemption.amountCzk, redemption.serviceNameSnapshot)}
                </p>
              </div>
              {redemption.bookingHref ? (
                <Link
                  href={redemption.bookingHref}
                  className="rounded-full border border-white/10 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-white/70 transition hover:border-white/20 hover:text-white"
                >
                  Detail
                </Link>
              ) : null}
            </div>
            <dl className="mt-4 grid gap-3">
              <DetailRow
                label="Rezervace"
                value={formatBookingLabel(redemption.booking)}
                tone={redemption.booking ? "default" : "muted"}
              />
              <DetailRow
                label="Uplatnil"
                value={formatUserLabel(redemption.redeemedByUser)}
                tone={redemption.redeemedByUser ? "default" : "muted"}
              />
              <DetailRow
                label="Poznámka"
                value={formatOptional(redemption.note)}
                tone={redemption.note ? "default" : "muted"}
              />
            </dl>
          </article>
        ))}
      </div>
    </>
  );
}

function SummaryMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "accent" | "strong";
}) {
  const toneClassName =
    tone === "accent"
      ? "border-[var(--color-accent)]/30 bg-[rgba(190,160,120,0.10)]"
      : tone === "strong"
        ? "border-white/12 bg-black/20"
        : "border-white/8 bg-white/5";

  return (
    <div className={cn("rounded-[1.1rem] border p-3.5", toneClassName)}>
      <p className="text-[0.65rem] uppercase tracking-[0.18em] text-white/48">{label}</p>
      <p className="mt-2 break-words text-sm leading-6 text-white/86">{value}</p>
    </div>
  );
}

function buildPartyFields(fields: Array<{ label: string; value: string | null | undefined }>) {
  return fields
    .filter((field) => field.value?.trim())
    .map((field) => ({
      label: field.label,
      value: field.value!.trim(),
    }));
}

function formatVoucherBalanceLabel(redemptionsCount: number, remainingValueCzk: number | null | undefined) {
  const remaining = formatCzk(remainingValueCzk);

  if (remainingValueCzk === null || remaining === "Nevyplněno") {
    return `${redemptionsCount}× • neznámý zůstatek`;
  }

  return `${redemptionsCount}× • zbývá ${remaining}`;
}

function formatServiceVoucherBalanceLabel(redemptionsCount: number) {
  if (redemptionsCount === 0) {
    return "0× • zatím nevyužito";
  }

  return `${redemptionsCount}× • bez zůstatku`;
}

function formatRedemptionAmountServiceLabel(
  amountCzk: number | null | undefined,
  serviceNameSnapshot: string | null | undefined,
) {
  const amountLabel = typeof amountCzk === "number" ? formatCzk(amountCzk) : "";
  const serviceLabel = serviceNameSnapshot?.trim() ?? "";

  if (amountLabel && serviceLabel) {
    return `${amountLabel} · ${serviceLabel}`;
  }

  if (serviceLabel) {
    return serviceLabel;
  }

  if (amountLabel) {
    return amountLabel;
  }

  return "Bez údajů";
}

function BookingCell({
  booking,
  interactive = false,
}: {
  booking: AdminVoucherDetailData["redemptions"][number]["booking"];
  interactive?: boolean;
}) {
  if (!booking) {
    return <span className="text-white/42">Nevyplněno</span>;
  }

  return (
    <div className="min-w-0 space-y-1">
      <p
        className={cn(
          "truncate text-sm font-medium",
          interactive ? "text-white/88 transition group-hover:text-white" : "text-white/88",
        )}
      >
        {booking.clientNameSnapshot}
      </p>
      <p className="truncate text-sm text-white/58">{booking.serviceNameSnapshot}</p>
      <p className="text-xs uppercase tracking-[0.14em] text-white/42">
        {formatDateTimeLabel(booking.scheduledStartsAt)}
      </p>
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
