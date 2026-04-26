"use client";

import type { TimeSlotOption } from "@/features/booking/lib/booking-time-slots";
import { cn } from "@/lib/utils";

type SuggestedSlotsProps = {
  selectedKey: string;
  slots: TimeSlotOption[];
  getAriaLabel?: (slot: TimeSlotOption) => string;
  formatDate: (value: string) => string;
  formatTime: (value: string) => string;
  onSelect: (slot: TimeSlotOption) => void;
};

export function SuggestedSlots({
  selectedKey,
  slots,
  getAriaLabel,
  formatDate,
  formatTime,
  onSelect,
}: SuggestedSlotsProps) {
  if (slots.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3 sm:space-y-3.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-[var(--color-foreground)]">
            Nejbližší dostupné termíny
          </h4>
          <p className="mt-1 text-sm text-[var(--color-muted)] max-sm:hidden">
            Nejrychlejší cesta k rezervaci je vybrat jeden z nejbližších volných časů.
          </p>
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3">
        {slots.map((slot) => {
          const isSelected = slot.key === selectedKey;

          return (
            <button
              key={slot.key}
              type="button"
              aria-label={getAriaLabel?.(slot)}
              onClick={() => onSelect(slot)}
              className={cn(
                "rounded-3xl border bg-white px-4 py-3 text-left transition-all duration-150 sm:px-5 sm:py-4",
                isSelected
                  ? "border-[var(--color-accent)] bg-[var(--color-surface-strong)]/45 shadow-[0_10px_24px_rgba(0,0,0,0.08)]"
                  : "border-black/6 hover:border-[var(--color-accent)]/25 hover:bg-[var(--color-surface)]/35",
              )}
            >
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)] sm:text-xs sm:tracking-[0.22em]">
                {formatDate(slot.startsAt)}
              </p>
              <p className="mt-2 text-xl font-semibold text-[var(--color-foreground)] sm:mt-3 sm:text-2xl">
                {formatTime(slot.startsAt)}
              </p>
              <p className="mt-2 text-sm text-[var(--color-muted)] max-sm:hidden">
                Jedním klikem vyberete termín a přejdete na kontakt.
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
