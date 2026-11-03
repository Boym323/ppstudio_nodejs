"use client";

import { useId, useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { updateBookingPriceAction } from "@/features/admin/actions/bookings/update-booking-price";
import { initialUpdateBookingPriceActionState } from "@/features/admin/actions/update-booking-price-action-state";
import { type AdminArea } from "@/config/navigation";

export function AdminBookingPriceForm({
  area,
  bookingId,
  expectedUpdatedAt,
  basePriceCzk,
  finalPriceCzk,
  reason,
  variant = "details",
  directPaidCzk = 0,
  voucherPaidCzk = 0,
}: {
  area: AdminArea;
  bookingId: string;
  expectedUpdatedAt: string;
  basePriceCzk: number;
  finalPriceCzk: number | null;
  reason: string | null;
  variant?: "details" | "fields";
  directPaidCzk?: number;
  voucherPaidCzk?: number;
}) {
  const errorId = useId();
  const [priceInput, setPriceInput] = useState(finalPriceCzk === null ? "" : String(finalPriceCzk));
  const [overpaymentConfirmed, setOverpaymentConfirmed] = useState(false);
  const preview = useMemo(() => {
    const parsed = priceInput.trim() === "" ? basePriceCzk : Number(priceInput);
    const totalPriceCzk = Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
    if (totalPriceCzk === null) return null;
    const paidCzk = directPaidCzk + voucherPaidCzk;
    return { totalPriceCzk, paidCzk, remainingCzk: Math.max(0, totalPriceCzk - paidCzk), overpaidCzk: Math.max(0, paidCzk - totalPriceCzk) };
  }, [basePriceCzk, directPaidCzk, priceInput, voucherPaidCzk]);
  const [serverState, formAction] = useActionState(
    updateBookingPriceAction,
    initialUpdateBookingPriceActionState,
  );

  const form = (
    <form
      action={formAction}
      className={variant === "details" ? "space-y-3 border-t border-white/8 px-3.5 py-3" : "space-y-3"}
    >
      <input type="hidden" name="area" value={area} />
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt} />
      <input type="hidden" name="confirmOverpayment" value={preview?.overpaidCzk && overpaymentConfirmed ? "true" : ""} />

      {serverState.status === "success" && serverState.successMessage ? (
        <div role="status" className="max-w-full break-words rounded-[0.9rem] border border-emerald-300/16 bg-emerald-400/10 px-3 py-2 text-sm leading-5 text-emerald-50">
          {serverState.successMessage}
        </div>
      ) : null}

      {serverState.status === "error" && serverState.formError ? (
        <div role="alert" className="max-w-full break-words rounded-[0.9rem] border border-red-300/16 bg-red-400/10 px-3 py-2 text-sm leading-5 text-red-50">
          {serverState.formError}
          {serverState.conflict ? (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-2 block text-sm font-semibold text-red-100 underline underline-offset-4"
            >
              Načíst aktuální hodnotu
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))]">
        <label className="block">
          <span className="text-sm font-medium text-white">Cena k úhradě</span>
          <input
            type="number"
            name="finalPriceCzk"
            aria-invalid={Boolean(serverState.fieldErrors?.finalPriceCzk)}
            aria-describedby={serverState.fieldErrors?.finalPriceCzk ? `${errorId}-finalPriceCzk` : undefined}
            min={0}
            max={100000}
            step={1}
            inputMode="numeric"
            defaultValue={finalPriceCzk ?? ""}
            onChange={(event) => setPriceInput(event.target.value)}
            placeholder={`${basePriceCzk}`}
            className="mt-1.5 w-full rounded-[0.85rem] border border-white/8 bg-black/20 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[var(--color-accent)]/55"
          />
          <span className="mt-1.5 block text-xs leading-4 text-white/40">
            Prázdné pole vrátí ceníkovou cenu.
          </span>
          {serverState.fieldErrors?.finalPriceCzk ? (
            <p id={`${errorId}-finalPriceCzk`} role="alert" className="mt-2 text-sm text-red-300">{serverState.fieldErrors.finalPriceCzk}</p>
          ) : null}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-white">Důvod úpravy</span>
          <input
            type="text"
            name="priceAdjustmentReason"
            aria-invalid={Boolean(serverState.fieldErrors?.priceAdjustmentReason)}
            aria-describedby={serverState.fieldErrors?.priceAdjustmentReason ? `${errorId}-priceAdjustmentReason` : undefined}
            maxLength={500}
            defaultValue={reason ?? ""}
            placeholder="Např. věrnostní sleva nebo kompenzace."
            className="mt-1.5 w-full rounded-[0.85rem] border border-white/8 bg-black/20 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[var(--color-accent)]/55"
          />
          {serverState.fieldErrors?.priceAdjustmentReason ? (
            <p id={`${errorId}-priceAdjustmentReason`} role="alert" className="mt-2 text-sm text-red-300">{serverState.fieldErrors.priceAdjustmentReason}</p>
          ) : null}
        </label>
      </div>

      {preview && (preview.totalPriceCzk !== (finalPriceCzk ?? basePriceCzk) || preview.overpaidCzk > 0) ? <div role="status" className="border-t border-white/8 pt-2 text-sm text-white/74">
        <p className={preview.overpaidCzk > 0 ? "font-semibold text-amber-200" : undefined}>{preview.overpaidCzk > 0 ? `Po změně přeplatek ${preview.overpaidCzk} Kč.` : `Po změně zbývá uhradit ${preview.remainingCzk} Kč.`}</p>
        {preview.overpaidCzk > 0 ? <label className="mt-2 flex items-start gap-2 text-amber-100"><input required type="checkbox" checked={overpaymentConfirmed} onChange={(event) => setOverpaymentConfirmed(event.target.checked)} /> <span>Rozumím, že změna vytvoří přeplatek, a chci ji uložit.</span></label> : null}
      </div> : null}

      <SubmitPriceButton hasAdjustment={finalPriceCzk !== null} />
    </form>
  );

  if (variant === "fields") {
    return form;
  }

  return (
    <details className="group rounded-[0.95rem] border border-white/8 bg-white/[0.03]">
      <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-medium text-white/78">
        Upravit cenu
      </summary>

      {form}
    </details>
  );
}

function SubmitPriceButton({ hasAdjustment }: { hasAdjustment: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/16 bg-transparent px-4 py-2 text-sm font-semibold text-white/86 transition hover:border-white/30 hover:bg-white/8 hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Ukládám cenu..." : hasAdjustment ? "Uložit cenu" : "Nastavit cenu"}
    </button>
  );
}
