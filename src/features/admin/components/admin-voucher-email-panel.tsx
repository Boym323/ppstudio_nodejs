"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  initialSendVoucherEmailActionState,
} from "@/features/admin/actions/send-voucher-email-action-state";
import { sendVoucherEmailAction } from "@/features/admin/actions/voucher-email-actions";
import { type AdminArea } from "@/config/navigation";
import { cn } from "@/lib/utils";

type AdminVoucherEmailPanelProps = {
  area: AdminArea;
  voucherId: string;
  canSend: boolean;
  blockedMessage: string;
  defaultRecipientEmail: string;
  defaultSubject: string;
};

export function AdminVoucherEmailPanel({
  area,
  voucherId,
  canSend,
  blockedMessage,
  defaultRecipientEmail,
  defaultSubject,
}: AdminVoucherEmailPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [serverState, formAction] = useActionState(
    sendVoucherEmailAction,
    initialSendVoucherEmailActionState,
  );

  return (
    <section className="rounded-[1.1rem] border border-white/8 bg-white/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Poslat e-mailem</p>
          <p className="mt-1 text-sm leading-6 text-white/62">
            Voucher se odešle pouze po potvrzení formuláře.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen((value) => !value)}
          disabled={!canSend}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-semibold transition",
            canSend
              ? "bg-[var(--color-accent)] text-[var(--color-accent-contrast)] hover:brightness-105"
              : "cursor-not-allowed border border-white/10 bg-white/5 text-white/40",
          )}
        >
          Poslat e-mailem
        </button>
      </div>

      {!canSend ? (
        <p className="mt-3 rounded-[0.95rem] border border-white/10 bg-black/18 px-3 py-2 text-sm leading-6 text-white/70">
          {blockedMessage}
        </p>
      ) : null}

      {isOpen && canSend ? (
        <form action={formAction} className="mt-4 space-y-3">
          <input type="hidden" name="area" value={area} />
          <input type="hidden" name="voucherId" value={voucherId} />

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

          <label className="block">
            <span className="text-sm font-medium text-white">Příjemce e-mail</span>
            <input
              type="email"
              name="recipientEmail"
              defaultValue={defaultRecipientEmail}
              maxLength={254}
              placeholder="email@example.cz"
              className={inputClassName}
            />
            {serverState.fieldErrors?.recipientEmail ? (
              <p className="mt-2 text-sm text-red-300">{serverState.fieldErrors.recipientEmail}</p>
            ) : null}
          </label>

          <label className="block">
            <span className="text-sm font-medium text-white">Předmět</span>
            <input
              type="text"
              name="subject"
              defaultValue={defaultSubject}
              maxLength={160}
              className={inputClassName}
            />
            {serverState.fieldErrors?.subject ? (
              <p className="mt-2 text-sm text-red-300">{serverState.fieldErrors.subject}</p>
            ) : null}
          </label>

          <SubmitButton />
        </form>
      ) : null}
    </section>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-10 items-center justify-center rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Odesílám..." : "Potvrdit odeslání"}
    </button>
  );
}

const inputClassName =
  "mt-1.5 w-full rounded-[0.85rem] border border-white/8 bg-black/20 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[var(--color-accent)]/55";
