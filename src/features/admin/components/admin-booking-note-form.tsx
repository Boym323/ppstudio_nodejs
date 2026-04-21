"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { updateBookingNoteAction } from "@/features/admin/actions/booking-actions";
import { initialUpdateBookingNoteActionState } from "@/features/admin/actions/update-booking-note-action-state";
import { type AdminArea } from "@/config/navigation";

export function AdminBookingNoteForm({
  area,
  bookingId,
  initialValue,
}: {
  area: AdminArea;
  bookingId: string;
  initialValue: string;
}) {
  const [serverState, formAction] = useActionState(
    updateBookingNoteAction,
    initialUpdateBookingNoteActionState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="area" value={area} />
      <input type="hidden" name="bookingId" value={bookingId} />

      {serverState.status === "success" && serverState.successMessage ? (
        <div className="rounded-[1rem] border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-50">
          {serverState.successMessage}
        </div>
      ) : null}

      {serverState.status === "error" && serverState.formError ? (
        <div className="rounded-[1rem] border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-50">
          {serverState.formError}
        </div>
      ) : null}

      <label className="block">
        <span className="text-sm font-medium text-white">Interní poznámka</span>
        <textarea
          name="internalNote"
          rows={5}
          maxLength={1000}
          defaultValue={initialValue}
          placeholder="Např. citlivost na čas, preferovaný kontakt nebo krátký provozní kontext pro tým."
          className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/32 focus:border-[var(--color-accent)]/60"
        />
        <span className="mt-2 block text-xs leading-5 text-white/46">
          Poznámka zůstává interní a každé uložení se propíše do auditní historie.
        </span>
        {serverState.fieldErrors?.internalNote ? (
          <p className="mt-2 text-sm text-red-300">{serverState.fieldErrors.internalNote}</p>
        ) : null}
      </label>

      <SubmitButton hasValue={initialValue.trim().length > 0} />
    </form>
  );
}

function SubmitButton({ hasValue }: { hasValue: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
    >
      {pending ? "Ukládám poznámku..." : hasValue ? "Upravit poznámku" : "Přidat poznámku"}
    </button>
  );
}
