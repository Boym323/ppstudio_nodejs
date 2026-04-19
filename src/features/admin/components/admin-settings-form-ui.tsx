"use client";

import { useFormStatus } from "react-dom";

type SettingsActionStateLike = {
  status: "idle" | "success" | "error";
  successMessage?: string;
  formError?: string;
};

export const settingsControlClassName =
  "mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/32 focus:border-[var(--color-accent)]/60";

export const settingsSelectClassName = settingsControlClassName;

export const settingsTextareaClassName =
  "mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/32 focus:border-[var(--color-accent)]/60";

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.25rem] border border-white/8 bg-white/5 p-4 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]">
      <div className="border-b border-white/10 pb-4">
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-accent-soft)]/80">
          Globální blok
        </p>
        <h4 className="mt-2 font-display text-xl text-white">{title}</h4>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/64">{description}</p>
      </div>
      <div className="pt-4">{children}</div>
    </section>
  );
}

export function SettingsField({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-white">{label}</span>
      {hint ? <p className="mt-1 text-sm leading-6 text-white/54">{hint}</p> : null}
      {children}
      {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
    </label>
  );
}

export function SettingsStatus({
  status,
  message,
}: {
  status: "success" | "error";
  message?: string;
}) {
  if (!message) {
    return null;
  }

  return (
    <div
      className={
        status === "success"
          ? "rounded-[1.25rem] border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-50"
          : "rounded-[1.25rem] border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-50"
      }
    >
      {message}
    </div>
  );
}

export function SettingsFormMessages({
  serverState,
}: {
  serverState: SettingsActionStateLike;
}) {
  return (
    <>
      <SettingsStatus
        status="success"
        message={serverState.status === "success" ? serverState.successMessage : undefined}
      />
      <SettingsStatus
        status="error"
        message={serverState.status === "error" ? serverState.formError : undefined}
      />
    </>
  );
}

export function SettingsFormFooter({
  note,
  label = "Uložit změny",
}: {
  note?: string;
  label?: string;
}) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm leading-6 text-white/58">
        {note ?? "Změny se ukládají hned a projeví se ve webu i v e-mailech."}
      </p>
      <SettingsSubmitButton label={label} />
    </div>
  );
}

export function SettingsSubmitButton({ label = "Uložit změny" }: { label?: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[var(--color-accent-contrast)] shadow-[0_10px_30px_rgba(0,0,0,0.18)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Ukládám..." : label}
    </button>
  );
}
