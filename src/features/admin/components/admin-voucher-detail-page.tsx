import Link from "next/link";
import { VoucherStatus, VoucherType } from "@prisma/client";

import { AdminVoucherEmailPanel } from "@/features/admin/components/admin-voucher-email-panel";
import { AdminVoucherOperationsPanel } from "@/features/admin/components/admin-voucher-operations-panel";
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
  const summaryBalanceLabel =
    data.type === VoucherType.VALUE
      ? formatVoucherBalanceLabel(data.redemptions.length, data.remainingValueCzk)
      : formatServiceVoucherBalanceLabel(data.redemptions.length);
  const canSendInStatus =
    data.effectiveStatus === VoucherStatus.ACTIVE || data.effectiveStatus === VoucherStatus.PARTIALLY_REDEEMED;
  const hasPurchaserEmail = Boolean(data.purchaserEmail?.trim());
  const canSendEmail = canSendInStatus && hasPurchaserEmail;
  const blockedSendMessage = !hasPurchaserEmail
    ? "Voucher nemá vyplněný e-mail kupujícího."
    : "Voucher v tomto stavu nelze odeslat e-mailem.";
  const summaryTypeLabel = buildSummaryTypeLabel(data);
  const parameterRows = buildParameterRows(data);
  const purchaserRows = buildPurchaserRows(data);

  return (
    <AdminPageShell
      eyebrow={data.area === "owner" ? "Dárkové vouchery" : "Provozní evidence"}
      title={data.area === "owner" ? "Detail voucheru" : "Provozní detail voucheru"}
      description="Kompaktní provozní detail voucheru s platností, čerpáním, odesláním a historií uplatnění."
      compact={data.area === "salon"}
    >
      <section className="rounded-[var(--radius-panel)] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03))] p-4 sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs uppercase tracking-[0.24em] text-white/42">Voucher</p>
                <span className="text-white/28">•</span>
                <p className="text-sm text-white/60">{summaryTypeLabel}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <p className="font-mono text-2xl font-semibold tracking-[0.14em] text-white sm:text-3xl">
                  {data.code}
                </p>
                <AdminStatePill tone={getVoucherStatusPillTone(data.effectiveStatus)}>
                  {data.statusLabel}
                </AdminStatePill>
              </div>
            </div>

            <Link
              href={data.listHref}
              className="rounded-full border border-white/10 px-3.5 py-2 text-sm text-white/78 transition hover:border-white/30 hover:text-white"
            >
              Zpět na seznam
            </Link>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              <SummaryMetric
                label="Platnost"
                value={formatDateRangeLabel(data.validFrom, data.validUntil)}
              />
              <SummaryMetric
                label="Čerpání / zůstatek"
                value={summaryBalanceLabel}
                tone={data.type === VoucherType.VALUE && (data.remainingValueCzk ?? 0) > 0 ? "accent" : "default"}
              />
              <SummaryMetric
                label={data.type === VoucherType.VALUE ? "Cena při vystavení" : "Služba při vystavení"}
                value={data.type === VoucherType.VALUE ? formatCzk(data.originalValueCzk) : formatOptional(data.serviceNameSnapshot)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 lg:justify-end">
              <Link
                href={data.pdfHref}
                className="rounded-full bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105"
              >
                Stáhnout PDF
              </Link>
              <Link
                href={data.printA4PdfHref}
                className="rounded-full border border-[var(--color-accent)]/45 px-4 py-2.5 text-sm font-semibold text-[var(--color-accent)] transition hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"
              >
                Tisk A4
              </Link>
              <a
                href="#voucher-email-panel"
                className="rounded-full border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/86 transition hover:border-white/20 hover:bg-white/6"
              >
                Poslat e-mailem
              </a>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,1fr)] xl:items-start">
        <div className="space-y-4">
          <AdminPanel
            title="Parametry voucheru"
            description="Původní snapshot a provozní metadata voucheru."
            compact={data.area === "salon"}
            denseHeader
          >
            <CompactDefinitionList rows={parameterRows} />
          </AdminPanel>

          <AdminPanel
            title="Historie uplatnění"
            description="Datum, služba nebo částka, rezervace, kdo uplatnil a poznámka."
            compact={data.area === "salon"}
            denseHeader
          >
            <RedemptionsList redemptions={data.redemptions} />
          </AdminPanel>
        </div>

        <div className="space-y-4">
          {data.status === VoucherStatus.CANCELLED ? (
            <AdminPanel
              title="Zrušení voucheru"
              description="Provozní metadata ručního zrušení voucheru."
              compact={data.area === "salon"}
              denseHeader
            >
              <div className="rounded-[1rem] border border-red-300/20 bg-red-500/[0.06] p-3.5">
                <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
                  <CompactDetailRow label="Stav voucheru" value="ZRUŠENÝ" />
                  <CompactDetailRow label="Zrušeno" value={formatDateTimeLabel(data.cancelledAt)} />
                  <CompactDetailRow
                    label="Zrušil/a"
                    value={formatUserLabel(data.cancelledByUser)}
                    tone={data.cancelledByUser ? "default" : "muted"}
                  />
                  <CompactDetailRow
                    label="Důvod"
                    value={formatOptional(data.cancelReason)}
                    tone={data.cancelReason ? "default" : "muted"}
                  />
                </dl>
              </div>
            </AdminPanel>
          ) : null}

          <AdminPanel
            title="Akce"
            description="Bezpečná provozní editace a ruční zrušení bez mazání voucheru."
            compact={data.area === "salon"}
            denseHeader
          >
            <AdminVoucherOperationsPanel data={data} />
          </AdminPanel>

          <AdminPanel
            title="Kupující a odeslání"
            description="Kontaktní údaje a ruční odeslání voucheru e-mailem."
            compact={data.area === "salon"}
            denseHeader
          >
            <div className="space-y-4">
              <CompactDefinitionList rows={purchaserRows} />

              <AdminVoucherEmailPanel
                panelId="voucher-email-panel"
                area={data.area}
                voucherId={data.id}
                canSend={canSendEmail}
                blockedMessage={blockedSendMessage}
                defaultRecipientEmail={data.purchaserEmail?.trim() ?? ""}
                defaultSubject="Dárkový poukaz PP Studio"
              />
            </div>
          </AdminPanel>

          <AdminPanel
            title="Poslední e-mailové pokusy"
            description="Krátký přehled posledních pokusů o doručení voucheru."
            compact={data.area === "salon"}
            denseHeader
          >
            <VoucherEmailHistory area={data.area} emailHistory={data.emailHistory} />
          </AdminPanel>
        </div>
      </div>

      {data.internalNote?.trim() ? (
        <AdminPanel
          title="Interní poznámka"
          description="Interní poznámka je viditelná pouze v administraci."
          compact={data.area === "salon"}
          denseHeader
        >
          <div className="rounded-[1rem] border border-white/8 bg-white/5 p-3.5">
            <p className="whitespace-pre-wrap text-sm leading-6 text-white/82">
              {data.internalNote.trim()}
            </p>
          </div>
        </AdminPanel>
      ) : null}
    </AdminPageShell>
  );
}

