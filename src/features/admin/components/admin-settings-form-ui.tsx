"use client";

import { useFormStatus } from "react-dom";

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
    <section className="rounded-[1.25rem] border border-white/8 bg-white/5 p-4">
      <div className="border-b border-white/10 pb-4">
        <h4 className="font-display text-xl text-white">{title}</h4>
        <p className="mt-2 text-sm leading-6 text-white/62">{description}</p>
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
      {hint ? <p className="mt-1 text-sm leading-6 text-white/50">{hint}</p> : null}
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

export function SettingsSubmitButton({ label = "Uložit změny" }: { label?: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Ukládám..." : label}
    </button>
  );
}
