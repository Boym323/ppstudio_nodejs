"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  initialUpdateBookingStatusActionState,
  updateBookingStatusAction,
} from "@/features/admin/actions/booking-actions";
import { type AdminBookingActionOption } from "@/features/admin/lib/admin-booking";
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
  const [serverState, formAction] = useActionState(
    updateBookingStatusAction,
    initialUpdateBookingStatusActionState,
  );

  if (availableActions.length === 0) {
    return (
      <div className="rounded-[1.25rem] border border-dashed border-white/14 bg-white/4 p-5">
        <p className="text-base font-medium text-white">Tahle rezervace je už uzavřená.</p>
        <p className="mt-2 text-sm leading-6 text-white/68">
          V detailu zůstává historie i poznámky, ale další změna stavu už tady není potřeba.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="area" value={area} />
      <input type="hidden" name="bookingId" value={bookingId} />

      {serverState.status === "success" && serverState.successMessage ? (
        <div className="rounded-[1.25rem] border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-50">
          {serverState.successMessage}
        </div>
      ) : null}

      {serverState.status === "error" && serverState.formError ? (
        <div className="rounded-[1.25rem] border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-50">
          {serverState.formError}
        </div>
      ) : null}

      <label className="block">
        <span className="text-sm font-medium text-white">Co chceš s rezervací udělat</span>
        <select
          name="targetStatus"
          defaultValue=""
          className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
        >
          <option value="" disabled className="text-black">
            Vyber akci
          </option>
          {availableActions.map((action) => (
            <option key={action.value} value={action.value} className="text-black">
              {action.label}
            </option>
          ))}
        </select>
        {serverState.fieldErrors?.targetStatus ? (
          <p className="mt-2 text-sm text-red-300">{serverState.fieldErrors.targetStatus}</p>
        ) : null}
      </label>

      <div className="grid gap-3">
        {availableActions.map((action) => (
          <div
            key={action.value}
            className="rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-3"
          >
            <p className="text-sm font-medium text-white">{action.label}</p>
            <p className="mt-1 text-sm leading-6 text-white/64">{action.description}</p>
          </div>
        ))}
      </div>

      <label className="block">
        <span className="text-sm font-medium text-white">Důvod pro tým</span>
        <input
          type="text"
          name="reason"
          maxLength={160}
          placeholder="Např. potvrzeno po telefonu nebo klientka změnu potvrdila"
          className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/32 focus:border-[var(--color-accent)]/60"
        />
        {serverState.fieldErrors?.reason ? (
          <p className="mt-2 text-sm text-red-300">{serverState.fieldErrors.reason}</p>
        ) : null}
      </label>

      <label className="block">
        <span className="text-sm font-medium text-white">Interní poznámka</span>
        <textarea
          name="internalNote"
          rows={4}
          maxLength={1000}
          placeholder="Volitelná poznámka, která zůstane uvnitř administrace."
          className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/32 focus:border-[var(--color-accent)]/60"
        />
        {serverState.fieldErrors?.internalNote ? (
          <p className="mt-2 text-sm text-red-300">{serverState.fieldErrors.internalNote}</p>
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
      className="rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
    >
      {pending ? "Ukládám změnu..." : "Uložit změnu"}
    </button>
  );
}
