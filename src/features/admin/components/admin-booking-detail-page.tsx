import Link from "next/link";
import { VoucherType } from "@/generated/prisma/browser";

import { type AdminBookingDetailData } from "@/features/admin/lib/booking/booking-detail";
import { getAdminSectionPath } from "@/features/admin/lib/admin-paths";
import { buildClientPhoneHref } from "@/features/booking/lib/client-phone";
import { cn } from "@/lib/utils";

import { AdminBookingNoteForm } from "./admin-booking-note-form";
import {
  AdminBookingPaymentForm,
  DeleteBookingPaymentButton,
  EditBookingPaymentForm,
} from "./admin-booking-payment-form";
import { BookingPaymentTools } from "./booking-payment-tools";
import { AdminBookingPriceForm } from "./admin-booking-price-form";
import { AdminBookingServiceForm } from "./admin-booking-service-form";
import { AdminBookingStatusForm } from "./admin-booking-status-form";
import {
  formatCzk,
  formatDurationLabel,
  getPriceDifferenceLabel,
  getStatusContext,
} from "./admin-booking-detail-helpers";
import { AdminPanel } from "./admin-page-shell";
import { RescheduleBookingButton } from "./reschedule-booking-button";

type AdminBookingDetailPageProps = {
  data: AdminBookingDetailData;
};

const HISTORY_PREVIEW_COUNT = 1;