function buildSummaryTypeLabel(data: AdminVoucherDetailData) {
  if (data.type === VoucherType.SERVICE && data.serviceNameSnapshot?.trim()) {
    return `${data.typeLabel} · ${data.serviceNameSnapshot.trim()}`;
  }

  return data.typeLabel;
}

function buildParameterRows(data: AdminVoucherDetailData) {
  const issuedPrice = resolveIssuedPrice(data);
  const linkedServiceName = data.service ? data.service.publicName ?? data.service.name : null;

  return [
    { label: "Platnost od", value: formatDateLabel(data.validFrom) },
    { label: "Platnost do", value: formatDateLabel(data.validUntil) },
    {
      label: "Vystaveno",
      value: data.issuedAt ? formatDateTimeLabel(data.issuedAt) : "Nevyplněno",
      tone: data.issuedAt ? "default" : "muted",
    },
    { label: "Vytvořeno", value: formatDateTimeLabel(data.createdAt) },
    {
      label: "Vytvořil",
      value: formatUserLabel(data.createdByUser),
      tone: data.createdByUser ? "default" : "muted",
    },
    {
      label: "Služba při vystavení",
      value: formatOptional(data.serviceNameSnapshot),
      tone: data.serviceNameSnapshot?.trim() ? "default" : "muted",
    },
    {
      label: "Cena při vystavení",
      value: formatCzk(issuedPrice),
      tone: issuedPrice === null ? "muted" : "default",
    },
    {
      label: "Délka při vystavení",
      value: formatDuration(data.serviceDurationSnapshot),
      tone: data.serviceDurationSnapshot === null ? "muted" : "default",
    },
    {
      label: "Aktuální služba",
      value: formatOptional(linkedServiceName),
      tone: linkedServiceName ? "default" : "muted",
    },
  ] satisfies Array<{ label: string; value: string; tone?: DetailRowTone }>;
}

