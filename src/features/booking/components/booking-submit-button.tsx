"use client";

import { useFormStatus } from "react-dom";

type BookingSubmitButtonProps = {
  disabled?: boolean;
};

export function BookingSubmitButton({ disabled = false }: BookingSubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  return (
    <button
      type="submit"
      disabled={isDisabled}
      className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-accent-contrast)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Potvrzuji rezervaci..." : "Potvrdit rezervaci"}
    </button>
  );
}
