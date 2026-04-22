"use client";

import Link from "next/link";
import { useActionState } from "react";

import { activateAdminInviteAction } from "@/features/admin/actions/activate-admin-invite-action";
import { initialAdminInviteActivationActionState } from "@/features/admin/actions/update-admin-invite-activation-action-state";

type AdminInviteActivationFormProps = {
  token: string;
  userName: string;
  userEmail: string;
  roleLabel: string;
};

export function AdminInviteActivationForm({
  token,
  userName,
  userEmail,
  roleLabel,
}: AdminInviteActivationFormProps) {
  const [serverState, formAction] = useActionState(
    activateAdminInviteAction,
    initialAdminInviteActivationActionState,
  );

  if (serverState.status === "success") {
    return (
      <section className="rounded-[var(--radius-panel)] border border-white/10 bg-white/6 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-xl">
        <p className="text-xs uppercase tracking-[0.35em] text-[var(--color-accent-soft)]">
          Pozvánka do administrace
        </p>
        <h1 className="mt-4 font-display text-4xl text-white">Heslo je připravené</h1>
        <p className="mt-4 text-sm leading-6 text-white/72">
          {serverState.successMessage}
        </p>
        <Link
          href="/admin/prihlaseni?invite=activated"
          className="mt-7 inline-flex h-12 items-center rounded-full bg-[var(--color-accent)] px-5 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-accent-contrast)]"
        >
          Pokračovat na přihlášení
        </Link>
      </section>
    );
  }

  return (
    <section className="rounded-[var(--radius-panel)] border border-white/10 bg-white/6 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-xl">
      <p className="text-xs uppercase tracking-[0.35em] text-[var(--color-accent-soft)]">
        Pozvánka do administrace
      </p>
      <h1 className="mt-4 font-display text-4xl text-white">Nastavení hesla</h1>
      <p className="mt-3 text-sm leading-6 text-white/72">
        {userName}, dokončete aktivaci přístupu pro účet {userEmail}. Role: {roleLabel}.
      </p>

      {serverState.status === "error" && serverState.formError ? (
        <p className="mt-6 rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
          {serverState.formError}
        </p>
      ) : null}

      <form action={formAction} className="mt-7 space-y-5">
        <input type="hidden" name="token" value={token} />

        <label className="block space-y-2">
          <span className="text-sm text-white/78">Nové heslo</span>
          <input
            required
            type="password"
            name="password"
            autoComplete="new-password"
            className="h-12 w-full rounded-2xl border border-white/12 bg-black/10 px-4 text-white outline-none transition placeholder:text-white/28 focus:border-[var(--color-accent)]"
            placeholder="Minimálně 8 znaků"
          />
          {serverState.fieldErrors?.password ? (
            <span className="text-sm text-red-300">{serverState.fieldErrors.password}</span>
          ) : null}
        </label>

        <label className="block space-y-2">
          <span className="text-sm text-white/78">Potvrzení hesla</span>
          <input
            required
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            className="h-12 w-full rounded-2xl border border-white/12 bg-black/10 px-4 text-white outline-none transition placeholder:text-white/28 focus:border-[var(--color-accent)]"
            placeholder="Zopakujte heslo"
          />
          {serverState.fieldErrors?.confirmPassword ? (
            <span className="text-sm text-red-300">{serverState.fieldErrors.confirmPassword}</span>
          ) : null}
        </label>

        <button
          type="submit"
          className="h-12 w-full rounded-full bg-[var(--color-accent)] text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-contrast)] transition hover:brightness-105"
        >
          Uložit heslo
        </button>
      </form>
    </section>
  );
}
