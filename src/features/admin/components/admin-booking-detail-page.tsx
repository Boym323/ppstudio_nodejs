import Link from "next/link";

import { type AdminBookingDetailData } from "@/features/admin/lib/admin-booking";
import { cn } from "@/lib/utils";

import { AdminBookingNoteForm } from "./admin-booking-note-form";
import { AdminBookingStatusForm } from "./admin-booking-status-form";
import { AdminBookingVoucherForm } from "./admin-booking-voucher-form";
import { AdminPanel } from "./admin-page-shell";
import { RescheduleBookingButton } from "./reschedule-booking-button";

type AdminBookingDetailPageProps = {
  data: AdminBookingDetailData;
};

const HISTORY_PREVIEW_COUNT = 5;

export function AdminBookingDetailPage({ data }: AdminBookingDetailPageProps) {
  const listHref = data.area === "owner" ? "/admin/rezervace" : "/admin/provoz/rezervace";
  const statusContext = getStatusContext(data);
  const historyPreviewItems = data.historyItems.slice(0, HISTORY_PREVIEW_COUNT);
  const remainingHistoryItems = data.historyItems.slice(HISTORY_PREVIEW_COUNT);

  return (
    <div className="min-w-0 space-y-3">
      <BookingDetailHeader data={data} listHref={listHref} />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(19rem,0.9fr)] xl:items-start">
        <div className="min-w-0 space-y-3">
          <BookingActionPanel data={data} statusContext={statusContext} />
          <div id="booking-voucher">
            <BookingVoucherPanel data={data} />
          </div>
          <div id="booking-notes">
            <BookingNotesPanel data={data} />
          </div>
          <div id="booking-history">
            <BookingHistoryTimeline
              previewItems={historyPreviewItems}
              remainingItems={remainingHistoryItems}
            />
          </div>
        </div>

        <aside className="min-w-0 space-y-3 xl:sticky xl:top-28">
          <BookingSummaryCard data={data} />
          <BookingAuditCard data={data} />
        </aside>
      </div>
    </div>
  );
}

