"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { updateBookingStatusAction } from "@/features/admin/actions/booking-actions";
import { initialUpdateBookingStatusActionState } from "@/features/admin/actions/update-booking-status-action-state";
import {
  type AdminBookingActionOption,
  type AdminBookingActionValue,
} from "@/features/admin/lib/admin-booking";
import { type AdminArea } from "@/config/navigation";

type AdminBookingStatusFormProps = {
  area: AdminArea;
  bookingId: string;
  availableActions: AdminBookingActionOption[];
};

export function AdminBookingStatusForm({
  area,
  bookingId,
  availableActions,
}: AdminBookingStatusFormProps) {
  const [selectedAction, setSelectedAction] = useState<AdminBookingActionValue | "">(
    availableActions[0]?.value ?? "",
  );
  const [serverState, formAction] = useActionState(
    updateBookingStatusAction,
    initialUpdateBookingStatusActionState,
  );
  const selectedActionOption = availableActions.find((action) => action.value === selectedAction);

  if (availableActions.length === 0) {
    return (
      <div className="rounded-[1.05rem] border border-white/8 bg-white/[0.04] p-3.5">
        <p className="text-sm font-medium text-white">Rezervace je v uzavřeném stavu.</p>
        <p className="mt-1 text-sm leading-5 text-white/62">
          Detail teď slouží hlavně pro kontakt, poznámky a audit.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3.5" id="booking-actions">
      <input type="hidden" name="area" value={area} />
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="targetStatus" value={selectedAction} />

      {serverState.status === "success" && serverState.successMessage ? (
        <div className="rounded-[0.9rem] border border-emerald-300/16 bg-emerald-400/10 px-3 py-2 text-sm leading-5 text-emerald-50">
          {serverState.successMessage}
        </div>
      ) : null}

      {serverState.status === "error" && serverState.formError ? (
        <div className="rounded-[0.9rem] border border-red-300/16 bg-red-400/10 px-3 py-2 text-sm leading-5 text-red-50">
          {serverState.formError}
        </div>
      ) : null}

      <fieldset className="space-y-2.5">
        <legend className="text-sm font-medium text-white">Dostupné akce</legend>
        <p className="text-sm text-white/58">
          Vyber další krok. Předvolená je nejpravděpodobnější akce.
        </p>

        <div
          className="grid gap-2 md:grid-cols-2 xl:grid-cols-4"
          role="radiogroup"
          aria-label="Akce pro změnu stavu rezervace"
        >
          {availableActions.map((action) => {
            const isSelected = selectedAction === action.value;

            return (
              <button
                key={action.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelectedAction(action.value)}
                className={getActionButtonClassName(action.value, isSelected)}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <p className="text-left text-sm font-medium text-white">{action.label}</p>
                  <span
                    className={
                      isSelected
                        ? "rounded-full border border-white/16 bg-white/10 px-2 py-1 text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-white"
                        : "rounded-full border border-white/8 px-2 py-1 text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-white/46"
                    }
                  >
                    {isSelected ? "Vybráno" : "Možnost"}
                  </span>
                </div>
                <p className="mt-1 text-left text-sm leading-5 text-white/60">{action.description}</p>
              </button>
            );
          })}
        </div>

        {selectedActionOption ? (
          <div className={getActionPreviewClassName(selectedActionOption.value)}>
            <p className="text-[0.68rem] uppercase tracking-[0.2em] text-white/52">Vybraný krok</p>
            <p className="mt-1 text-sm font-medium text-white">{selectedActionOption.label}</p>
            <p className="mt-1 text-sm leading-5 text-white/66">
              {selectedActionOption.description} Po uložení se změna propíše do historie.
            </p>
          </div>
        ) : null}

        {serverState.fieldErrors?.targetStatus ? (
          <p className="text-sm text-red-300">{serverState.fieldErrors.targetStatus}</p>
        ) : null}
      </fieldset>

      <label className="block">
        <span className="text-sm font-medium text-white">Krátký důvod pro tým</span>
        <input
          type="text"
          name="reason"
          maxLength={160}
          placeholder={getReasonPlaceholder(selectedAction)}
          className="mt-2 w-full rounded-[1rem] border border-white/8 bg-black/20 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[var(--color-accent)]/55"
        />
        <span className="mt-1.5 block text-xs leading-4 text-white/40">
          Krátká stopa pro historii.
        </span>
        {serverState.fieldErrors?.reason ? (
          <p className="mt-2 text-sm text-red-300">{serverState.fieldErrors.reason}</p>
        ) : null}
      </label>

      <SubmitButton />
    </form>
  );
}

function getActionButtonClassName(value: AdminBookingActionValue, isSelected: boolean) {
  if (!isSelected) {
    return "rounded-[1rem] border border-white/7 bg-white/[0.04] px-3.5 py-3.5 text-left transition hover:border-white/12 hover:bg-white/[0.06]";
  }

  switch (value) {
    case "CONFIRMED":
      return "rounded-[1rem] border border-emerald-300/45 bg-emerald-500/18 px-3.5 py-3.5 text-left shadow-[0_0_0_1px_rgba(110,231,183,0.12)] transition";
    case "CANCELLED":
      return "rounded-[1rem] border border-red-300/45 bg-red-500/15 px-3.5 py-3.5 text-left shadow-[0_0_0_1px_rgba(252,165,165,0.1)] transition";
    case "COMPLETED":
      return "rounded-[1rem] border border-cyan-300/42 bg-cyan-500/15 px-3.5 py-3.5 text-left shadow-[0_0_0_1px_rgba(103,232,249,0.1)] transition";
    case "NO_SHOW":
      return "rounded-[1rem] border border-amber-300/45 bg-amber-500/16 px-3.5 py-3.5 text-left shadow-[0_0_0_1px_rgba(253,230,138,0.1)] transition";
    default:
      return "rounded-[1rem] border border-white/12 bg-white/8 px-3.5 py-3.5 text-left transition";
  }
}

function getActionPreviewClassName(value: AdminBookingActionValue) {
  switch (value) {
    case "CONFIRMED":
      return "rounded-[1.05rem] border border-emerald-300/16 bg-emerald-500/8 p-3.5";
    case "CANCELLED":
      return "rounded-[1.05rem] border border-red-300/16 bg-red-500/8 p-3.5";
    case "COMPLETED":
      return "rounded-[1.05rem] border border-cyan-300/16 bg-cyan-500/8 p-3.5";
    case "NO_SHOW":
      return "rounded-[1.05rem] border border-amber-300/16 bg-amber-500/8 p-3.5";
    default:
      return "rounded-[1.05rem] border border-white/8 bg-white/[0.04] p-3.5";
  }
}

function getReasonPlaceholder(selectedAction: AdminBookingActionValue | "") {
  switch (selectedAction) {
    case "CONFIRMED":
      return "Např. potvrzeno po telefonu nebo klientka potvrdila termín";
    case "COMPLETED":
      return "Např. služba proběhla bez komplikací";
    case "CANCELLED":
      return "Např. klientka termín zrušila nebo se měnil plán";
    case "NO_SHOW":
      return "Např. klientka nepřišla a neozvala se";
    default:
      return "Např. potvrzeno po telefonu nebo klientka změnu potvrdila";
  }
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
    >
      {pending ? "Ukládám změnu..." : "Uložit změnu"}
    </button>
  );
}
