"use client";

import { cn } from "@/lib/utils";

type TimeSlotButtonProps = {
  ariaLabel?: string;
  isDisabled?: boolean;
  isSelected?: boolean;
  label: string;
  onClick: () => void;
};

export function TimeSlotButton({
  ariaLabel,
  isDisabled = false,
  isSelected = false,
  label,
  onClick,
}: TimeSlotButtonProps) {
  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={isSelected}
      className={cn(
        "inline-flex min-h-14 items-center justify-center rounded-2xl border px-4 py-3 text-sm font-semibold transition-all duration-100 ease-out outline-none",
        isSelected
          ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white shadow-[0_8px_20px_rgba(0,0,0,0.16)] ring-2 ring-[var(--color-accent)]/30 ring-offset-1 ring-offset-white"
          : "border-[var(--color-accent)]/18 bg-[var(--color-surface-strong)]/24 text-[var(--color-foreground)] hover:border-[var(--color-accent)]/45 hover:bg-white active:scale-[0.99] focus-visible:border-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/20",
        isDisabled
          ? "cursor-not-allowed border-black/6 bg-[var(--color-surface)]/25 text-[var(--color-muted)] opacity-35 shadow-none ring-0 hover:border-black/6 hover:bg-[var(--color-surface)]/25 hover:text-[var(--color-muted)]"
          : "",
      )}
    >
      {label}
    </button>
  );
}
