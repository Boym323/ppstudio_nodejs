import Link from "next/link";
import { VoucherType } from "@prisma/client";

import { type AdminBookingDetailData } from "@/features/admin/lib/admin-booking";
import { buildClientPhoneHref } from "@/features/booking/lib/client-phone";
import { cn } from "@/lib/utils";

import { AdminBookingNoteForm } from "./admin-booking-note-form";
import {
  AdminBookingPaymentForm,
  DeleteBookingPaymentButton,
} from "./admin-booking-payment-form";
import { AdminBookingPriceForm } from "./admin-booking-price-form";
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
        "rounded-[var(--radius-panel)] border bg-[rgba(11,11,11,0.92)] p-3 backdrop-blur-xl lg:sticky lg:top-5 lg:z-30 sm:p-3.5",
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
    { label: "Kanál rezervace", value: data.sourceLabel },
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
      label: "Odkud přišla",
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
  const paymentSummary = data.voucher.paymentSummary;
  const initialVoucherCode =
    intendedVoucher?.code ?? data.voucher.intendedVoucherCodeSnapshot ?? "";
  const hasRedemptions = data.voucher.redemptions.length > 0;
  const hasDirectPayments = data.voucher.payments.length > 0;
  const canRedeemAnotherVoucher = !hasRedemptions && paymentSummary.remainingAmountCzk !== 0;
  const amountHint = getVoucherAmountHint(intendedVoucher, paymentSummary.remainingAmountCzk);
  const voucherForm = canRedeemAnotherVoucher ? (
    <AdminBookingVoucherForm
      id="booking-voucher-form"
      area={data.area}
      bookingId={data.id}
      initialVoucherCode={initialVoucherCode}
      intendedVoucherType={intendedVoucher?.type ?? null}
      defaultAmountCzk={intendedVoucher?.defaultRedeemAmountCzk ?? paymentSummary.remainingAmountCzk}
      amountHint={amountHint}
    />
  ) : null;

  return (
    <AdminPanel title="Úhrada" compact={data.area === "salon"} denseHeader>
      <div className="space-y-2.5">
        <PaymentSummaryBlock data={data} paymentSummary={paymentSummary} />

        <AdminBookingPaymentForm
          area={data.area}
          bookingId={data.id}
          defaultAmountCzk={paymentSummary.remainingCzk}
        />

        <div className="space-y-2">
          <p className="text-sm font-medium text-white/74">Dárkový poukaz</p>

          {intendedVoucher ? (
            <div className="rounded-[0.95rem] border border-[var(--color-accent)]/16 bg-[rgba(190,160,120,0.06)] p-3">
              <div className="flex flex-wrap items-start justify-between gap-2.5">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium text-white/90">Klientka uvedla poukaz při rezervaci</p>
                  <p className="font-mono text-[1.05rem] font-semibold tracking-[0.14em] text-white">
                    {intendedVoucher.code}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full border border-white/10 bg-black/18 px-2.5 py-1 text-[0.64rem] font-medium uppercase tracking-[0.14em] text-white/70">
                    {intendedVoucher.typeLabel}
                  </span>
                  <span className="rounded-full border border-white/10 bg-black/18 px-2.5 py-1 text-[0.64rem] font-medium uppercase tracking-[0.14em] text-white/70">
                    {intendedVoucher.statusLabel}
                  </span>
                </div>
              </div>
              <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                <VoucherMiniRow label="Typ" value={intendedVoucher.typeLabel} />
                <VoucherMiniRow label="Hodnota / služba" value={intendedVoucher.valueLabel} />
                {intendedVoucher.type === VoucherType.VALUE ? (
                  <VoucherMiniRow label="Zůstatek" value={intendedVoucher.remainingLabel} />
                ) : null}
                <VoucherMiniRow
                  label="Ověřeno"
                  value={data.voucher.intendedVoucherValidatedAtLabel ?? "Při rezervaci"}
                />
              </dl>
              {voucherForm ? (
                <div className="mt-3 border-t border-white/8 pt-3">
                  <p className="text-sm font-medium text-white/82">Uplatnění voucheru</p>
                  <p className="mt-1 text-sm leading-5 text-white/56">
                    Voucher z rezervace je předvyplněný, stačí potvrdit případnou částku a uložení.
                  </p>
                  <div className="mt-3 rounded-[0.95rem] border border-white/8 bg-black/18 p-3">
                    {voucherForm}
                  </div>
                </div>
              ) : null}
            </div>
          ) : data.voucher.intendedVoucherCodeSnapshot ? (
            <div className="rounded-[0.95rem] border border-white/8 bg-white/[0.035] px-3.5 py-3">
              <p className="text-sm leading-5 text-white/70">
                U rezervace je uložený kód voucheru{" "}
                <span className="font-mono text-white">{data.voucher.intendedVoucherCodeSnapshot}</span>,
                ale není napojený na aktivní voucher v evidenci.
              </p>
            </div>
          ) : voucherForm ? (
            <details className="group rounded-[0.95rem] border border-white/8 bg-white/[0.03]">
              <summary className="cursor-pointer list-none px-3.5 py-3 marker:hidden">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <p className="text-sm text-white/64">K rezervaci není připojen žádný voucher.</p>
                  <span className="inline-flex min-h-9 items-center justify-center rounded-full border border-white/18 bg-transparent px-3.5 py-1.5 text-sm font-semibold text-white/84 transition group-open:hidden hover:border-white/28 hover:bg-white/8 hover:text-white">
                    + Uplatnit voucher
                  </span>
                  <span className="hidden text-sm font-medium text-white/78 group-open:inline">
                    Uplatnění voucheru
                  </span>
                </div>
              </summary>
              <div className="border-t border-white/8 px-3.5 py-3">{voucherForm}</div>
            </details>
          ) : (
            <div className="rounded-[0.95rem] border border-white/8 bg-white/[0.03] px-3.5 py-3">
              <p className="text-sm text-white/64">
                Rezervace je podle souhrnu úhrady dorovnaná, voucher není potřeba.
              </p>
            </div>
          )}
        </div>

        <VoucherRedemptionsList
          area={data.area}
          bookingId={data.id}
          redemptions={data.voucher.redemptions}
          payments={data.voucher.payments}
          hasPayments={hasRedemptions || hasDirectPayments}
        />
      </div>
    </AdminPanel>
  );
}

