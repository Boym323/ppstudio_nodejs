"use client";

import { cn } from "@/lib/utils";

type TimeSlotButtonProps = {
  isDisabled?: boolean;
  isSelected?: boolean;
  label: string;
  onClick: () => void;
};

export function TimeSlotButton({
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
      aria-pressed={isSelected}
      className={cn(
        "inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-1.5 text-[13px] font-semibold transition-all duration-100 ease-out outline-none sm:text-sm",
        isSelected
          ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white shadow-[0_8px_20px_rgba(0,0,0,0.16)] ring-2 ring-[var(--color-accent)]/30 ring-offset-1 ring-offset-white"
          : "border-black/8 bg-[var(--color-surface)]/45 text-[var(--color-muted)] hover:border-[var(--color-accent)]/30 hover:bg-white hover:text-[var(--color-foreground)] active:scale-[0.99] focus-visible:border-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/20",
        isDisabled
          ? "cursor-not-allowed border-black/6 bg-[var(--color-surface)]/25 text-[var(--color-muted)] opacity-35 shadow-none ring-0 hover:border-black/6 hover:bg-[var(--color-surface)]/25 hover:text-[var(--color-muted)]"
          : "",
      )}
    >
      {label}
    </button>
  );
}
