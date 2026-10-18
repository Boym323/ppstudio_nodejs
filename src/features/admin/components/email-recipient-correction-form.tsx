"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { correctEmailRecipientAction } from "@/features/admin/actions/email-log-actions";
import { initialUpdateClientContactActionState } from "@/features/admin/actions/update-client-contact-action-state";

export function EmailRecipientCorrectionForm({ emailLogId, clientId, email }: {
  emailLogId: string;
  clientId: string;
  email: string;
}) {
  const [state, action] = useActionState(correctEmailRecipientAction, initialUpdateClientContactActionState);

  return (
    <form action={action} className="mt-4 space-y-3 rounded-xl border border-amber-300/20 bg-amber-400/[.05] p-4">
      <input type="hidden" name="area" value="owner" />
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="incidentEmailLogId" value={emailLogId} />
      <p className="text-sm font-semibold text-white">Opravit e-mail a odeslat znovu</p>
      <p className="text-sm text-white/70">Adresa se uloží ke klientce a jejím aktivním rezervacím, ke kterým se mohou znovu odeslat aktuální informace. Původní e-mail zůstane v historii; problém se uzavře po potvrzení doručení.</p>
      {state.formError ? <p role="alert" className="text-sm text-red-200">{state.formError}</p> : null}
      {state.successMessage ? <p role="status" className="text-sm text-emerald-200">{state.successMessage}</p> : null}
      <label className="block text-sm text-white/80">
        Správný e-mail klientky
        <input type="email" name="email" required maxLength={254} defaultValue={email} aria-invalid={!!state.fieldErrors?.email}
          className="mt-1 block w-full max-w-md rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-sm text-white" />
        {state.fieldErrors?.email ? <span className="mt-1 block text-xs text-red-200">{state.fieldErrors.email}</span> : null}
      </label>
      <SubmitButton done={state.status === "success"} />
    </form>
  );
}

function SubmitButton({ done }: { done: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending || done} className="min-h-11 rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-accent-contrast)] disabled:opacity-60">
    {pending ? "Ukládám a připravuji odeslání…" : done ? "Pokus je ve frontě" : "Uložit a odeslat znovu"}
  </button>;
}
