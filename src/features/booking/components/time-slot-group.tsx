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
    <section className="space-y-2">
      {label ? (
        <div className="flex items-center gap-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
            {label}
          </h4>
          <div className="h-px flex-1 bg-black/6" />
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-1.5 max-[360px]:grid-cols-1 sm:gap-2 sm:[grid-template-columns:repeat(auto-fit,minmax(5.5rem,1fr))]">
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