function buildPurchaserRows(data: AdminVoucherDetailData) {
  return [
    {
      label: "Jméno kupujícího",
      value: formatOptional(data.purchaserName),
      tone: data.purchaserName?.trim() ? "default" : "muted",
    },
    {
      label: "E-mail kupujícího",
      value: formatOptional(data.purchaserEmail),
      tone: data.purchaserEmail?.trim() ? "default" : "muted",
    },
  ] satisfies Array<{ label: string; value: string; tone?: DetailRowTone }>;
}

function resolveIssuedPrice(data: AdminVoucherDetailData) {
  if (data.type === VoucherType.VALUE) {
    return data.originalValueCzk;
  }

  return data.servicePriceSnapshotCzk;
}

function CompactDefinitionList({
  rows,
}: {
  rows: Array<{ label: string; value: string; tone?: DetailRowTone }>;
}) {
  return (
    <dl className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
      {rows.map((row) => (
        <CompactDetailRow key={row.label} label={row.label} value={row.value} tone={row.tone} />
      ))}
    </dl>
  );
}

function CompactDetailRow({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: DetailRowTone;
}) {
  return (
    <div className="border-b border-white/6 pb-2.5 last:border-b-0 sm:last:border-b sm:[&:nth-last-child(-n+2)]:border-b-0">
      <dt className="text-[0.68rem] uppercase tracking-[0.18em] text-white/42">{label}</dt>
      <dd className={cn("mt-1.5 break-words text-sm leading-5", tone === "muted" ? "text-white/42" : "text-white/84")}>
        {value}
      </dd>
    </div>
  );
}

