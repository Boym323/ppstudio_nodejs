"use client";

import { useFormStatus } from "react-dom";

export function BookingSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-accent-contrast)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Potvrzuji rezervaci..." : "Potvrdit rezervaci"}
    </button>
  );
}
