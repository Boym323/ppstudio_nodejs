"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { updateClientNoteAction } from "@/features/admin/actions/client-actions";
import { initialUpdateClientNoteActionState } from "@/features/admin/actions/update-client-note-action-state";
import { type AdminArea } from "@/config/navigation";

export function AdminClientNoteForm({
  area,
  clientId,
  initialValue,
}: {
  area: AdminArea;
  clientId: string;
  initialValue: string;
}) {
  const [serverState, formAction] = useActionState(
    updateClientNoteAction,
    initialUpdateClientNoteActionState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="area" value={area} />
      <input type="hidden" name="clientId" value={clientId} />

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
        <span className="text-sm font-medium text-white">Interní poznámka</span>
        <textarea
          name="internalNote"
          rows={4}
          maxLength={1000}
          defaultValue={initialValue}
          placeholder="Např. preferovaný kontakt, citlivost na čas, reakce po ošetření nebo provozní domluva."
          className="mt-2 w-full rounded-[1rem] border border-white/10 bg-black/20 px-3.5 py-2.5 text-sm leading-6 text-white outline-none transition placeholder:text-white/32 focus:border-[var(--color-accent)]/60"
        />
        <span className="mt-2 block text-xs leading-5 text-white/46">
          Interní poznámka je viditelná pouze pro tým.
        </span>
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
      className="rounded-full bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
    >
      {pending ? "Ukládám poznámku..." : "Uložit poznámku"}
    </button>
  );
}
