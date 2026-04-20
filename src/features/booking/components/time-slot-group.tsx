"use client";

import type { TimeSlotOption } from "@/features/booking/lib/booking-time-slots";

import { TimeSlotButton } from "./time-slot-button";

type TimeSlotGroupProps = {
  label: string | null;
  onSelect: (slot: TimeSlotOption) => void;
  selectedKey: string;
  slots: TimeSlotOption[];
  formatTime: (value: string) => string;
};

export function TimeSlotGroup({
  label,
  onSelect,
  selectedKey,
  slots,
  formatTime,
}: TimeSlotGroupProps) {
  return (
    <section className="space-y-3">
      {label ? (
        <div className="flex items-center gap-3">
          <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
            {label}
          </h4>
          <div className="h-px flex-1 bg-black/6" />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {slots.map((slot) => (
          <TimeSlotButton
            key={slot.key}
            label={formatTime(slot.startsAt)}
            isDisabled={slot.isDisabled}
            isSelected={slot.key === selectedKey}
            onClick={() => onSelect(slot)}
          />
        ))}
      </div>
    </section>
  );
}