function VoucherEmailHistory({
  area,
  emailHistory,
}: {
  area: AdminVoucherDetailData["area"];
  emailHistory: AdminVoucherDetailData["emailHistory"];
}) {
  if (emailHistory.length === 0) {
    return (
      <div className="rounded-[1rem] border border-dashed border-white/12 bg-white/4 px-4 py-4">
        <p className="text-sm leading-5 text-white/68">Voucher zatím nebyl e-mailem odeslán.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[1rem] border border-white/8 bg-white/[0.03]">
      {emailHistory.map((entry) => {
        const occurredAt = entry.sentAt ?? entry.createdAt;
        const detailHref = area === "owner" ? `/admin/email-logy/${entry.id}` : `/admin/provoz/email-logy/${entry.id}`;

        return (
          <article key={entry.id} className="border-t border-white/8 px-3.5 py-3 first:border-t-0">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium text-white">
                  {formatDateTimeLabel(occurredAt)} · {entry.recipientEmail}
                </p>
                {entry.errorMessage ? (
                  <p className="text-sm leading-5 text-red-100/88">{entry.errorMessage}</p>
                ) : null}
              </div>

              <div className="flex items-center gap-2.5 sm:shrink-0">
                <span
                  className={cn(
                    "inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.14em]",
                    getEmailHistoryStatusClassName(entry.status),
                  )}
                >
                  {formatEmailHistoryStatus(entry.status)}
                </span>
                <Link
                  href={detailHref}
                  className="text-sm font-medium text-[var(--color-accent)] transition hover:brightness-110"
                >
                  Detail
                </Link>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function RedemptionsList({
  redemptions,
}: {
  redemptions: AdminVoucherDetailData["redemptions"];
}) {
  if (redemptions.length === 0) {
    return (
      <div className="rounded-[1rem] border border-dashed border-white/12 bg-white/4 px-4 py-4">
        <p className="text-sm leading-5 text-white/68">Voucher zatím nebyl uplatněn.</p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-[1rem] border border-white/8 md:block">
        <table className="min-w-full border-separate border-spacing-0">
          <thead className="bg-white/4">
            <tr className="text-left text-[0.68rem] uppercase tracking-[0.18em] text-white/48">
              <th className="px-3.5 py-2.5 font-medium">Datum</th>
              <th className="px-3.5 py-2.5 font-medium">Služba / částka</th>
              <th className="px-3.5 py-2.5 font-medium">Rezervace</th>
              <th className="px-3.5 py-2.5 font-medium">Uplatnil</th>
              <th className="px-3.5 py-2.5 font-medium">Poznámka</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8 bg-white/[0.03]">
            {redemptions.map((redemption) => (
              <tr key={redemption.id} className="align-top">
                <td className="px-3.5 py-3 text-sm text-white/86">{formatDateTimeLabel(redemption.redeemedAt)}</td>
                <td className="px-3.5 py-3 text-sm leading-5 text-white/86">
                  {formatRedemptionAmountServiceLabel(redemption.amountCzk, redemption.serviceNameSnapshot)}
                </td>
                <td className="px-3.5 py-3 text-sm leading-5 text-white/86">
                  {redemption.bookingHref ? (
                    <Link
                      href={redemption.bookingHref}
                      className="group block max-w-full rounded-[0.95rem] border border-white/10 bg-white/[0.03] px-3 py-2.5 transition hover:border-white/20 hover:bg-white/[0.05]"
                    >
                      <BookingCell booking={redemption.booking} interactive />
                    </Link>
                  ) : (
                    <BookingCell booking={redemption.booking} />
                  )}
                </td>
                <td className="px-3.5 py-3 text-sm leading-5 text-white/86">
                  {formatUserLabel(redemption.redeemedByUser)}
                </td>
                <td className="px-3.5 py-3 text-sm leading-5 text-white/64">{formatOptional(redemption.note)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {redemptions.map((redemption) => (
          <article key={redemption.id} className="rounded-[1rem] border border-white/8 bg-white/5 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-white">{formatDateTimeLabel(redemption.redeemedAt)}</p>
                <p className="mt-1 text-sm leading-5 text-white/58">
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
            <dl className="mt-3 grid gap-3">
              <CompactDetailRow
                label="Rezervace"
                value={formatBookingLabel(redemption.booking)}
                tone={redemption.booking ? "default" : "muted"}
              />
              <CompactDetailRow
                label="Uplatnil"
                value={formatUserLabel(redemption.redeemedByUser)}
                tone={redemption.redeemedByUser ? "default" : "muted"}
              />
              <CompactDetailRow
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
    <div className={cn("rounded-[1rem] border p-3", toneClassName)}>
      <p className="text-[0.65rem] uppercase tracking-[0.18em] text-white/48">{label}</p>
      <p className="mt-1.5 break-words text-sm leading-5 text-white/86">{value}</p>
    </div>
  );
}

function formatDateRangeLabel(validFrom: Date, validUntil: Date | null | undefined) {
  return `${formatDateLabel(validFrom)} – ${formatDateLabel(validUntil)}`;
}

function formatVoucherBalanceLabel(redemptionsCount: number, remainingValueCzk: number | null | undefined) {
  const remaining = formatCzk(remainingValueCzk);

  if (remainingValueCzk === null || remaining === "Nevyplněno") {
    return `${redemptionsCount}× · neznámý zůstatek`;
  }

  return `${redemptionsCount}× · zbývá ${remaining}`;
}

function formatServiceVoucherBalanceLabel(redemptionsCount: number) {
  if (redemptionsCount === 0) {
    return "0× · zatím nevyužito";
  }

  return `${redemptionsCount}× · bez zůstatku`;
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

function formatEmailHistoryStatus(status: AdminVoucherDetailData["emailHistory"][number]["status"]) {
  switch (status) {
    case "PENDING":
      return "Čeká";
    case "SENT":
      return "Odesláno";
    case "FAILED":
      return "Chyba";
  }
}

function getEmailHistoryStatusClassName(status: AdminVoucherDetailData["emailHistory"][number]["status"]) {
  switch (status) {
    case "PENDING":
      return "border-amber-300/15 bg-amber-400/10 text-amber-100";
    case "SENT":
      return "border-emerald-300/15 bg-emerald-400/10 text-emerald-100";
    case "FAILED":
      return "border-red-300/15 bg-red-400/10 text-red-100";
  }
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

  return `${booking.clientNameSnapshot} · ${booking.serviceNameSnapshot} · ${formatDateTimeLabel(booking.scheduledStartsAt)}`;
}
