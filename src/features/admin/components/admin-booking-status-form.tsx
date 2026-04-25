"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { updateBookingStatusAction } from "@/features/admin/actions/booking-actions";
import { initialUpdateBookingStatusActionState } from "@/features/admin/actions/update-booking-status-action-state";
import {
  type AdminBookingActionOption,
  type AdminBookingActionValue,
} from "@/features/admin/lib/admin-booking";
import { type AdminArea } from "@/config/navigation";
import { cn } from "@/lib/utils";

type AdminBookingStatusFormProps = {
  area: AdminArea;
  bookingId: string;
  bookingStatus: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  availableActions: AdminBookingActionOption[];
};

export function AdminBookingStatusForm({
  area,
  bookingId,
  bookingStatus,
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
  const helperText = useMemo(() => getClosedStateHelper(bookingStatus), [bookingStatus]);

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
    <form action={formAction} className="space-y-3" id="booking-actions">
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

      <fieldset className="space-y-2.5">
        <legend className="text-sm font-medium text-white">Vyber další krok</legend>

        <div
          className="grid gap-2 md:grid-cols-2 xl:grid-cols-4"
          role="radiogroup"
          aria-label="Akce pro změnu stavu rezervace"
        >
          {availableActions.map((action, index) => {
            const isSelected = selectedAction === action.value;
            const isPrimary = index === 0;

            return (
              <button
                key={action.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelectedAction(action.value)}
                className={getActionButtonClassName(action.value, isSelected, isPrimary)}
              >
                <span className="text-left text-sm font-medium text-white">{getActionLabel(action)}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.16em]",
                    isSelected
                      ? "border border-white/16 bg-white/10 text-white"
                      : isPrimary
                        ? "border border-white/12 bg-black/18 text-white/68"
                        : "border border-white/8 text-white/42",
                  )}
                >
                  {isSelected ? "Vybráno" : isPrimary ? "Primární" : "Akce"}
                </span>
              </button>
            );
          })}
        </div>

        {serverState.fieldErrors?.targetStatus ? (
          <p className="text-sm text-red-300">{serverState.fieldErrors.targetStatus}</p>
        ) : null}
      </fieldset>

      {selectedActionOption ? (
        <div className={getActionPreviewClassName(selectedActionOption.value)}>
          <p className="text-sm font-medium text-white">{getActionLabel(selectedActionOption)}</p>
          <p className="mt-1 text-sm leading-5 text-white/64">
            {selectedActionOption.description}
          </p>
        </div>
      ) : null}

      <label className="block">
        <span className="text-sm font-medium text-white">Volitelný důvod</span>
        <input
          type="text"
          name="reason"
          maxLength={160}
          placeholder={getReasonPlaceholder(selectedAction)}
          className="mt-2 w-full rounded-[1rem] border border-white/8 bg-black/20 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[var(--color-accent)]/55"
        />
        {serverState.fieldErrors?.reason ? (
          <p className="mt-2 text-sm text-red-300">{serverState.fieldErrors.reason}</p>
        ) : null}
      </label>

      <SubmitButton selectedAction={selectedActionOption?.label} />
    </form>
  );
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
      "flex min-h-20 items-start justify-between gap-3 rounded-[1rem] border px-3.5 py-3 text-left transition",
      isPrimary
        ? "border-white/12 bg-white/[0.06] hover:border-white/22 hover:bg-white/[0.08]"
        : "border-white/7 bg-white/[0.04] hover:border-white/12 hover:bg-white/[0.06]",
    );
  }

  switch (value) {
    case "CONFIRMED":
      return "flex min-h-20 items-start justify-between gap-3 rounded-[1rem] border border-emerald-300/45 bg-emerald-500/18 px-3.5 py-3 text-left shadow-[0_0_0_1px_rgba(110,231,183,0.12)] transition";
    case "CANCELLED":
      return "flex min-h-20 items-start justify-between gap-3 rounded-[1rem] border border-red-300/45 bg-red-500/15 px-3.5 py-3 text-left shadow-[0_0_0_1px_rgba(252,165,165,0.1)] transition";
    case "COMPLETED":
      return "flex min-h-20 items-start justify-between gap-3 rounded-[1rem] border border-cyan-300/42 bg-cyan-500/15 px-3.5 py-3 text-left shadow-[0_0_0_1px_rgba(103,232,249,0.1)] transition";
    case "NO_SHOW":
      return "flex min-h-20 items-start justify-between gap-3 rounded-[1rem] border border-amber-300/45 bg-amber-500/16 px-3.5 py-3 text-left shadow-[0_0_0_1px_rgba(253,230,138,0.1)] transition";
    default:
      return "flex min-h-20 items-start justify-between gap-3 rounded-[1rem] border border-white/12 bg-white/8 px-3.5 py-3 text-left transition";
  }
}

function getActionPreviewClassName(value: AdminBookingActionValue) {
  switch (value) {
    case "CONFIRMED":
      return "rounded-[1rem] border border-emerald-300/16 bg-emerald-500/8 p-3.5";
    case "CANCELLED":
      return "rounded-[1rem] border border-red-300/16 bg-red-500/8 p-3.5";
    case "COMPLETED":
      return "rounded-[1rem] border border-cyan-300/16 bg-cyan-500/8 p-3.5";
    case "NO_SHOW":
      return "rounded-[1rem] border border-amber-300/16 bg-amber-500/8 p-3.5";
    default:
      return "rounded-[1rem] border border-white/8 bg-white/[0.04] p-3.5";
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
      return "Označit jako hotové";
    case "CANCELLED":
      return "Zrušit rezervaci";
    case "NO_SHOW":
      return "Nedorazila";
    default:
      return action.label;
  }
}

function SubmitButton({ selectedAction }: { selectedAction?: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
    >
      {pending ? "Ukládám změnu..." : selectedAction ? selectedAction : "Uložit změnu"}
    </button>
  );
}
