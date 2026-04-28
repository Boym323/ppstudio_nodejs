"use client";

import { VoucherType } from "@prisma/client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { redeemBookingVoucherAction } from "@/features/admin/actions/booking-actions";
import { initialRedeemBookingVoucherActionState } from "@/features/admin/actions/redeem-booking-voucher-action-state";
import { type AdminBookingDetailData } from "@/features/admin/lib/admin-booking";

type AdminBookingVoucherFormProps = {
  area: AdminBookingDetailData["area"];
  bookingId: string;
  initialVoucherCode: string;
  intendedVoucherType: VoucherType | null;
  defaultAmountCzk: number | null;
  amountHint?: string | null;
  id?: string;
};

export function AdminBookingVoucherForm({
  area,
  bookingId,
  initialVoucherCode,
  intendedVoucherType,
  defaultAmountCzk,
  amountHint,
  id,
}: AdminBookingVoucherFormProps) {
  const [serverState, formAction] = useActionState(
    redeemBookingVoucherAction,
    initialRedeemBookingVoucherActionState,
  );
  const showAmount = intendedVoucherType !== VoucherType.SERVICE;

  return (
    <form id={id} action={formAction} className="space-y-3">
      <input type="hidden" name="area" value={area} />
      <input type="hidden" name="bookingId" value={bookingId} />

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

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(12rem,0.55fr)]">
        <label className="block">
          <span className="text-sm font-medium text-white">Kód voucheru</span>
          <input
            type="text"
            name="voucherCode"
            maxLength={64}
            defaultValue={initialVoucherCode}
            placeholder="PP-2026-ABC123"
            className="mt-1.5 w-full rounded-[0.85rem] border border-white/8 bg-black/20 px-3.5 py-2.5 font-mono text-sm uppercase tracking-[0.08em] text-white outline-none transition placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-white/30 focus:border-[var(--color-accent)]/55"
          />
          {serverState.fieldErrors?.voucherCode ? (
            <p className="mt-2 text-sm text-red-300">{serverState.fieldErrors.voucherCode}</p>
          ) : null}
        </label>

        {showAmount ? (
          <label className="block">
            <span className="text-sm font-medium text-white">Částka k uplatnění</span>
            <input
              type="number"
              name="amountCzk"
              min={1}
              step={1}
              inputMode="numeric"
              defaultValue={defaultAmountCzk && defaultAmountCzk > 0 ? defaultAmountCzk : undefined}
              placeholder="Např. 1200"
              className="mt-1.5 w-full rounded-[0.85rem] border border-white/8 bg-black/20 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[var(--color-accent)]/55"
            />
            {amountHint ? (
              <p className="mt-2 text-sm leading-5 text-white/48">{amountHint}</p>
            ) : null}
            {serverState.fieldErrors?.amountCzk ? (
              <p className="mt-2 text-sm text-red-300">{serverState.fieldErrors.amountCzk}</p>
            ) : null}
          </label>
        ) : null}
      </div>

      <label className="block">
        <span className="text-sm font-medium text-white">Poznámka</span>
        <textarea
          name="note"
          rows={2}
          maxLength={2000}
          placeholder="Např. uplatněno při návštěvě v salonu."
          className="mt-1.5 w-full resize-y rounded-[0.85rem] border border-white/8 bg-black/20 px-3.5 py-2.5 text-sm leading-5 text-white outline-none transition placeholder:text-white/30 focus:border-[var(--color-accent)]/55"
        />
        {serverState.fieldErrors?.note ? (
          <p className="mt-2 text-sm text-red-300">{serverState.fieldErrors.note}</p>
        ) : null}
      </label>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Uplatňuji voucher..." : "Uplatnit voucher"}
    </button>
  );
}
