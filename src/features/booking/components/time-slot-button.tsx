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
        "inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-1.5 text-[13px] font-semibold transition-colors outline-none sm:text-sm",
        isSelected
          ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-contrast)] shadow-sm"
          : "border-black/8 bg-white text-[var(--color-foreground)] hover:border-[var(--color-accent)]/35 hover:bg-[var(--color-surface)]/45 focus-visible:border-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/20",
        isDisabled
          ? "cursor-not-allowed border-black/6 bg-[var(--color-surface)]/25 text-[var(--color-muted)] opacity-45 hover:border-black/6 hover:bg-[var(--color-surface)]/25"
          : "",
      )}
    >
      {label}
    </button>
  );
}