export function AdminBookingDetailPage({ data }: AdminBookingDetailPageProps) {
  const listHref = getAdminSectionPath(data.area, "rezervace");
  const statusContext = getStatusContext(data);
  const historyPreviewItems = data.historyItems.slice(0, HISTORY_PREVIEW_COUNT);
  const remainingHistoryItems = data.historyItems.slice(HISTORY_PREVIEW_COUNT);

  return (
    <div className="min-w-0 space-y-3">
      <BookingDetailHeader data={data} listHref={listHref} />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(19rem,0.9fr)] xl:items-start">
        <div className="min-w-0 space-y-3 xl:order-1">
          <div id="booking-notes" className="scroll-mt-28">
            <BookingNotesPanel data={data} />
          </div>
          <BookingActionPanel data={data} statusContext={statusContext} />
          <div id="booking-voucher">
            <BookingVoucherPanel data={data} />
          </div>
          <div id="booking-history">
            <BookingHistoryTimeline
              previewItems={historyPreviewItems}
              remainingItems={remainingHistoryItems}
            />
          </div>
        </div>

        <aside className="min-w-0 space-y-3 xl:order-2 xl:sticky xl:top-28">
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
  const clientPhoneHref = buildPhoneHref(data.clientPhone);
  const clientEmailHref = data.clientEmail
    ? `mailto:${data.clientEmail}`
    : null;
  const serviceDurationLabel = formatDurationLabel(
    data.reschedule.serviceDurationMinutes,
  );
  const hasClientNote = Boolean(data.clientNote?.trim());
  const hasInternalNote = Boolean(data.internalNote?.trim());
  const clientHref = `${getAdminSectionPath(data.area, "klienti")}/${data.clientId}`;

  return (
    <section
      className={cn(
        "rounded-[var(--radius-panel)] border bg-[rgba(11,11,11,0.92)] px-3 py-2.5 backdrop-blur-xl sm:px-3.5 sm:py-3",
        headerToneClassName,
      )}
    >
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-start justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={listHref}
              className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-white/76 transition hover:border-white/18 hover:bg-white/6 hover:text-white"
            >
              Zpět na rezervace
            </Link>
            <span className={getStatusBadgeClassName(data.status)}>
              {data.statusLabel}
            </span>
            <span className="rounded-full border border-white/8 px-2.5 py-1 text-[0.64rem] font-medium uppercase tracking-[0.16em] text-white/52">
              {data.sourceLabel}
            </span>
          </div>

          <div className="hidden w-full flex-wrap items-center gap-2 sm:flex sm:w-auto sm:justify-end">
            <QuickHeaderAction
              href={clientPhoneHref}
              label="Zavolat klientce"
              muted={!clientPhoneHref}
              hint={!clientPhoneHref ? "Telefon není dostupný." : undefined}
            />
            <QuickHeaderAction
              href={clientEmailHref}
              label="Napsat e-mail"
              muted={!clientEmailHref}
              hint={!clientEmailHref ? "E-mail není dostupný." : undefined}
            />
            {data.reschedule.enabled ? (
              <RescheduleBookingButton
                area={data.area}
                bookingId={data.id}
                serviceId={data.reschedule.serviceId}
                serviceName={data.serviceName}
                serviceDurationMinutes={data.reschedule.serviceDurationMinutes}
                cleanupBlockMinutes={data.reschedule.cleanupBlockMinutes}
                currentScheduledAtLabel={data.scheduledAtLabel}
                currentStartsAt={data.reschedule.currentStartsAt}
                expectedUpdatedAt={data.reschedule.expectedUpdatedAt}
                rescheduleCount={data.rescheduleCount}
                slots={data.reschedule.slots}
                scheduleOptimization={data.reschedule.scheduleOptimization}
                variant="inline"
              />
            ) : (
              <span className="text-xs text-white/60">Uzavřenou rezervaci nelze přesunout.</span>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-[0.62rem] uppercase tracking-[0.2em] text-[var(--color-accent-soft)]">
            {data.area === "owner"
              ? "Detail rezervace"
              : "Provozní detail rezervace"}
          </p>
          <h1 className="font-display text-[1.18rem] leading-tight sm:text-[1.34rem]">
            <Link
              href={clientHref}
              className="text-white transition hover:text-[var(--color-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/55"
            >
              {data.clientName}
            </Link>
          </h1>
          <p className="text-sm text-white/72">
            {data.serviceName}
            <span className="mx-1.5 text-white/38">·</span>
            {serviceDurationLabel}
          </p>
          <p className="text-lg font-semibold text-white">{data.scheduledAtLabel}</p>
          {data.cleanup.cleanupBlockMinutes > 0 ? (
            <p className="text-sm text-white/68">
              Úklid: {data.cleanup.cleanupLabel} · Blokováno do {data.cleanup.blockedUntilLabel}
            </p>
          ) : null}
          {hasClientNote || hasInternalNote ? (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {hasClientNote ? <NotePresenceBadge kind="client" /> : null}
              {hasInternalNote ? <NotePresenceBadge kind="internal" /> : null}
            </div>
          ) : null}
          <div className="flex w-full flex-wrap items-center gap-2 sm:hidden">
            <QuickHeaderAction
              href={clientPhoneHref}
              label="Zavolat klientce"
              muted={!clientPhoneHref}
              hint={!clientPhoneHref ? "Telefon není dostupný." : undefined}
            />
            <QuickHeaderAction
              href={clientEmailHref}
              label="Napsat e-mail"
              muted={!clientEmailHref}
              hint={!clientEmailHref ? "E-mail není dostupný." : undefined}
            />
            {data.reschedule.enabled ? (
              <RescheduleBookingButton
                area={data.area}
                bookingId={data.id}
                serviceId={data.reschedule.serviceId}
                serviceName={data.serviceName}
                serviceDurationMinutes={data.reschedule.serviceDurationMinutes}
                cleanupBlockMinutes={data.reschedule.cleanupBlockMinutes}
                currentScheduledAtLabel={data.scheduledAtLabel}
                currentStartsAt={data.reschedule.currentStartsAt}
                expectedUpdatedAt={data.reschedule.expectedUpdatedAt}
                rescheduleCount={data.rescheduleCount}
                slots={data.reschedule.slots}
                scheduleOptimization={data.reschedule.scheduleOptimization}
                variant="inline"
              />
            ) : (
              <span className="text-xs text-white/60">Uzavřenou rezervaci nelze přesunout.</span>
            )}
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
      <div className="space-y-2.5">
        {data.availableActions.length > 0 ? (
          <p className="text-sm text-white/72">{statusContext.title}</p>
        ) : null}

        <AdminBookingStatusForm
          area={data.area}
          bookingId={data.id}
          availableActions={data.availableActions}
          bookingStatus={data.status}
          clientEmail={data.clientEmail}
          initialVoucherCode={
            data.voucher.intendedVoucher?.code ??
            data.voucher.intendedVoucherCodeSnapshot ??
            ""
          }
          remainingPaymentCzk={data.voucher.paymentSummary.remainingCzk}
          totalPriceCzk={
            data.voucher.paymentSummary.totalPriceCzk ?? data.effectivePriceCzk
          }
          servicePriceCzk={data.priceAdjustment.basePriceCzk}
          directPaidCzk={data.voucher.paymentSummary.directPaidCzk}
          voucherPaidCzk={data.voucher.paymentSummary.voucherPaidCzk}
          accountingVoucherPaidCzk={data.voucher.paymentSummary.voucherRedemptionCzk}
          overpaidCzk={data.voucher.paymentSummary.overpaidCzk}
        />

        {data.reschedule.enabled ? (
          <AdminBookingServiceForm
            area={data.area}
            bookingId={data.id}
            expectedUpdatedAt={data.reschedule.expectedUpdatedAt}
            currentServiceId={data.serviceId}
            scheduledStartsAt={data.reschedule.currentStartsAt}
            clientEmail={data.clientEmail}
            services={data.availableServices}
          />
        ) : null}
      </div>
    </AdminPanel>
  );
}

function BookingSummaryCard({ data }: { data: AdminBookingDetailData }) {
  const items = [
    {
      label: "Telefon",
      value: data.clientPhone,
      href: buildPhoneHref(data.clientPhone),
      tone: "strong" as const,
    },
    {
      label: "E-mail",
      value: data.clientEmail || "Bez e-mailu",
      href: data.clientEmail ? `mailto:${data.clientEmail}` : undefined,
    },
  ];

  return (
    <AdminPanel
      title="Kontakt na klientku"
      compact={data.area === "salon"}
      denseHeader
    >
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
    { label: "Přesuny", value: `${data.rescheduleCount}×` },
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
    <AdminPanel
      title="Technická metadata"
      compact={data.area === "salon"}
      denseHeader
    >
      <details className="group overflow-hidden rounded-[1rem] border border-white/7 bg-white/[0.025]">
        <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-medium text-white/72">
          Auditní a akviziční údaje
        </summary>
        <dl className="divide-y divide-white/6 border-t border-white/7">
          {items.map((item) => (
            <SummaryRow
              key={item.label}
              label={item.label}
              value={item.value}
              muted
            />
          ))}
        </dl>
      </details>
    </AdminPanel>
  );
}

function BookingNotesPanel({ data }: { data: AdminBookingDetailData }) {
  const hasNotes = Boolean(data.clientNote?.trim() || data.internalNote?.trim());

  return (
    <details className="rounded-[var(--radius-panel)] border border-white/10 bg-white/[0.03]">
      <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-medium text-white/82">
        Poznámky{!hasNotes ? " · Přidat interní poznámku" : ""}
        {data.clientNote?.trim() ? (
          <span className="mt-1 line-clamp-2 break-words text-sm font-normal text-white/72">
            Klientka: {data.clientNote}
          </span>
        ) : null}
        {data.internalNote?.trim() ? (
          <span className="mt-1 line-clamp-2 break-words text-sm font-normal text-white/72">
            Interní: {data.internalNote}
          </span>
        ) : null}
      </summary>
      <div className="space-y-3 border-t border-white/8 p-3">
        {data.clientNote?.trim() ? (
          <CompactNoteBlock label="Poznámka od klientky" value={data.clientNote} tone="default" />
        ) : null}
        <p className="text-xs text-white/68">Interní poznámku vidí pouze tým.</p>
        <AdminBookingNoteForm
          area={data.area}
          bookingId={data.id}
          expectedUpdatedAt={data.reschedule.expectedUpdatedAt}
          initialValue={data.internalNote ?? ""}
        />
      </div>
    </details>
  );
}

function BookingVoucherPanel({ data }: { data: AdminBookingDetailData }) {
  const intendedVoucher = data.voucher.intendedVoucher;
  const paymentSummary = data.voucher.paymentSummary;
  const hasRedemptions = data.voucher.redemptions.length > 0;

  return (
    <AdminPanel title="Úhrada" compact={data.area === "salon"} denseHeader>
      <div className="space-y-2.5">
        <PaymentSummaryBlock paymentSummary={paymentSummary} />

        <BookingPaymentTools
          paymentForm={paymentSummary.remainingCzk > 0 ? (
            <AdminBookingPaymentForm
              area={data.area}
              bookingId={data.id}
              defaultAmountCzk={paymentSummary.remainingCzk}
              variant="fields"
            />
          ) : null}
          priceForm={data.priceAdjustment.canUpdate ? <PriceSummaryItem data={data} /> : null}
        />

        {data.voucher.payments.length > 0 ? (
          <details className="col-span-full min-w-0 rounded-[0.95rem] border border-white/8">
            <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-medium text-white/78">
              Podrobnosti plateb ({data.voucher.payments.length})
            </summary>
            <div className="border-t border-white/8 p-3">
              <DirectPaymentsList
                area={data.area}
                bookingId={data.id}
                payments={data.voucher.payments}
              />
            </div>
          </details>
        ) : null}

        {intendedVoucher || data.voucher.intendedVoucherCodeSnapshot || hasRedemptions ? (
          <div className="space-y-2">
            {intendedVoucher ? (
              <div className="rounded-[0.95rem] border border-[var(--color-accent)]/16 bg-[rgba(190,160,120,0.06)] p-3">
                <div className="flex flex-wrap items-start justify-between gap-2.5">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium text-white/90">
                      Voucher uvedený při rezervaci
                    </p>
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
                <p className="mt-2 text-sm text-white/72">
                  {intendedVoucher.type === VoucherType.VALUE
                    ? `Zůstatek: ${intendedVoucher.remainingLabel}`
                    : intendedVoucher.valueLabel}
                </p>
                <details className="mt-2 border-t border-white/8">
                  <summary className="min-h-11 cursor-pointer py-3 text-sm text-white/78">
                    Podrobnosti voucheru
                  </summary>
                  <dl className="grid gap-2 sm:grid-cols-2">
                    <VoucherMiniRow label="Typ" value={intendedVoucher.typeLabel} />
                    <VoucherMiniRow
                      label="Hodnota / služba"
                      value={intendedVoucher.valueLabel}
                    />
                    {intendedVoucher.type === VoucherType.VALUE ? (
                      <VoucherMiniRow
                        label="Zůstatek"
                        value={intendedVoucher.remainingLabel}
                      />
                    ) : null}
                    <VoucherMiniRow
                      label="Ověřeno"
                      value={
                        data.voucher.intendedVoucherValidatedAtLabel ??
                        "Při rezervaci"
                      }
                    />
                  </dl>
                </details>
                {!hasRedemptions ? (
                  <p className="mt-3 border-t border-white/8 pt-3 text-sm leading-5 text-white/56">
                    Zatím neuplatněný. Čerpání zapiš při dokončení návštěvy.
                  </p>
                ) : null}
              </div>
            ) : data.voucher.intendedVoucherCodeSnapshot ? (
              <div className="rounded-[0.95rem] border border-white/8 bg-white/[0.035] px-3.5 py-3">
                <p className="text-sm leading-5 text-white/70">
                  U rezervace je uložený kód voucheru{" "}
                  <span className="font-mono text-white">
                    {data.voucher.intendedVoucherCodeSnapshot}
                  </span>
                  , ale není napojený na aktivní voucher v evidenci.
                </p>
              </div>
            ) : null}
            {hasRedemptions ? (
              <details className="rounded-[0.95rem] border border-white/8">
                <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm text-white/78">
                  Čerpání voucherů ({data.voucher.redemptions.length})
                </summary>
                <div className="border-t border-white/8 p-3">
                  <VoucherRedemptionsList redemptions={data.voucher.redemptions} />
                </div>
              </details>
            ) : null}
          </div>
        ) : null}
      </div>
    </AdminPanel>
  );
}

function PriceSummaryItem({ data }: { data: AdminBookingDetailData }) {
  const priceAdjustment = data.priceAdjustment;
  const hasAdjustment = priceAdjustment.finalPriceCzk !== null;
  const differenceLabel = getPriceDifferenceLabel(
    priceAdjustment.adjustmentCzk,
  );

  if (!priceAdjustment.canUpdate) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/68">
        <span>Ceníková cena: {formatCzk(priceAdjustment.basePriceCzk)}</span>
        {hasAdjustment ? <span>{differenceLabel}</span> : null}
      </p>
      {hasAdjustment ? (
        <div className="rounded-[0.85rem] border border-white/7 bg-black/10 px-3 py-2">
          <p className="text-sm leading-5 text-white/64">
            <span className="text-white/82">Důvod:</span>{" "}
            {priceAdjustment.reason}
          </p>
          {priceAdjustment.adjustedAtLabel ? (
            <p className="mt-1 text-xs leading-4 text-white/40">
              Upraveno {priceAdjustment.adjustedAtLabel}
              {priceAdjustment.adjustedByUserLabel
                ? ` · ${priceAdjustment.adjustedByUserLabel}`
                : ""}
            </p>
          ) : null}
        </div>
      ) : null}
      <AdminBookingPriceForm
        area={data.area}
        bookingId={data.id}
        expectedUpdatedAt={data.reschedule.expectedUpdatedAt}
        basePriceCzk={priceAdjustment.basePriceCzk}
        finalPriceCzk={priceAdjustment.finalPriceCzk}
        reason={priceAdjustment.reason}
        directPaidCzk={data.voucher.paymentSummary.directPaidCzk}
        voucherPaidCzk={data.voucher.paymentSummary.voucherPaidCzk}
        variant="fields"
      />
    </div>
  );
}

function PaymentSummaryBlock({
  paymentSummary,
}: {
  paymentSummary: AdminBookingDetailData["voucher"]["paymentSummary"];
}) {
  const hasOverpayment = paymentSummary.overpaidCzk > 0;
  const isSettled = !hasOverpayment && paymentSummary.remainingCzk === 0;
  const hasKnownPrice = paymentSummary.totalPriceCzk !== null;
  const dueLabel = hasOverpayment ? "Přeplatek" : "Zbývá uhradit";

  return (
    <div className={cn(
      "rounded-[0.95rem] border px-3 py-2.5",
      hasOverpayment
        ? "border-amber-300/25 bg-amber-400/10"
        : isSettled && hasKnownPrice
          ? "border-emerald-300/25 bg-emerald-400/10"
          : "border-[var(--color-accent)]/26 bg-[rgba(190,160,120,0.07)]",
    )}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-medium text-white/78">
          {!hasKnownPrice ? "Cena není stanovena" : isSettled ? "Stav úhrady" : dueLabel}
        </p>
        <p className="text-xl font-semibold leading-tight text-white">
          {!hasKnownPrice
            ? "Bez částky"
            : isSettled
              ? "Uhrazeno"
              : formatCzk(hasOverpayment ? paymentSummary.overpaidCzk : paymentSummary.remainingCzk)}
        </p>
      </div>
      <dl className="mt-2 grid gap-x-4 gap-y-1 border-t border-white/10 pt-2 sm:grid-cols-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
          <dt className="text-xs text-white/68">Cena celkem</dt>
          <dd className="text-sm font-medium text-white/88">
            {formatCzk(paymentSummary.totalPriceCzk)}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
          <dt className="text-xs text-white/68">Zaplaceno přímo</dt>
          <dd className="text-sm font-medium text-white/88">
            {formatCzk(paymentSummary.directPaidCzk)}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
          <dt className="text-xs text-white/68">Pokryto voucherem</dt>
          <dd className="text-sm font-medium text-white/88">
            {formatCzk(paymentSummary.voucherPaidCzk)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function VoucherMiniRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[0.8rem] border border-white/8 bg-black/14 px-3 py-2">
      <dt className="text-xs leading-4 text-white/60">{label}</dt>
      <dd className="mt-1 text-sm leading-5 text-white/82">{value}</dd>
    </div>
  );
}

function VoucherRedemptionsList({
  redemptions,
}: {
  redemptions: AdminBookingDetailData["voucher"]["redemptions"];
}) {
  return (
    <div className="space-y-2">
      {redemptions.map((redemption) => (
        <article
          key={redemption.id}
          className="rounded-[0.95rem] border border-white/8 bg-white/[0.03] px-3.5 py-3"
        >
          <div className="flex flex-wrap items-start justify-between gap-2.5">
            <div className="min-w-0">
              <p className="text-xs leading-4 text-white/60">
                {redemption.redeemedAtLabel}
              </p>
              <p className="mt-1 font-mono text-sm font-semibold tracking-[0.1em] text-white">
                {redemption.voucherCode}
              </p>
              <p className="mt-1 text-sm text-white/65">
                {redemption.voucherTypeLabel}
              </p>
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
    </div>
  );
}

function DirectPaymentsList({
  area,
  bookingId,
  payments,
}: {
  area: AdminBookingDetailData["area"];
  bookingId: string;
  payments: AdminBookingDetailData["voucher"]["payments"];
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-white/74">Přímé platby</p>
      {payments.length === 0 ? (
        <div className="rounded-[0.95rem] border border-dashed border-white/10 bg-white/[0.02] px-3.5 py-3">
          <p className="text-sm text-white/54">
            Zatím nebyla zaznamenána žádná přímá platba.
          </p>
        </div>
      ) : (
        payments.map((payment) => (
          <article
            id={`payment-${payment.id}`}
            key={payment.id}
            className={cn(
              "rounded-[0.95rem] border px-3.5 py-3",
              payment.status === "VOIDED"
                ? "border-red-300/20 bg-red-500/[0.055]"
                : "border-white/8 bg-white/[0.03]",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-2.5">
              <div className="min-w-0">
                <p className="text-xs leading-4 text-white/60">
                  {payment.paidAtLabel}
                </p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {payment.methodLabel}
                </p>
                <p className="mt-1 text-sm text-white/65">
                  {payment.status === "VOIDED"
                    ? "Stornovaná platba — nezapočítává se do úhrady"
                    : "Přímá platba"}
                </p>
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
              <span>
                Zapsal: {payment.createdByUserLabel} · {payment.createdAtLabel}
              </span>
              {payment.lastEditedByUserLabel && payment.lastEditedAtLabel ? (
                <span>
                  • Naposledy upravil: {payment.lastEditedByUserLabel} ·{" "}
                  {payment.lastEditedAtLabel}
                </span>
              ) : null}
              {payment.note ? (
                <span className="break-words">• Poznámka: {payment.note}</span>
              ) : null}
              {payment.status === "VOIDED" ? (
                <span className="font-medium text-red-100/84">
                  • Stornoval(a): {payment.voidedByUserLabel} ·{" "}
                  {payment.voidedAtLabel} · Důvod: {payment.voidReason}
                </span>
              ) : null}
            </div>
            {payment.canEdit ? (
              <div className="mt-2">
                <EditBookingPaymentForm
                  area={area}
                  bookingId={bookingId}
                  paymentId={payment.id}
                  amountCzk={payment.amountCzk}
                  method={payment.method}
                  paidAt={payment.paidAt}
                  note={payment.note}
                  expectedUpdatedAt={payment.updatedAt}
                />
              </div>
            ) : null}
          </article>
        ))
      )}
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
          <p className="text-sm text-white/64">
            Historie změn zatím není k dispozici.
          </p>
        </div>
      </AdminPanel>
    );
  }

  return (
    <AdminPanel title="Historie změn" denseHeader>
      <div className="rounded-[1rem] border border-white/7 bg-white/[0.02] p-2">
        <div className="space-y-2">
          {previewItems.map((item) => (
            <HistoryItem key={item.id} item={item} />
          ))}

          {remainingItems.length > 0 ? (
            <details className="group rounded-[1rem] border border-white/8 bg-white/[0.03]">
              <summary className="min-h-11 cursor-pointer px-3.5 py-3 text-sm font-medium text-white/78">
                <span className="group-open:hidden">
                  Zobrazit celou historii ({remainingItems.length})
                </span>
                <span className="hidden group-open:inline">
                  Skrýt starší položky
                </span>
              </summary>
              <div className="space-y-2 border-t border-white/8 px-3.5 py-3">
                {remainingItems.map((item) => (
                  <HistoryItem key={item.id} item={item} />
                ))}
              </div>
            </details>
          ) : null}
        </div>
      </div>
    </AdminPanel>
  );
}

function SummaryRow({
  label,
  value,
  href,
  tone = "default",
  muted = false,
}: {
  label: string;
  value: string;
  href?: string | null;
  tone?: "default" | "accent" | "strong";
  muted?: boolean;
}) {
  const valueClassName = muted
    ? "text-white/54"
    : tone === "accent"
      ? "font-medium text-[var(--color-accent-soft)]"
      : tone === "strong"
        ? "font-medium text-white"
        : "text-white/76";

  return (
    <div className="grid gap-1 px-3.5 py-3 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:items-start sm:gap-3">
      <dt
        className={cn(
          "text-xs font-medium",
          muted ? "text-white/60" : "text-white/68",
        )}
      >
        {label}
      </dt>
      <dd className={cn("min-w-0 text-sm leading-5", valueClassName)}>
        {href ? (
          <a
            href={href}
            className="block break-words transition hover:text-white"
          >
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
      <p className="text-xs font-medium text-white/68">
        {label}
      </p>
      <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-5 text-white/78">
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
            <span
              className={cn(
                getHistoryBadgeClassName(item.badgeTone),
                "text-[0.64rem]",
              )}
            >
              {item.badgeLabel}
            </span>
            {item.sourceLabel ? (
              <span className="rounded-full border border-white/8 px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.16em] text-white/44">
                {item.sourceLabel}
              </span>
            ) : null}
          </div>
          <p className="text-sm font-medium text-white/88">
            {item.createdAtLabel}
          </p>
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
  hint,
}: {
  href: string | null;
  label: string;
  muted?: boolean;
  hint?: string;
}) {
  const className = cn(
    "inline-flex min-h-11 items-center justify-center rounded-full border px-3 py-1.5 text-sm transition",
    muted
      ? "border-white/8 bg-white/[0.03] text-white/42"
      : "border-white/10 bg-black/16 text-white/76 hover:border-white/18 hover:bg-white/6 hover:text-white",
  );

  if (!href) {
    return (
      <span className={className} title={hint}>
        {label}
      </span>
    );
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

function NotePresenceBadge({ kind }: { kind: "client" | "internal" }) {
  const label = kind === "client" ? "Klientská poznámka" : "Interní poznámka";
  const className =
    kind === "client"
      ? "rounded-full border border-amber-300/36 bg-amber-500/14 px-2.5 py-1 text-[0.64rem] font-semibold uppercase tracking-[0.12em] text-amber-100"
      : "rounded-full border border-cyan-300/32 bg-cyan-500/12 px-2.5 py-1 text-[0.64rem] font-semibold uppercase tracking-[0.12em] text-cyan-100";

  return <span className={className}>{label}</span>;
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

function getHistoryBadgeClassName(
  status: AdminBookingDetailData["historyItems"][number]["badgeTone"],
) {
  if (status === "RESCHEDULED") {
    return "inline-flex rounded-full border border-[var(--color-accent)]/35 bg-[rgba(190,160,120,0.14)] px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent-soft)]";
  }

  return getStatusBadgeClassName(status);
}

function buildPhoneHref(phone: string) {
  return buildClientPhoneHref(phone);
}
