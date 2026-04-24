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
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-[var(--color-foreground)]">
            Nejbližší dostupné termíny
          </h4>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Nejrychlejší cesta k rezervaci je vybrat jeden z nejbližších volných časů.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {slots.map((slot) => {
          const isSelected = slot.key === selectedKey;

          return (
            <button
              key={slot.key}
              type="button"
              aria-label={getAriaLabel?.(slot)}
              onClick={() => onSelect(slot)}
              className={cn(
                "rounded-3xl border bg-white px-5 py-4 text-left transition-all duration-150",
                isSelected
                  ? "border-[var(--color-accent)] bg-[var(--color-surface-strong)]/45 shadow-[0_10px_24px_rgba(0,0,0,0.08)]"
                  : "border-black/6 hover:border-[var(--color-accent)]/25 hover:bg-[var(--color-surface)]/35",
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)]">
                {formatDate(slot.startsAt)}
              </p>
              <p className="mt-3 text-2xl font-semibold text-[var(--color-foreground)]">
                {formatTime(slot.startsAt)}
              </p>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                Jedním klikem vyberete termín a přejdete na kontakt.
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