function PaymentSummaryBlock({
  data,
  paymentSummary,
}: {
  data: AdminBookingDetailData;
  paymentSummary: AdminBookingDetailData["voucher"]["paymentSummary"];
}) {
  const statusHeadline = getPaymentStatusHeadline(paymentSummary);
  const statusDetail = getPaymentStatusDetail(paymentSummary);
  const items = [
    { label: "Uhrazeno celkem", value: formatCzk(paymentSummary.paidTotalCzk) },
    { label: "Voucher", value: formatCzk(paymentSummary.voucherPaidCzk) },
    { label: "Mimo voucher", value: formatCzk(paymentSummary.directPaidCzk) },
    {
      label: paymentSummary.overpaidCzk > 0 ? "Přeplatek" : "Doplatek",
      value: formatCzk(paymentSummary.overpaidCzk > 0 ? paymentSummary.overpaidCzk : paymentSummary.remainingCzk),
      emphasis: true,
    },
  ];

  return (
    <div className="rounded-[0.95rem] border border-[var(--color-accent)]/26 bg-[rgba(190,160,120,0.07)] p-3">
      <div className={getPaymentStatusPanelClassName(paymentSummary.paymentStatus)}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.66rem] uppercase tracking-[0.16em] text-white/50">Stav úhrady</p>
            <p className="mt-1 text-[1.2rem] font-semibold leading-tight text-white sm:text-[1.34rem]">
              {statusHeadline}
            </p>
            <p className="mt-1 text-sm text-white/64">{statusDetail}</p>
          </div>
          <span className={getPaymentStatusBadgeClassName(paymentSummary.paymentStatus)}>
            {paymentSummary.paymentStatusLabel.toLocaleUpperCase("cs-CZ")}
          </span>
        </div>
      </div>

      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        <PriceSummaryItem data={data} paymentSummary={paymentSummary} />
        {items.map((item) => (
          <div
            key={item.label}
            className={cn(
              "rounded-[0.8rem] border px-3 py-2.5",
              item.emphasis
                ? "border-[var(--color-accent)]/24 bg-[rgba(190,160,120,0.12)]"
                : "border-white/8 bg-black/14",
            )}
          >
            <dt className="text-[0.72rem] leading-4 text-white/48">{item.label}</dt>
            <dd className={cn("mt-1 font-semibold", item.emphasis ? "text-[1.08rem] text-white" : "text-sm text-white/86")}>
              {item.value}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-2 text-[0.72rem] leading-4 text-white/38">
        Souhrn zahrnuje upravenou cenu, voucher i zapsané platby.
      </p>
    </div>
  );
}

function PriceSummaryItem({
  data,
  paymentSummary,
}: {
  data: AdminBookingDetailData;
  paymentSummary: AdminBookingDetailData["voucher"]["paymentSummary"];
}) {
  const priceAdjustment = data.priceAdjustment;
  const hasAdjustment = priceAdjustment.finalPriceCzk !== null;
  const adjustmentLabel =
    hasAdjustment ? `Upraveno z ${formatCzk(priceAdjustment.basePriceCzk)}` : "Bez úpravy";
  const differenceLabel = getPriceDifferenceLabel(priceAdjustment.adjustmentCzk);
  const cardClassName = cn(
    "rounded-[0.8rem] border px-3 py-2.5",
    hasAdjustment
      ? "border-[var(--color-accent)]/20 bg-[rgba(190,160,120,0.1)]"
      : "border-white/8 bg-black/14",
  );

  if (!priceAdjustment.canUpdate) {
    return (
      <div className={cardClassName}>
        <dt className="flex flex-wrap items-center gap-1.5 text-[0.72rem] leading-4 text-white/48">
          <span>Cena k úhradě</span>
          <span className="rounded-full border border-white/10 bg-black/16 px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-[0.12em] text-white/52">
            {adjustmentLabel}
          </span>
        </dt>
        <dd className="mt-1 font-semibold text-sm text-white/86">
          {formatCzk(paymentSummary.totalPriceCzk)}
        </dd>
      </div>
    );
  }

  return (
    <div className="sm:col-span-2">
      <dt className="sr-only">Cena k úhradě</dt>
      <dd>
        <details className="group">
          <summary className="cursor-pointer list-none marker:hidden">
            <div className={cn(cardClassName, "transition group-open:rounded-b-none group-open:border-white/12")}>
              <p className="flex flex-wrap items-center gap-1.5 text-[0.72rem] leading-4 text-white/48">
                <span>Cena k úhradě</span>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-[0.12em]",
                    hasAdjustment
                      ? "border-[var(--color-accent)]/20 bg-[rgba(190,160,120,0.12)] text-white/70"
                      : "border-white/10 bg-black/16 text-white/52",
                  )}
                >
                  {adjustmentLabel}
                </span>
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-sm font-semibold text-white/86">
                  {formatCzk(paymentSummary.totalPriceCzk)}
                </span>
                <span className="inline-flex min-h-7 items-center justify-center rounded-full border border-white/14 bg-transparent px-3 py-1 text-[0.72rem] font-semibold text-white/72 transition group-open:hidden hover:border-white/28 hover:bg-white/8 hover:text-white">
                  Upravit
                </span>
                <span className="hidden text-[0.72rem] font-medium text-white/62 group-open:inline">
                  Úprava ceny
                </span>
              </div>
            </div>
          </summary>

          <div className="rounded-b-[0.8rem] border border-t-0 border-white/12 bg-black/14 px-3 py-3">
            <dl className="grid gap-2 sm:grid-cols-3">
              <VoucherMiniRow label="Ceníková cena" value={formatCzk(priceAdjustment.basePriceCzk)} />
              <VoucherMiniRow label="Cena k úhradě" value={formatCzk(data.effectivePriceCzk)} />
              <VoucherMiniRow label="Rozdíl" value={differenceLabel} />
            </dl>
            {hasAdjustment ? (
              <div className="mt-3 rounded-[0.85rem] border border-white/7 bg-black/10 px-3 py-2">
                <p className="text-sm leading-5 text-white/64">
                  <span className="text-white/82">Důvod:</span> {priceAdjustment.reason}
                </p>
                {priceAdjustment.adjustedAtLabel ? (
                  <p className="mt-1 text-xs leading-4 text-white/40">
                    Upraveno {priceAdjustment.adjustedAtLabel}
                    {priceAdjustment.adjustedByUserLabel ? ` · ${priceAdjustment.adjustedByUserLabel}` : ""}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="mt-3 border-t border-white/8 pt-3">
              <AdminBookingPriceForm
                area={data.area}
                bookingId={data.id}
                basePriceCzk={priceAdjustment.basePriceCzk}
                finalPriceCzk={priceAdjustment.finalPriceCzk}
                reason={priceAdjustment.reason}
                variant="fields"
              />
            </div>
          </div>
        </details>
      </dd>
    </div>
  );
}

function getPriceDifferenceLabel(adjustmentCzk: number) {
  if (adjustmentCzk < 0) {
    return `Sleva ${formatCzk(Math.abs(adjustmentCzk))}`;
  }

  if (adjustmentCzk > 0) {
    return `Navýšení ${formatCzk(adjustmentCzk)}`;
  }

  return "Bez úpravy";
}

function getVoucherAmountHint(
  voucher: AdminBookingDetailData["voucher"]["intendedVoucher"],
  remainingAmountCzk: number | null,
) {
  if (!voucher || voucher.type !== VoucherType.VALUE) {
    return null;
  }

  const remainingValueCzk = voucher.remainingValueCzk ?? 0;

  if (remainingValueCzk <= 0 || remainingAmountCzk === null || remainingValueCzk >= remainingAmountCzk) {
    return null;
  }

  return `Voucher pokryje maximálně ${formatCzk(remainingValueCzk)}. Zbytek ceny služby se doplatí mimo voucher.`;
}

function VoucherMiniRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[0.8rem] border border-white/8 bg-black/14 px-3 py-2">
      <dt className="text-[0.72rem] leading-4 text-white/42">{label}</dt>
      <dd className="mt-1 text-sm leading-5 text-white/82">{value}</dd>
    </div>
  );
}

function VoucherRedemptionsList({
  area,
  bookingId,
  redemptions,
  payments,
  hasPayments,
}: {
  area: AdminBookingDetailData["area"];
  bookingId: string;
  redemptions: AdminBookingDetailData["voucher"]["redemptions"];
  payments: AdminBookingDetailData["voucher"]["payments"];
  hasPayments: boolean;
}) {
  if (!hasPayments) {
    return (
      <div className="rounded-[0.95rem] border border-dashed border-white/10 bg-white/[0.02] px-3.5 py-3">
        <p className="text-sm font-medium text-white/54">Přehled úhrad</p>
        <p className="mt-1 text-sm text-white/50">Žádné úhrady zatím nejsou evidované.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[0.78rem] font-medium uppercase tracking-[0.12em] text-white/54">
        Přehled úhrad
      </p>
      {redemptions.map((redemption) => (
        <article key={redemption.id} className="rounded-[0.95rem] border border-white/8 bg-white/[0.03] px-3.5 py-3">
          <div className="flex flex-wrap items-start justify-between gap-2.5">
            <div className="min-w-0">
              <p className="text-[0.72rem] leading-4 text-white/42">{redemption.redeemedAtLabel}</p>
              <p className="mt-1 font-mono text-sm font-semibold tracking-[0.1em] text-white">
                {redemption.voucherCode}
              </p>
              <p className="mt-1 text-sm text-white/65">{redemption.voucherTypeLabel}</p>
            </div>
            <span className="rounded-full border border-white/8 bg-black/14 px-2.5 py-1 text-sm font-semibold text-white/88">
              {formatCzk(redemption.amountCzk)}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/58">
            <span>Uplatnil: {redemption.redeemedByUserLabel}</span>
            {redemption.note ? <span>• {redemption.note}</span> : null}
          </div>
        </article>
      ))}
      {payments.map((payment) => (
        <article key={payment.id} className="rounded-[0.95rem] border border-white/8 bg-white/[0.03] px-3.5 py-3">
          <div className="flex flex-wrap items-start justify-between gap-2.5">
            <div className="min-w-0">
              <p className="text-[0.72rem] leading-4 text-white/42">{payment.paidAtLabel}</p>
              <p className="mt-1 text-sm font-semibold text-white">
                {payment.methodLabel}
              </p>
              <p className="mt-1 text-sm text-white/65">Platba mimo voucher</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="rounded-full border border-white/8 bg-black/14 px-2.5 py-1 text-sm font-semibold text-white/88">
                {payment.amountLabel}
              </span>
              {payment.canDelete ? (
                <DeleteBookingPaymentButton
                  area={area}
                  bookingId={bookingId}
                  paymentId={payment.id}
                />
              ) : null}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/58">
            <span>Zapsal: {payment.createdByUserLabel}</span>
            {payment.note ? <span>• {payment.note}</span> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function getPaymentStatusHeadline(
  paymentSummary: AdminBookingDetailData["voucher"]["paymentSummary"],
) {
  if (paymentSummary.paymentStatus === "OVERPAID") {
    return `Přeplaceno o ${formatCzk(paymentSummary.overpaidCzk)}`;
  }

  if (paymentSummary.paymentStatus === "PARTIALLY_PAID") {
    return `Zbývá doplatit ${formatCzk(paymentSummary.remainingCzk)}`;
  }

  if (paymentSummary.paymentStatus === "UNPAID") {
    return "Bez úhrady";
  }

  return "Zaplaceno";
}

function getPaymentStatusDetail(
  paymentSummary: AdminBookingDetailData["voucher"]["paymentSummary"],
) {
  if (paymentSummary.paymentStatus === "UNPAID") {
    return `K úhradě je ${formatCzk(paymentSummary.totalPriceCzk)}.`;
  }

  if (paymentSummary.paymentStatus === "OVERPAID") {
    return `Uhrazeno ${formatCzk(paymentSummary.paidTotalCzk)} při ceně ${formatCzk(paymentSummary.totalPriceCzk)}.`;
  }

  if (paymentSummary.paymentStatus === "PARTIALLY_PAID") {
    return `Uhrazeno ${formatCzk(paymentSummary.paidTotalCzk)} z ${formatCzk(paymentSummary.totalPriceCzk)}.`;
  }

  return `Celá částka ${formatCzk(paymentSummary.totalPriceCzk)} je uhrazená.`;
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
          <a href={href} className="block break-words transition hover:text-white">
            {value}
          </a>
        ) : (
          <span className="block break-words">{value}</span>
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
        <div className="min-w-0 space-y-1">
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
          <p className="break-words text-sm leading-5 text-white/66">
            {item.actorLabel} • {item.description}
          </p>
        </div>
      </div>

      {item.reason ? (
        <p className="mt-2 break-words text-sm leading-5 text-white/58">
          <span className="text-white/78">Důvod:</span> {item.reason}
        </p>
      ) : null}

      {item.note ? (
        <p className="mt-1 break-words text-sm leading-5 text-white/58">
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

function getPaymentStatusBadgeClassName(
  status: AdminBookingDetailData["voucher"]["paymentSummary"]["paymentStatus"],
) {
  switch (status) {
    case "OVERPAID":
      return "inline-flex rounded-full border border-cyan-300/35 bg-cyan-500/12 px-2.5 py-1 text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-cyan-100";
    case "PAID":
      return "inline-flex rounded-full border border-emerald-300/35 bg-emerald-500/12 px-2.5 py-1 text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-emerald-100";
    case "PARTIALLY_PAID":
      return "inline-flex rounded-full border border-amber-300/35 bg-amber-500/12 px-2.5 py-1 text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-amber-100";
    case "UNPAID":
      return "inline-flex rounded-full border border-white/12 bg-white/8 px-2.5 py-1 text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-white/72";
  }
}

function getPaymentStatusPanelClassName(
  status: AdminBookingDetailData["voucher"]["paymentSummary"]["paymentStatus"],
) {
  switch (status) {
    case "OVERPAID":
      return "rounded-[0.9rem] border border-cyan-300/26 bg-cyan-500/10 px-3 py-2.5";
    case "PAID":
      return "rounded-[0.9rem] border border-emerald-300/26 bg-emerald-500/10 px-3 py-2.5";
    case "PARTIALLY_PAID":
      return "rounded-[0.9rem] border border-amber-300/26 bg-amber-500/10 px-3 py-2.5";
    case "UNPAID":
      return "rounded-[0.9rem] border border-white/12 bg-black/24 px-3 py-2.5";
  }
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
  return buildClientPhoneHref(phone);
}

const czkFormatter = new Intl.NumberFormat("cs-CZ", {
  maximumFractionDigits: 0,
  style: "currency",
  currency: "CZK",
});

function formatCzk(value: number | null | undefined) {
  return typeof value === "number" ? czkFormatter.format(value) : "Bez částky";
}
