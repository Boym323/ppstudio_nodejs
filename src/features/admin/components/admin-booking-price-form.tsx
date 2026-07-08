"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { updateBookingPriceAction } from "@/features/admin/actions/booking-actions";
import { initialUpdateBookingPriceActionState } from "@/features/admin/actions/update-booking-price-action-state";
import { type AdminArea } from "@/config/navigation";

export function AdminBookingPriceForm({
  area,
  bookingId,
  basePriceCzk,
  finalPriceCzk,
  reason,
  variant = "details",
}: {
  area: AdminArea;
  bookingId: string;
  basePriceCzk: number;
  finalPriceCzk: number | null;
  reason: string | null;
  variant?: "details" | "fields";
}) {
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

      {serverState.status === "success" && serverState.successMessage ? (
        <div className="max-w-full break-words rounded-[0.9rem] border border-emerald-300/16 bg-emerald-400/10 px-3 py-2 text-sm leading-5 text-emerald-50">
          {serverState.successMessage}
        </div>
      ) : null}

      {serverState.status === "error" && serverState.formError ? (
        <div className="max-w-full break-words rounded-[0.9rem] border border-red-300/16 bg-red-400/10 px-3 py-2 text-sm leading-5 text-red-50">
          {serverState.formError}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <label className="block">
          <span className="text-sm font-medium text-white">Cena k úhradě</span>
          <input
            type="number"
            name="finalPriceCzk"
            min={0}
            max={100000}
            step={1}
            inputMode="numeric"
            defaultValue={finalPriceCzk ?? ""}
            placeholder={`${basePriceCzk}`}
            className="mt-1.5 w-full rounded-[0.85rem] border border-white/8 bg-black/20 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[var(--color-accent)]/55"
          />
          <span className="mt-1.5 block text-xs leading-4 text-white/40">
            Prázdné pole vrátí ceníkovou cenu.
          </span>
          {serverState.fieldErrors?.finalPriceCzk ? (
            <p className="mt-2 text-sm text-red-300">{serverState.fieldErrors.finalPriceCzk}</p>
          ) : null}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-white">Důvod úpravy</span>
          <input
            type="text"
            name="priceAdjustmentReason"
            maxLength={500}
            defaultValue={reason ?? ""}
            placeholder="Např. věrnostní sleva nebo kompenzace."
            className="mt-1.5 w-full rounded-[0.85rem] border border-white/8 bg-black/20 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[var(--color-accent)]/55"
          />
          {serverState.fieldErrors?.priceAdjustmentReason ? (
            <p className="mt-2 text-sm text-red-300">{serverState.fieldErrors.priceAdjustmentReason}</p>
          ) : null}
        </label>
      </div>

      <SubmitPriceButton hasAdjustment={finalPriceCzk !== null} />
    </form>
  );

  if (variant === "fields") {
    return form;
  }

  return (
    <details className="group rounded-[0.95rem] border border-white/8 bg-white/[0.03]">
      <summary className="cursor-pointer list-none px-3.5 py-3 marker:hidden">
        <span className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/16 bg-transparent px-4 py-2 text-sm font-semibold text-white/82 transition group-open:hidden hover:border-white/28 hover:bg-white/8 hover:text-white">
          Upravit cenu
        </span>
        <span className="hidden text-sm font-medium text-white/78 group-open:inline">
          Individuální cena rezervace
        </span>
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
