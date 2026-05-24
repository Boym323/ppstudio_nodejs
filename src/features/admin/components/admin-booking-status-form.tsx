"use client";

import { type ReactNode } from "react";
import { useActionState, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { VoucherType } from "@prisma/client";

import {
  completeBookingVisitAction,
  updateBookingStatusAction,
} from "@/features/admin/actions/booking-actions";
import { initialCompleteBookingVisitActionState } from "@/features/admin/actions/complete-booking-visit-action-state";
import { initialUpdateBookingStatusActionState } from "@/features/admin/actions/update-booking-status-action-state";
import {
  type AdminBookingActionOption,
  type AdminBookingActionValue,
} from "@/features/admin/lib/admin-booking";
import { type AdminArea } from "@/config/navigation";
import { cn } from "@/lib/utils";

const czkFormatter = new Intl.NumberFormat("cs-CZ", {
  maximumFractionDigits: 0,
  style: "currency",
  currency: "CZK",
});

type AdminBookingStatusFormProps = {
  area: AdminArea;
  bookingId: string;
  bookingStatus: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  availableActions: AdminBookingActionOption[];
  initialVoucherCode?: string;
  secondaryActionSlot?: ReactNode;
  remainingPaymentCzk?: number;
};

export function AdminBookingStatusForm({
  area,
  bookingId,
  bookingStatus,
  availableActions,
  initialVoucherCode = "",
  secondaryActionSlot,
  remainingPaymentCzk = 0,
}: AdminBookingStatusFormProps) {
  const operationalActions = availableActions.filter((action) => action.value !== "CANCELLED");
  const dangerAction = availableActions.find((action) => action.value === "CANCELLED");
  const [selectedAction, setSelectedAction] = useState<AdminBookingActionValue | "">(
    operationalActions[0]?.value ?? dangerAction?.value ?? "",
  );
  const [serverState, formAction] = useActionState(
    updateBookingStatusAction,
    initialUpdateBookingStatusActionState,
  );
  const [completeState, completeAction] = useActionState(
    completeBookingVisitAction,
    initialCompleteBookingVisitActionState,
  );
  const [completionMode, setCompletionMode] = useState<
    "cash" | "qr" | "voucher" | "combined" | "no_payment" | "settled"
  >("cash");
  const [voucherCodeInput, setVoucherCodeInput] = useState(initialVoucherCode);
  const [voucherAmountInput, setVoucherAmountInput] = useState("");
  const [voucherLookup, setVoucherLookup] = useState<{
    status: "idle" | "loading" | "success" | "error";
    message?: string;
  }>({
    status: "idle",
  });
  const voucherLookupRequestIdRef = useRef(0);
  const voucherLookupAbortControllerRef = useRef<AbortController | null>(null);
  const selectedActionOption = availableActions.find((action) => action.value === selectedAction);
  const hasRemainingPayment = remainingPaymentCzk > 0;
  const helperText = useMemo(() => getClosedStateHelper(bookingStatus), [bookingStatus]);

  async function handleLoadVoucherInfo() {
    const normalizedCode = voucherCodeInput.trim();
    if (!normalizedCode) {
      setVoucherLookup({
        status: "error",
        message: "Nejdřív zadej kód voucheru.",
      });
      return;
    }

    voucherLookupAbortControllerRef.current?.abort();
    const requestId = voucherLookupRequestIdRef.current + 1;
    voucherLookupRequestIdRef.current = requestId;
    const controller = new AbortController();
    voucherLookupAbortControllerRef.current = controller;

    setVoucherLookup({ status: "loading" });
    try {
      const response = await fetchVoucherLookup({
        voucherCode: normalizedCode,
        signal: controller.signal,
      });
      if (voucherLookupRequestIdRef.current !== requestId) {
        return;
      }

      const payload = (await response.json().catch(() => null)) as
        | {
            status?: string;
            message?: string;
            voucher?: {
              type?: VoucherType;
              statusLabel?: string;
              remainingValueCzk?: number | null;
              serviceNameSnapshot?: string | null;
              servicePriceSnapshotCzk?: number | null;
            };
          }
        | null;

      if (!response.ok || payload?.status !== "success" || !payload.voucher) {
        setVoucherLookup({
          status: "error",
          message: payload?.message ?? "Voucher se nepodařilo načíst.",
        });
        return;
      }

      if (payload.voucher.type === VoucherType.VALUE) {
        const remainingValue = Math.max(0, payload.voucher.remainingValueCzk ?? 0);
        const recommendedAmount = Math.max(0, Math.min(remainingPaymentCzk, remainingValue));
        setVoucherAmountInput(recommendedAmount > 0 ? String(recommendedAmount) : "");
        setVoucherLookup({
          status: "success",
          message: `Zůstatek voucheru: ${formatCzk(remainingValue)} · Stav: ${payload.voucher.statusLabel}`,
        });
        return;
      }

      const servicePriceLabel =
        payload.voucher.servicePriceSnapshotCzk && payload.voucher.servicePriceSnapshotCzk > 0
          ? ` (${formatCzk(payload.voucher.servicePriceSnapshotCzk)})`
          : "";
      const serviceName = payload.voucher.serviceNameSnapshot ?? "uložená služba";
      setVoucherLookup({
        status: "success",
        message: `Voucher na službu: ${serviceName}${servicePriceLabel} · Stav: ${payload.voucher.statusLabel}`,
      });
    } catch (error) {
      if (voucherLookupRequestIdRef.current !== requestId) {
        return;
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      console.warn("Voucher lookup failed in completion panel", {
        voucherCode: normalizedCode,
        requestId,
        error: getErrorDiagnostics(error),
      });
      setVoucherLookup({
        status: "error",
        message:
          "Voucher se teď nepodařilo načíst kvůli síťové chybě. Zkus to prosím znovu.",
      });
    } finally {
      if (voucherLookupAbortControllerRef.current === controller) {
        voucherLookupAbortControllerRef.current = null;
      }
    }
  }

  if (availableActions.length === 0) {
    return (
      <div className="rounded-[1rem] border border-white/8 bg-white/[0.035] p-3.5">
        <p className="text-sm font-medium text-white">{helperText.title}</p>
        <p className="mt-1 text-sm leading-5 text-white/62">{helperText.description}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href="#booking-history"
            className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-white/76 transition hover:border-white/18 hover:bg-white/6 hover:text-white"
          >
            Otevřít historii
          </a>
          {bookingStatus === "NO_SHOW" ? (
            <a
              href="#booking-notes"
              className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-white/76 transition hover:border-white/18 hover:bg-white/6 hover:text-white"
            >
              Upravit poznámku
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <form
      action={selectedAction === "COMPLETED" ? completeAction : formAction}
      className="space-y-2.5"
      id="booking-actions"
    >
      <input type="hidden" name="area" value={area} />
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="targetStatus" value={selectedAction} />

      {serverState.status === "success" && serverState.successMessage ? (
        <div className="rounded-[0.95rem] border border-emerald-300/16 bg-emerald-400/10 px-3 py-2 text-sm leading-5 text-emerald-50">
          {serverState.successMessage}
        </div>
      ) : null}

      {serverState.status === "error" && serverState.formError ? (
        <div className="rounded-[0.95rem] border border-red-300/16 bg-red-400/10 px-3 py-2 text-sm leading-5 text-red-50">
          {serverState.formError}
        </div>
      ) : null}

      {operationalActions.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-white">Provozní akce</legend>

          <div
            className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1fr)]"
          >
            {operationalActions.map((action, index) => {
              const isSelected = selectedAction === action.value;
              const isPrimary = index === 0;

              return (
                <button
                  key={action.value}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedAction(action.value)}
                  className={getActionButtonClassName(action.value, isSelected, isPrimary)}
                >
                  <span className="text-left">
                    <span className={cn("block font-semibold text-white", isPrimary ? "text-base" : "text-sm")}>
                      {getActionLabel(action)}
                    </span>
                    <span className="mt-1 block text-sm leading-5 text-white/62">
                      {action.value === "COMPLETED"
                        ? hasRemainingPayment
                          ? `Doplatek: ${new Intl.NumberFormat("cs-CZ", {
                              maximumFractionDigits: 0,
                              style: "currency",
                              currency: "CZK",
                            }).format(remainingPaymentCzk)}`
                          : "Platba vyřešena"
                        : action.description}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.16em]",
                      isSelected
                        ? "border border-white/16 bg-white/10 text-white"
                        : isPrimary
                          ? "border border-[var(--color-accent)]/24 bg-black/18 text-[var(--color-accent-soft)]"
                          : "border border-white/8 text-white/48",
                    )}
                  >
                    {isSelected ? "Vybráno" : isPrimary ? "Hlavní" : "Vedlejší"}
                  </span>
                </button>
              );
            })}
            {secondaryActionSlot ? (
              <div className="min-h-20">{secondaryActionSlot}</div>
            ) : null}
          </div>

          {serverState.fieldErrors?.targetStatus ? (
            <p className="text-sm text-red-300">{serverState.fieldErrors.targetStatus}</p>
          ) : null}
        </fieldset>
      ) : null}

      {selectedAction === "COMPLETED" ? (
        <div className="rounded-[0.95rem] border border-white/8 bg-white/[0.03] px-3 py-2.5">
          <input type="hidden" name="completionMode" value={hasRemainingPayment ? completionMode : "settled"} />

          <p className="text-sm font-semibold text-white">Dokončení návštěvy</p>
          <p className="mt-1 text-sm text-white/72">
            {hasRemainingPayment
              ? `Doplatek: ${new Intl.NumberFormat("cs-CZ", {
                  maximumFractionDigits: 0,
                  style: "currency",
                  currency: "CZK",
                }).format(remainingPaymentCzk)}`
              : "Platba vyřešena"}
          </p>
          <p className="mt-1 text-xs text-white/52">
            Potřebuješ ruční opravu plateb nebo detailní rozpad? Použij sekci{" "}
            <a href="#booking-voucher" className="underline underline-offset-2 hover:text-white">
              Úhrada
            </a>
            .
          </p>

          {hasRemainingPayment ? (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {[
                ["cash", "Hotově"],
                ["qr", "QR platba"],
                ["voucher", "Voucher"],
                ["combined", "Kombinovaně"],
                ["no_payment", "Bez platby"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={completionMode === value}
                  onClick={() => setCompletionMode(value as typeof completionMode)}
                  className={cn(
                    "rounded-[0.8rem] border px-3 py-2 text-left text-sm transition",
                    completionMode === value
                      ? "border-[var(--color-accent)]/50 bg-[rgba(190,160,120,0.16)] text-white"
                      : "border-white/10 bg-black/16 text-white/78 hover:border-white/16",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          {(completionMode === "cash" || completionMode === "qr" || completionMode === "combined") && hasRemainingPayment ? (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-white">Částka</span>
                <input
                  type="number"
                  name="directAmountCzk"
                  min={1}
                  step={1}
                  defaultValue={remainingPaymentCzk > 0 ? remainingPaymentCzk : undefined}
                  className="mt-1.5 w-full rounded-[0.85rem] border border-white/8 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-accent)]/55"
                />
                {completeState.fieldErrors?.directAmountCzk ? (
                  <p className="mt-1 text-xs text-red-300">{completeState.fieldErrors.directAmountCzk}</p>
                ) : null}
              </label>
              {completionMode === "combined" ? (
                <label className="block">
                  <span className="text-xs font-medium text-white">Metoda doplatku mimo voucher</span>
                  <select
                    name="directMethod"
                    defaultValue="CASH"
                    className="mt-1.5 w-full rounded-[0.85rem] border border-white/8 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-accent)]/55"
                  >
                    <option value="CASH" className="bg-neutral-950 text-white">Hotově</option>
                    <option value="BANK_TRANSFER" className="bg-neutral-950 text-white">Převodem / QR</option>
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}

          {(completionMode === "voucher" || completionMode === "combined") && hasRemainingPayment ? (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-white">Kód voucheru</span>
                <input
                  type="text"
                  name="voucherCode"
                  maxLength={64}
                  value={voucherCodeInput}
                  onChange={(event) => setVoucherCodeInput(event.currentTarget.value)}
                  className="mt-1.5 w-full rounded-[0.85rem] border border-white/8 bg-black/20 px-3 py-2 text-sm uppercase text-white outline-none focus:border-[var(--color-accent)]/55"
                />
                {completeState.fieldErrors?.voucherCode ? (
                  <p className="mt-1 text-xs text-red-300">{completeState.fieldErrors.voucherCode}</p>
                ) : null}
              </label>
              <label className="block">
                <span className="text-xs font-medium text-white">Částka voucheru</span>
                <input
                  type="number"
                  name="voucherAmountCzk"
                  min={1}
                  step={1}
                  value={voucherAmountInput}
                  onChange={(event) => setVoucherAmountInput(event.currentTarget.value)}
                  className="mt-1.5 w-full rounded-[0.85rem] border border-white/8 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-accent)]/55"
                />
                {completeState.fieldErrors?.voucherAmountCzk ? (
                  <p className="mt-1 text-xs text-red-300">{completeState.fieldErrors.voucherAmountCzk}</p>
                ) : null}
              </label>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={handleLoadVoucherInfo}
                  disabled={voucherLookup.status === "loading"}
                  className="rounded-full border border-white/18 px-3 py-1.5 text-xs font-semibold text-white/82 transition hover:border-white/30 hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {voucherLookup.status === "loading" ? "Načítám voucher..." : "Načíst voucher"}
                </button>
                {voucherLookup.message ? (
                  <p
                    className={cn(
                      "mt-1.5 text-xs",
                      voucherLookup.status === "error" ? "text-red-300" : "text-white/62",
                    )}
                  >
                    {voucherLookup.message}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <ReasonField
              selectedAction={selectedAction}
              fieldError={completeState.fieldErrors?.reason}
              compact
              label={completionMode === "no_payment" ? "Povinný důvod" : "Volitelný důvod"}
            />
            <CompleteVisitSubmitButton
              completionMode={hasRemainingPayment ? completionMode : "settled"}
            />
          </div>

          {completeState.status === "error" && completeState.formError ? (
            <p className="mt-2 text-sm text-red-300">{completeState.formError}</p>
          ) : null}
          {completeState.status === "success" && completeState.successMessage ? (
            <p className="mt-2 text-sm text-emerald-200">{completeState.successMessage}</p>
          ) : null}
        </div>
      ) : selectedAction !== "CANCELLED" ? (
        <div className="rounded-[0.95rem] border border-white/8 bg-white/[0.03] px-3 py-2.5">
          <p className="text-sm text-white/72">
            {selectedActionOption?.description ?? "Vyber akci a potvrď změnu."}
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <ReasonField
              selectedAction={selectedAction}
              fieldError={serverState.fieldErrors?.reason}
              compact
            />
            <SubmitButton selectedAction={selectedActionOption?.label} compact />
          </div>
        </div>
      ) : null}

      {dangerAction ? (
        <details className="group rounded-[0.95rem] border border-red-300/18 bg-red-500/[0.05]">
          <summary className="cursor-pointer list-none px-3 py-2.5 marker:hidden">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-red-100/82">Nebezpečné akce</p>
              <span className="rounded-full border border-red-200/18 px-2.5 py-0.5 text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-red-100/72 group-open:hidden">
                Rozbalit
              </span>
              <span className="hidden rounded-full border border-red-200/18 px-2.5 py-0.5 text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-red-100/72 group-open:inline">
                Sbalit
              </span>
            </div>
          </summary>
          <div className="space-y-2 border-t border-red-200/12 px-3 py-2.5">
            <p className="text-sm leading-5 text-red-50/70">
              Zrušení uvolní termín a přesune rezervaci mezi zrušené. Použij ho jen, když je storno potvrzené.
            </p>
            <button
              type="button"
              aria-pressed={selectedAction === dangerAction.value}
              onClick={() => setSelectedAction(dangerAction.value)}
              className={getActionButtonClassName(dangerAction.value, selectedAction === dangerAction.value, false)}
            >
              <span className="text-left text-sm font-semibold text-red-50">
                {getActionLabel(dangerAction)}
              </span>
              <span className="rounded-full border border-red-200/16 bg-red-200/10 px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-red-50/82">
                {selectedAction === dangerAction.value ? "Vybráno" : "Storno"}
              </span>
            </button>
            {selectedAction === dangerAction.value ? (
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <ReasonField
                  selectedAction={selectedAction}
                  fieldError={serverState.fieldErrors?.reason}
                  compact
                />
                <SubmitButton selectedAction={dangerAction.label} danger compact />
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
    </form>
  );
}

function getErrorDiagnostics(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return {
    value: String(error),
  };
}

function formatCzk(value: number) {
  return czkFormatter.format(value);
}

async function fetchVoucherLookup({
  voucherCode,
  signal,
}: {
  voucherCode: string;
  signal: AbortSignal;
}) {
  const url = new URL("/api/admin/vouchers/lookup", window.location.origin);
  url.searchParams.set("voucherCode", voucherCode);

  const requestInit = {
    method: "GET",
    credentials: "same-origin" as const,
    cache: "no-store" as const,
    signal,
  };

  try {
    return await fetch(url, requestInit);
  } catch (error) {
    if (signal.aborted) {
      throw error;
    }

    // Retry once for transient network/proxy hiccups.
    return fetch(url, requestInit);
  }
}

function getClosedStateHelper(status: AdminBookingStatusFormProps["bookingStatus"]) {
  switch (status) {
    case "COMPLETED":
      return {
        title: "Hotovo.",
        description: "Provozní akce už nejsou potřeba, ale historie zůstává po ruce.",
      };
    case "CANCELLED":
      return {
        title: "Zrušená rezervace.",
        description: "Detail je teď jen read-only přehled s auditní stopou.",
      };
    case "NO_SHOW":
      return {
        title: "Nedorazila.",
        description: "Historii si můžeš zkontrolovat a případně doplnit interní poznámku.",
      };
    default:
      return {
        title: "Bez dostupné akce.",
        description: "Detail slouží hlavně jako přehled.",
      };
  }
}

function getActionButtonClassName(
  value: AdminBookingActionValue,
  isSelected: boolean,
  isPrimary: boolean,
) {
  if (!isSelected) {
    return cn(
      "flex min-h-14 w-full items-start justify-between gap-2.5 rounded-[0.9rem] border px-3 py-2.5 text-left transition",
      value === "CANCELLED"
        ? "border-red-300/18 bg-red-500/8 hover:border-red-300/28 hover:bg-red-500/12"
        : isPrimary
          ? "border-[var(--color-accent)]/45 bg-[rgba(190,160,120,0.16)] shadow-[0_0_0_1px_rgba(190,160,120,0.08)] hover:border-[var(--color-accent)]/62 hover:bg-[rgba(190,160,120,0.2)]"
          : "border-white/10 bg-white/[0.045] hover:border-white/16 hover:bg-white/[0.065]",
    );
  }

  switch (value) {
    case "CONFIRMED":
      return "flex min-h-14 w-full items-start justify-between gap-2.5 rounded-[0.9rem] border border-emerald-300/45 bg-emerald-500/18 px-3 py-2.5 text-left shadow-[0_0_0_1px_rgba(110,231,183,0.12)] transition";
    case "CANCELLED":
      return "flex min-h-14 w-full items-start justify-between gap-2.5 rounded-[0.9rem] border border-red-300/45 bg-red-500/16 px-3 py-2.5 text-left shadow-[0_0_0_1px_rgba(252,165,165,0.1)] transition";
    case "COMPLETED":
      return "flex min-h-14 w-full items-start justify-between gap-2.5 rounded-[0.9rem] border border-[var(--color-accent)]/62 bg-[rgba(190,160,120,0.2)] px-3 py-2.5 text-left shadow-[0_0_0_1px_rgba(190,160,120,0.14)] transition";
    case "NO_SHOW":
      return "flex min-h-14 w-full items-start justify-between gap-2.5 rounded-[0.9rem] border border-amber-300/40 bg-amber-500/13 px-3 py-2.5 text-left shadow-[0_0_0_1px_rgba(253,230,138,0.08)] transition";
    default:
      return "flex min-h-14 w-full items-start justify-between gap-2.5 rounded-[0.9rem] border border-white/12 bg-white/8 px-3 py-2.5 text-left transition";
  }
}

function getReasonPlaceholder(selectedAction: AdminBookingActionValue | "") {
  switch (selectedAction) {
    case "CONFIRMED":
      return "Např. potvrzeno po telefonu";
    case "COMPLETED":
      return "Např. návštěva proběhla";
    case "CANCELLED":
      return "Např. klientka termín zrušila";
    case "NO_SHOW":
      return "Např. klientka nepřišla";
    default:
      return "Krátký důvod do historie";
  }
}

function getActionLabel(action: AdminBookingActionOption) {
  switch (action.value) {
    case "CONFIRMED":
      return "Potvrdit rezervaci";
    case "COMPLETED":
      return "Dokončit návštěvu";
    case "CANCELLED":
      return "Zrušit rezervaci";
    case "NO_SHOW":
      return "Nedorazila";
    default:
      return action.label;
  }
}

function ReasonField({
  selectedAction,
  fieldError,
  compact = false,
  label,
}: {
  selectedAction: AdminBookingActionValue | "";
  fieldError?: string;
  compact?: boolean;
  label?: string;
}) {
  return (
    <label className="block">
      <span className={cn("font-medium text-white", compact ? "text-xs" : "text-sm")}>
        {label ?? (selectedAction === "CANCELLED" ? "Důvod zrušení" : "Volitelný důvod")}
      </span>
      <input
        type="text"
        name="reason"
        maxLength={160}
        placeholder={getReasonPlaceholder(selectedAction)}
        className={cn(
          "w-full rounded-[0.85rem] border border-white/8 bg-black/20 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[var(--color-accent)]/55",
          compact ? "mt-1.5 px-3 py-2" : "mt-2 px-3.5 py-2.5",
        )}
      />
      {fieldError ? (
        <p className="mt-2 text-sm text-red-300">{fieldError}</p>
      ) : null}
    </label>
  );
}

function SubmitButton({
  selectedAction,
  danger = false,
  compact = false,
}: {
  selectedAction?: string;
  danger?: boolean;
  compact?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={cn(
        "rounded-full text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70",
        compact ? "px-3.5 py-2" : "px-4 py-2",
        danger
          ? "border border-red-300/35 bg-red-500/18 text-red-50 hover:bg-red-500/24"
          : "bg-[var(--color-accent)] text-[var(--color-accent-contrast)] hover:brightness-105",
      )}
      disabled={pending}
    >
      {pending ? "Ukládám změnu..." : selectedAction ? selectedAction : "Uložit změnu"}
    </button>
  );
}

function CompleteVisitSubmitButton({
  completionMode,
}: {
  completionMode: "cash" | "qr" | "voucher" | "combined" | "no_payment" | "settled";
}) {
  const { pending } = useFormStatus();
  let label = "Dokončit návštěvu";
  if (completionMode === "cash" || completionMode === "qr") {
    label = "Zapsat úhradu a dokončit";
  } else if (completionMode === "voucher") {
    label = "Uplatnit voucher a dokončit";
  } else if (completionMode === "combined") {
    label = "Zapsat úhrady a dokončit";
  } else if (completionMode === "no_payment") {
    label = "Dokončit bez úhrady";
  }

  return (
    <button
      type="submit"
      className="rounded-full bg-[var(--color-accent)] px-3.5 py-2 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
    >
      {pending ? "Dokončuji..." : label}
    </button>
  );
}