function BookingDetailHeader({
  data,
  listHref,
}: {
  data: AdminBookingDetailData;
  listHref: string;
}) {
  const headerToneClassName = getHeaderToneClassName(data.status);
  const clientEmailHref = data.clientEmail ? `mailto:${data.clientEmail}` : null;

  return (
    <section
      className={cn(
        "sticky top-1.5 z-30 rounded-[var(--radius-panel)] border bg-[rgba(11,11,11,0.92)] p-3 backdrop-blur-xl sm:p-3.5",
        headerToneClassName,
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={listHref}
            className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-white/76 transition hover:border-white/18 hover:bg-white/6 hover:text-white"
          >
            Zpět na rezervace
          </Link>
          <span className={getStatusBadgeClassName(data.status)}>{data.statusLabel}</span>
          <span className="rounded-full border border-white/8 px-2.5 py-1 text-[0.64rem] font-medium uppercase tracking-[0.16em] text-white/52">
            {data.sourceLabel}
          </span>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0 space-y-2">
            <div className="space-y-1">
              <p className="text-[0.66rem] uppercase tracking-[0.22em] text-[var(--color-accent-soft)]">
                {data.area === "owner" ? "Detail rezervace" : "Provozní detail rezervace"}
              </p>
              <h1 className="font-display text-[1.42rem] leading-tight text-white sm:text-[1.7rem] xl:text-[1.86rem]">
                {data.clientName}
              </h1>
              <p className="text-sm text-white/68 sm:text-[0.98rem]">{data.serviceName}</p>
            </div>

            <div className="rounded-[1rem] border border-white/8 bg-black/18 px-3.5 py-2.5">
              <p className="text-[0.64rem] uppercase tracking-[0.18em] text-white/42">Termín</p>
              <p className="mt-1 text-base font-semibold text-white sm:text-[1.02rem]">
                {data.scheduledAtLabel}
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <QuickHeaderAction href={buildPhoneHref(data.clientPhone)} label="Zavolat klientce" />
            <QuickHeaderAction href={clientEmailHref} label="Napsat e-mail" muted={!clientEmailHref} />
            {data.reschedule.enabled ? (
              <RescheduleBookingButton
                area={data.area}
                bookingId={data.id}
                serviceId={data.reschedule.serviceId}
                serviceName={data.serviceName}
                serviceDurationMinutes={data.reschedule.serviceDurationMinutes}
                currentScheduledAtLabel={data.scheduledAtLabel}
                currentStartsAt={data.reschedule.currentStartsAt}
                expectedUpdatedAt={data.reschedule.expectedUpdatedAt}
                rescheduleCount={data.rescheduleCount}
                slots={data.reschedule.slots}
                variant="inline"
              />
            ) : (
              <QuickHeaderAction href={null} label="Přesunout termín" muted />
            )}
            <QuickHeaderAction href={listHref} label="Zpět na rezervace" />
          </div>
        </div>
      </div>
    </section>
  );
}

function BookingActionPanel({
  data,
  statusContext,
}: {
  data: AdminBookingDetailData;
  statusContext: {
    title: string;
    description: string;
    tone: "pending" | "confirmed" | "closed" | "neutral";
  };
}) {
  return (
    <AdminPanel title="Další krok" compact={data.area === "salon"} denseHeader>
      <div className="space-y-3">
        <div className={getStatusContextClassName(statusContext.tone)}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[0.66rem] uppercase tracking-[0.18em] text-white/45">
                Rozhodovací panel
              </p>
              <p className="mt-1 text-sm font-medium text-white">{statusContext.title}</p>
              <p className="mt-1 text-sm leading-5 text-white/64">{statusContext.description}</p>
            </div>
            {data.reschedule.enabled ? (
              <div className="shrink-0">
                <RescheduleBookingButton
                  area={data.area}
                  bookingId={data.id}
                  serviceId={data.reschedule.serviceId}
                  serviceName={data.serviceName}
                  serviceDurationMinutes={data.reschedule.serviceDurationMinutes}
                  currentScheduledAtLabel={data.scheduledAtLabel}
                  currentStartsAt={data.reschedule.currentStartsAt}
                  expectedUpdatedAt={data.reschedule.expectedUpdatedAt}
                  rescheduleCount={data.rescheduleCount}
                  slots={data.reschedule.slots}
                />
              </div>
            ) : null}
          </div>
        </div>

        <AdminBookingStatusForm
          area={data.area}
          bookingId={data.id}
          availableActions={data.availableActions}
          bookingStatus={data.status}
        />
      </div>
    </AdminPanel>
  );
}

function BookingSummaryCard({ data }: { data: AdminBookingDetailData }) {
  const items = [
    { label: "Stav", value: data.statusLabel, tone: "accent" as const },
    { label: "Klientka", value: data.clientName },
    { label: "Telefon", value: data.clientPhone, href: buildPhoneHref(data.clientPhone), tone: "strong" as const },
    { label: "E-mail", value: data.clientEmail || "Bez e-mailu", href: data.clientEmail ? `mailto:${data.clientEmail}` : undefined },
    { label: "Služba", value: data.serviceName, tone: "strong" as const },
    { label: "Termín", value: data.scheduledAtLabel, tone: "strong" as const },
    { label: "Zdroj", value: data.sourceLabel },
    { label: "Přesuny", value: data.rescheduleCount > 0 ? `${data.rescheduleCount}×` : "0×" },
  ];

  return (
    <AdminPanel title="Souhrn rezervace" compact={data.area === "salon"} denseHeader>
      <dl className="divide-y divide-white/6 overflow-hidden rounded-[1rem] border border-white/8 bg-white/[0.035]">
        {items.map((item) => (
          <SummaryRow key={item.label} {...item} />
        ))}
      </dl>
    </AdminPanel>
  );
}

function BookingAuditCard({ data }: { data: AdminBookingDetailData }) {
  const items = [
    { label: "Vytvořeno", value: data.createdAtLabel },
    { label: "Naposledy změněno", value: data.updatedAtLabel },
    {
      label: "Poslední přesun",
      value: data.rescheduledAtLabel ?? "Zatím bez přesunu",
    },
    {
      label: "Akvizice",
      value: data.acquisitionLabel ?? "Neuvedeno",
    },
  ];

  return (
    <AdminPanel title="Technická metadata" compact={data.area === "salon"} denseHeader>
      <dl className="divide-y divide-white/6 overflow-hidden rounded-[1rem] border border-white/8 bg-white/[0.03]">
        {items.map((item) => (
          <SummaryRow key={item.label} label={item.label} value={item.value} />
        ))}
      </dl>
    </AdminPanel>
  );
}

function BookingNotesPanel({ data }: { data: AdminBookingDetailData }) {
  return (
    <AdminPanel title="Poznámky" compact={data.area === "salon"} denseHeader>
      <div className="space-y-3">
        <CompactNoteBlock
          label="Poznámka od klientky"
          value={data.clientNote}
          emptyLabel="Klientka nic nedopsala."
          tone="default"
        />

        <div className="rounded-[1rem] border border-white/8 bg-white/[0.035] p-3.5">
          <div className="mb-3">
            <p className="text-[0.68rem] uppercase tracking-[0.2em] text-white/46">Interní poznámka</p>
            <p className="mt-1 text-sm leading-5 text-white/60">
              Krátký provozní kontext pro OWNER i SALON.
            </p>
          </div>

          {data.internalNote ? (
            <CompactNoteBlock label="Aktuální interní poznámka" value={data.internalNote} tone="accent" />
          ) : (
            <div className="rounded-[0.95rem] border border-dashed border-white/12 bg-black/16 px-3 py-2.5">
              <p className="text-sm text-white/62">Interní poznámka zatím chybí.</p>
            </div>
          )}

          <div className="mt-3">
            <AdminBookingNoteForm
              area={data.area}
              bookingId={data.id}
              initialValue={data.internalNote ?? ""}
            />
          </div>
        </div>
      </div>
    </AdminPanel>
  );
}

function BookingVoucherPanel({ data }: { data: AdminBookingDetailData }) {
  const intendedVoucher = data.voucher.intendedVoucher;
  const initialVoucherCode =
    intendedVoucher?.code ?? data.voucher.intendedVoucherCodeSnapshot ?? "";
  const hasRedemptions = data.voucher.redemptions.length > 0;

  return (
    <AdminPanel title="Voucher" compact={data.area === "salon"} denseHeader>
      <div className="space-y-3">
        {intendedVoucher ? (
          <div className="rounded-[1rem] border border-[var(--color-accent)]/18 bg-[rgba(190,160,120,0.08)] p-3.5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.66rem] uppercase tracking-[0.18em] text-white/45">
                  Klient zadal tento voucher při rezervaci.
                </p>
                <p className="mt-1 font-mono text-lg font-semibold tracking-[0.12em] text-white">
                  {intendedVoucher.code}
                </p>
              </div>
              <span className="rounded-full border border-white/10 bg-black/18 px-2.5 py-1 text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-white/66">
                {intendedVoucher.statusLabel}
              </span>
            </div>
            <dl className="mt-3 grid gap-2 sm:grid-cols-3">
              <VoucherMiniRow label="Typ" value={intendedVoucher.typeLabel} />
              <VoucherMiniRow label="Hodnota / služba" value={intendedVoucher.valueLabel} />
              <VoucherMiniRow label="Zbývá" value={intendedVoucher.remainingLabel} />
            </dl>
            <p className="mt-3 text-sm leading-5 text-white/64">{intendedVoucher.safeDescription}</p>
            {data.voucher.intendedVoucherValidatedAtLabel ? (
              <p className="mt-2 text-xs leading-4 text-white/42">
                Ověřeno při zadání: {data.voucher.intendedVoucherValidatedAtLabel}
              </p>
            ) : null}
          </div>
        ) : data.voucher.intendedVoucherCodeSnapshot ? (
          <div className="rounded-[1rem] border border-white/8 bg-white/[0.035] p-3.5">
            <p className="text-sm leading-5 text-white/70">
              U rezervace je uložený kód voucheru{" "}
              <span className="font-mono text-white">{data.voucher.intendedVoucherCodeSnapshot}</span>,
              ale není napojený na aktivní voucher v evidenci.
            </p>
          </div>
        ) : (
          <div className="rounded-[1rem] border border-dashed border-white/12 bg-white/[0.03] px-3.5 py-3">
            <p className="text-sm text-white/64">K rezervaci není připojen žádný voucher.</p>
          </div>
        )}

        <AdminBookingVoucherForm
          area={data.area}
          bookingId={data.id}
          initialVoucherCode={initialVoucherCode}
          intendedVoucherType={intendedVoucher?.type ?? null}
          defaultAmountCzk={intendedVoucher?.defaultRedeemAmountCzk ?? data.servicePriceFromCzk}
        />

        <VoucherRedemptionsList redemptions={data.voucher.redemptions} hasRedemptions={hasRedemptions} />
      </div>
    </AdminPanel>
  );
}

function VoucherMiniRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[0.9rem] border border-white/8 bg-black/14 px-3 py-2">
      <dt className="text-[0.62rem] uppercase tracking-[0.16em] text-white/42">{label}</dt>
      <dd className="mt-1 text-sm leading-5 text-white/78">{value}</dd>
    </div>
  );
}

