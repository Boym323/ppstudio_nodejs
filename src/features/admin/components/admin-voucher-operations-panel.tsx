"use client";

import { useActionState } from "react";
import { VoucherStatus } from "@prisma/client";

import { cancelVoucherAction, updateVoucherOperationalDetailsAction } from "@/features/admin/actions/voucher-actions";
import {
  initialCancelVoucherActionState,
} from "@/features/admin/actions/cancel-voucher-action-state";
import {
  initialUpdateVoucherOperationalDetailsActionState,
} from "@/features/admin/actions/update-voucher-operational-details-action-state";
import { type AdminVoucherDetailData } from "@/features/admin/lib/admin-vouchers";
import { cn } from "@/lib/utils";

const pragueDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Prague",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function AdminVoucherOperationsPanel({
  data,
}: {
  data: AdminVoucherDetailData;
}) {
  const [updateState, updateAction, updatePending] = useActionState(
    updateVoucherOperationalDetailsAction,
    initialUpdateVoucherOperationalDetailsActionState,
  );
  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelVoucherAction,
    initialCancelVoucherActionState,
  );
  const isCancelled = data.status === VoucherStatus.CANCELLED;
  const hasRedemptions = data.redemptions.length > 0;

  return (
    <div className="space-y-3">
      <details className="group rounded-[1rem] border border-white/8 bg-white/[0.04]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
          <span className="text-sm font-semibold text-white">Upravit provozní údaje</span>
          <span className="text-xs uppercase tracking-[0.16em] text-white/42 group-open:hidden">Otevřít</span>
          <span className="hidden text-xs uppercase tracking-[0.16em] text-white/42 group-open:inline">Zavřít</span>
        </summary>

        <form action={updateAction} className="space-y-3 border-t border-white/8 px-4 py-4">
          <input type="hidden" name="area" value={data.area} />
          <input type="hidden" name="voucherId" value={data.id} />

          <VoucherTextField
            label="Jméno kupujícího"
            name="purchaserName"
            defaultValue={data.purchaserName ?? ""}
            error={updateState.fieldErrors?.purchaserName}
          />
          <VoucherTextField
            label="E-mail kupujícího"
            name="purchaserEmail"
            type="email"
            defaultValue={data.purchaserEmail ?? ""}
            error={updateState.fieldErrors?.purchaserEmail}
          />
          <VoucherTextField
            label="Platnost do"
            name="validUntil"
            type="date"
            defaultValue={data.validUntil ? pragueDateFormatter.format(data.validUntil) : ""}
            error={updateState.fieldErrors?.validUntil}
          />

          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.18em] text-white/46">Interní poznámka</span>
            <textarea
              name="internalNote"
              defaultValue={data.internalNote ?? ""}
              rows={4}
              className={fieldClassName}
            />
            {updateState.fieldErrors?.internalNote ? (
              <span className="mt-1 block text-xs text-red-300">{updateState.fieldErrors.internalNote}</span>
            ) : null}
          </label>

          <ActionMessage status={updateState.status} success={updateState.successMessage} error={updateState.formError} />

          <button
            type="submit"
            disabled={updatePending}
            className="inline-flex items-center justify-center rounded-full bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {updatePending ? "Ukládám..." : "Uložit provozní údaje"}
          </button>
        </form>
      </details>

      {!isCancelled ? (
        <details className="group rounded-[1rem] border border-red-300/20 bg-red-500/[0.05]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm font-semibold text-red-100">Zrušit voucher</span>
            <span className="text-xs uppercase tracking-[0.16em] text-red-100/48 group-open:hidden">Otevřít</span>
            <span className="hidden text-xs uppercase tracking-[0.16em] text-red-100/48 group-open:inline">Zavřít</span>
          </summary>

          <div className="space-y-3 border-t border-red-300/15 px-4 py-4">
            <p className="text-sm leading-5 text-white/68">
              Voucher po zrušení nepůjde uplatnit. Tato akce zůstane uložená v detailu voucheru.
            </p>

            {hasRedemptions ? (
              <p className="rounded-[0.9rem] border border-red-300/20 bg-red-400/10 px-3 py-2 text-sm leading-5 text-red-100">
                Voucher už byl částečně nebo plně čerpán, proto ho nelze zrušit.
              </p>
            ) : (
              <form action={cancelAction} className="space-y-3">
                <input type="hidden" name="area" value={data.area} />
                <input type="hidden" name="voucherId" value={data.id} />
                <label className="block">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-white/46">Důvod zrušení</span>
                  <textarea name="cancelReason" rows={4} required className={fieldClassName} />
                  {cancelState.fieldErrors?.cancelReason ? (
                    <span className="mt-1 block text-xs text-red-300">{cancelState.fieldErrors.cancelReason}</span>
                  ) : null}
                </label>

                <ActionMessage status={cancelState.status} success={cancelState.successMessage} error={cancelState.formError} />

                <button
                  type="submit"
                  disabled={cancelPending}
                  className="inline-flex items-center justify-center rounded-full border border-red-300/35 bg-red-500/12 px-4 py-2.5 text-sm font-semibold text-red-100 transition hover:border-red-200/60 hover:bg-red-500/18 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {cancelPending ? "Ruším..." : "Zrušit voucher"}
                </button>
              </form>
            )}
          </div>
        </details>
      ) : null}
    </div>
  );
}

const fieldClassName = cn(
  "mt-1 w-full rounded-[0.9rem] border border-white/10 bg-black/20 px-3 py-2.25",
  "text-sm text-white outline-none transition placeholder:text-white/28",
  "focus:border-[var(--color-accent)]/60",
);

function VoucherTextField({
  label,
  name,
  type = "text",
  defaultValue,
  error,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue: string;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.18em] text-white/46">{label}</span>
      <input type={type} name={name} defaultValue={defaultValue} className={fieldClassName} />
      {error ? <span className="mt-1 block text-xs text-red-300">{error}</span> : null}
    </label>
  );
}

function ActionMessage({
  status,
  success,
  error,
}: {
  status: "idle" | "success" | "error";
  success?: string;
  error?: string;
}) {
  if (status === "success" && success) {
    return <p className="rounded-[0.9rem] border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-50">{success}</p>;
  }

  if (status === "error" && error) {
    return <p className="rounded-[0.9rem] border border-red-300/20 bg-red-400/10 px-3 py-2 text-sm text-red-100">{error}</p>;
  }

  return null;
}