function VoucherRedemptionsList({
  redemptions,
  hasRedemptions,
}: {
  redemptions: AdminBookingDetailData["voucher"]["redemptions"];
  hasRedemptions: boolean;
}) {
  if (!hasRedemptions) {
    return (
      <div className="rounded-[1rem] border border-white/8 bg-white/[0.03] px-3.5 py-3">
        <p className="text-sm text-white/58">Historie uplatnění u této rezervace je zatím prázdná.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <p className="text-[0.66rem] uppercase tracking-[0.18em] text-white/45">Historie uplatnění</p>
      {redemptions.map((redemption) => (
        <article key={redemption.id} className="rounded-[1rem] border border-white/8 bg-white/[0.035] px-3.5 py-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-mono text-sm font-semibold tracking-[0.1em] text-white">
                {redemption.voucherCode}
              </p>
              <p className="mt-1 text-sm leading-5 text-white/62">
                {redemption.voucherTypeLabel} • {redemption.redeemedAtLabel}
              </p>
            </div>
            <span className="rounded-full border border-white/8 bg-black/14 px-2.5 py-1 text-[0.64rem] uppercase tracking-[0.16em] text-white/58">
              {formatCzk(redemption.amountCzk)}
            </span>
          </div>
          <dl className="mt-3 grid gap-2 sm:grid-cols-3">
            <VoucherMiniRow label="Služba" value={redemption.serviceNameSnapshot ?? "Neuvedeno"} />
            <VoucherMiniRow label="Uplatnil" value={redemption.redeemedByUserLabel} />
            <VoucherMiniRow label="Poznámka" value={redemption.note ?? "Bez poznámky"} />
          </dl>
        </article>
      ))}
    </div>
  );
}

function BookingHistoryTimeline({
  previewItems,
  remainingItems,
}: {
  previewItems: AdminBookingDetailData["historyItems"];
  remainingItems: AdminBookingDetailData["historyItems"];
}) {
  if (previewItems.length === 0) {
    return (
      <AdminPanel title="Historie změn" denseHeader>
        <div className="rounded-[1rem] border border-dashed border-white/12 bg-white/[0.03] px-3.5 py-3">
          <p className="text-sm text-white/64">Historie změn zatím není k dispozici.</p>
        </div>
      </AdminPanel>
    );
  }

  return (
    <AdminPanel title="Historie změn" denseHeader>
      <div className="space-y-2.5">
        {previewItems.map((item) => (
          <HistoryItem key={item.id} item={item} />
        ))}

        {remainingItems.length > 0 ? (
          <details className="group rounded-[1rem] border border-white/8 bg-white/[0.03]">
            <summary className="cursor-pointer list-none px-3.5 py-3 text-sm font-medium text-white/78 marker:hidden">
              <span className="group-open:hidden">Zobrazit celou historii ({remainingItems.length})</span>
              <span className="hidden group-open:inline">Skrýt starší položky</span>
            </summary>
            <div className="space-y-2 border-t border-white/8 px-3.5 py-3">
              {remainingItems.map((item) => (
                <HistoryItem key={item.id} item={item} />
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </AdminPanel>
  );
}

function SummaryRow({
  label,
  value,
  href,
  tone = "default",
}: {
  label: string;
  value: string;
  href?: string | null;
  tone?: "default" | "accent" | "strong";
}) {
  const valueClassName =
    tone === "accent"
      ? "font-medium text-[var(--color-accent-soft)]"
      : tone === "strong"
        ? "font-medium text-white"
        : "text-white/76";

  return (
    <div className="grid gap-1 px-3.5 py-3 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:items-start sm:gap-3">
      <dt className="text-[0.66rem] uppercase tracking-[0.18em] text-white/42">{label}</dt>
      <dd className={cn("min-w-0 text-sm leading-5", valueClassName)}>
        {href ? (
          <a href={href} className="transition hover:text-white">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

function CompactNoteBlock({
  label,
  value,
  emptyLabel,
  tone,
}: {
  label: string;
  value?: string | null;
  emptyLabel?: string;
  tone: "default" | "accent";
}) {
  const hasValue = Boolean(value?.trim());

  return (
    <div
      className={cn(
        "rounded-[1rem] border px-3.5 py-3",
        tone === "accent"
          ? "border-[var(--color-accent)]/14 bg-[rgba(190,160,120,0.07)]"
          : "border-white/8 bg-white/[0.04]",
      )}
    >
      <p className="text-[0.68rem] uppercase tracking-[0.2em] text-white/46">{label}</p>
      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-5 text-white/78">
        {hasValue ? value : emptyLabel}
      </p>
    </div>
  );
}

function HistoryItem({
  item,
}: {
  item: AdminBookingDetailData["historyItems"][number];
}) {
  return (
    <article className="rounded-[1rem] border border-white/8 bg-white/[0.035] px-3.5 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn(getHistoryBadgeClassName(item.badgeTone), "text-[0.64rem]")}>
              {item.badgeLabel}
            </span>
            {item.sourceLabel ? (
              <span className="rounded-full border border-white/8 px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.16em] text-white/44">
                {item.sourceLabel}
              </span>
            ) : null}
          </div>
          <p className="text-sm font-medium text-white/88">{item.createdAtLabel}</p>
          <p className="text-sm leading-5 text-white/66">
            {item.actorLabel} • {item.description}
          </p>
        </div>
      </div>

      {item.reason ? (
        <p className="mt-2 text-sm leading-5 text-white/58">
          <span className="text-white/78">Důvod:</span> {item.reason}
        </p>
      ) : null}

      {item.note ? (
        <p className="mt-1 text-sm leading-5 text-white/58">
          <span className="text-white/78">Poznámka:</span> {item.note}
        </p>
      ) : null}
    </article>
  );
}

function QuickHeaderAction({
  href,
  label,
  muted = false,
}: {
  href: string | null;
  label: string;
  muted?: boolean;
}) {
  const className = cn(
    "inline-flex min-h-11 items-center justify-center rounded-full border px-3 py-2 text-sm transition",
    muted
      ? "border-white/8 bg-white/[0.03] text-white/42"
      : "border-white/10 bg-black/16 text-white/76 hover:border-white/18 hover:bg-white/6 hover:text-white",
  );

  if (!href) {
    return <span className={className}>{label}</span>;
  }

  if (href.startsWith("/")) {
    return (
      <Link href={href} className={className}>
        {label}
      </Link>
    );
  }

  return (
    <a href={href} className={className}>
      {label}
    </a>
  );
}

function getHeaderToneClassName(status: AdminBookingDetailData["status"]) {
  switch (status) {
    case "PENDING":
      return "border-amber-300/16 shadow-[0_0_0_1px_rgba(252,211,77,0.08)]";
    case "CONFIRMED":
      return "border-emerald-300/14 shadow-[0_0_0_1px_rgba(110,231,183,0.06)]";
    case "COMPLETED":
      return "border-cyan-300/12";
    case "CANCELLED":
      return "border-red-300/14";
    case "NO_SHOW":
      return "border-orange-300/14";
    default:
      return "border-white/10";
  }
}

function getStatusBadgeClassName(status: AdminBookingDetailData["status"]) {
  switch (status) {
    case "PENDING":
      return "inline-flex rounded-full border border-amber-300/35 bg-amber-500/12 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-amber-100";
    case "CONFIRMED":
      return "inline-flex rounded-full border border-emerald-300/35 bg-emerald-500/12 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-emerald-100";
    case "COMPLETED":
      return "inline-flex rounded-full border border-cyan-300/35 bg-cyan-500/12 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-cyan-100";
    case "CANCELLED":
      return "inline-flex rounded-full border border-red-300/35 bg-red-500/12 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-red-100";
    case "NO_SHOW":
      return "inline-flex rounded-full border border-orange-300/35 bg-orange-500/12 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-orange-100";
    default:
      return "inline-flex rounded-full border border-white/12 bg-white/8 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white";
  }
}

function getHistoryBadgeClassName(status: AdminBookingDetailData["historyItems"][number]["badgeTone"]) {
  if (status === "RESCHEDULED") {
    return "inline-flex rounded-full border border-[var(--color-accent)]/35 bg-[rgba(190,160,120,0.14)] px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent-soft)]";
  }

  return getStatusBadgeClassName(status);
}

function getStatusContextClassName(tone: "pending" | "confirmed" | "closed" | "neutral") {
  switch (tone) {
    case "pending":
      return "rounded-[1rem] border border-amber-300/16 bg-amber-500/7 px-3.5 py-3";
    case "confirmed":
      return "rounded-[1rem] border border-emerald-300/16 bg-emerald-500/7 px-3.5 py-3";
    case "closed":
      return "rounded-[1rem] border border-white/8 bg-white/[0.035] px-3.5 py-3";
    default:
      return "rounded-[1rem] border border-white/8 bg-white/[0.04] px-3.5 py-3";
  }
}

function getStatusContext(data: AdminBookingDetailData) {
  if (data.availableActions.length === 0) {
    switch (data.status) {
      case "COMPLETED":
        return {
          title: "Rezervace je uzavřená jako hotová.",
          description: "Detail teď slouží hlavně pro kontrolu poznámek a historie.",
          tone: "closed" as const,
        };
      case "CANCELLED":
        return {
          title: "Rezervace je zrušená.",
          description: "Žádná další provozní akce není potřeba.",
          tone: "closed" as const,
        };
      case "NO_SHOW":
        return {
          title: "Rezervace je uzavřená jako nedorazila.",
          description: "Historie zůstává po ruce a interní poznámku můžeš dál upravit.",
          tone: "closed" as const,
        };
      default:
        return {
          title: "Rezervace je bez další akce.",
          description: "Detail zůstává jako rychlý přehled a auditní stopa.",
          tone: "neutral" as const,
        };
    }
  }

  switch (data.status) {
    case "PENDING":
      return {
        title: "Rezervace čeká na rozhodnutí.",
        description: "Nejčastější krok je potvrzení. Ostatní akce jsou hned vedle.",
        tone: "pending" as const,
      };
    case "CONFIRMED":
      return {
        title: "Potvrzený termín je připravený k obsluze.",
        description: "Po návštěvě ho uzavři jako hotové, případně označ jako nedorazila.",
        tone: "confirmed" as const,
      };
    default:
      return {
        title: "Vyber další krok.",
        description: "Akce níže používají existující stavová pravidla i audit.",
        tone: "neutral" as const,
      };
  }
}

function buildPhoneHref(phone: string) {
  const normalized = phone.replace(/[^+\d]/g, "");
  return normalized.length > 0 ? `tel:${normalized}` : null;
}

const czkFormatter = new Intl.NumberFormat("cs-CZ", {
  maximumFractionDigits: 0,
  style: "currency",
  currency: "CZK",
});

function formatCzk(value: number | null | undefined) {
  return typeof value === "number" ? czkFormatter.format(value) : "Bez částky";
}
