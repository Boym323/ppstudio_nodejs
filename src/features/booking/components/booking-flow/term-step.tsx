import type { RefObject } from "react";
import Link from "next/link";

import type { TimeSlotOption } from "@/features/booking/lib/booking-time-slots";
import type { TimeSlotGroupData } from "@/features/booking/lib/booking-time-slots";
import { cn } from "@/lib/utils";

import { SuggestedSlots } from "../suggested-slots";
import { TimeSlotGroup } from "../time-slot-group";
import {
  buildSlotAriaLabel,
  calendarGridColumnsStyle,
  formatCalendarMonthLabel,
  formatDateKeyLabel,
  formatSlotDate,
  formatSlotTime,
  getSlotDayNumber,
  WEEKDAY_LABELS,
} from "./helpers";

type BookingTermStepProps = {
  sectionRef: RefObject<HTMLDivElement | null>;
  availableTimesRef: RefObject<HTMLDivElement | null>;
  highlighted: boolean;
  selectedService?: {
    id: string;
  };
  selectableTimeOptions: TimeSlotOption[];
  suggestedSlots: TimeSlotOption[];
  selectedTimeOptionKey: string;
  availableMonths: string[];
  effectiveVisibleMonthKey: string;
  calendarCells: Array<string | null>;
  availableSlotsByDate: Map<string, TimeSlotOption[]>;
  effectiveSelectedDateKey: string;
  selectedDateSlots: TimeSlotOption[];
  selectedDateSlotGroups: TimeSlotGroupData[];
  canGoToStep3: boolean;
  slotError?: string;
  onContinue: () => void;
  onReturnToServiceSelection: () => void;
  onSuggestedSlotSelect: (slot: TimeSlotOption) => void;
  onCalendarSlotSelect: (slot: TimeSlotOption) => void;
  onSelectDate: (dateKey: string) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
};

export function BookingTermStep({
  sectionRef,
  availableTimesRef,
  highlighted,
  selectedService,
  selectableTimeOptions,
  suggestedSlots,
  selectedTimeOptionKey,
  availableMonths,
  effectiveVisibleMonthKey,
  calendarCells,
  availableSlotsByDate,
  effectiveSelectedDateKey,
  selectedDateSlots,
  selectedDateSlotGroups,
  canGoToStep3,
  slotError,
  onContinue,
  onReturnToServiceSelection,
  onSuggestedSlotSelect,
  onCalendarSlotSelect,
  onSelectDate,
  onPreviousMonth,
  onNextMonth,
}: BookingTermStepProps) {
  return (
    <div
      ref={sectionRef}
      className={cn(
        "space-y-4 rounded-3xl transition-all duration-300 p-3",
        highlighted
          ? "bg-[var(--color-surface-strong)]/30 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
          : "",
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">
            Krok 2
          </p>
          <h2 className="mt-2 font-display text-3xl text-[var(--color-foreground)]">
            Vyberte termín
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            Zvolte nejbližší volný čas, nebo si v kalendáři najděte jiný den.
          </p>
        </div>
        {canGoToStep3 ? (
          <button
            type="button"
            onClick={onContinue}
            className="rounded-full border border-black/8 px-4 py-2 text-sm font-semibold text-[var(--color-foreground)]"
          >
            Pokračovat
          </button>
        ) : null}
      </div>

      {!selectedService ? (
        <div className="rounded-3xl border border-dashed border-black/10 bg-[var(--color-surface)]/20 px-5 py-6 text-sm text-[var(--color-muted)]">
          Nejprve vyberte službu. Pak zobrazíme jen kompatibilní termíny.
        </div>
      ) : selectableTimeOptions.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-black/10 bg-[var(--color-surface)]/20 px-5 py-6">
          <p className="text-sm leading-6 text-[var(--color-muted)]">
            Pro tuto službu teď není publikovaný volný termín s dostatečnou délkou. Ve studiu ve Zlíně vám rádi
            doporučíme nejbližší vhodné okno, nebo můžete zkusit jinou službu z nabídky.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/kontakt"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-foreground)] px-4 py-2.5 text-sm font-semibold text-white"
            >
              Kontaktovat studio
            </Link>
            <button
              type="button"
              onClick={onReturnToServiceSelection}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/8 px-4 py-2.5 text-sm font-semibold text-[var(--color-foreground)]"
            >
              Vrátit se k výběru
            </button>
            <Link
              href="/cenik"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/8 px-4 py-2.5 text-sm font-semibold text-[var(--color-foreground)]"
            >
              Zobrazit ceník
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <SuggestedSlots
            selectedKey={selectedTimeOptionKey}
            slots={suggestedSlots}
            getAriaLabel={buildSlotAriaLabel}
            formatDate={formatSlotDate}
            formatTime={formatSlotTime}
            onSelect={onSuggestedSlotSelect}
          />

          <div className="rounded-3xl border border-black/6 bg-[var(--color-surface)]/18 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)]">
                  Jiný termín
                </p>
                <p className="mt-2 text-sm font-medium text-[var(--color-foreground)]">
                  {formatCalendarMonthLabel(effectiveVisibleMonthKey)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onPreviousMonth}
                  disabled={availableMonths.indexOf(effectiveVisibleMonthKey) <= 0}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/8 text-lg text-[var(--color-foreground)] disabled:opacity-40"
                  aria-label="Předchozí měsíc"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={onNextMonth}
                  disabled={availableMonths.indexOf(effectiveVisibleMonthKey) >= availableMonths.length - 1}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/8 text-lg text-[var(--color-foreground)] disabled:opacity-40"
                  aria-label="Další měsíc"
                >
                  ›
                </button>
              </div>
            </div>

            <div
              className="mt-4 grid gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]"
              style={calendarGridColumnsStyle}
            >
              {WEEKDAY_LABELS.map((dayLabel) => (
                <span key={dayLabel}>{dayLabel}</span>
              ))}
            </div>

            <div className="mt-3 grid gap-2" style={calendarGridColumnsStyle}>
              {calendarCells.map((dateKey, index) => {
                if (!dateKey) {
                  return <div key={`calendar-empty-${index}`} className="h-12 rounded-2xl bg-[var(--color-surface)]/20" />;
                }

                const dateSlots = availableSlotsByDate.get(dateKey) ?? [];
                const hasSlots = dateSlots.length > 0;
                const hasSelectableSlots = dateSlots.some((slot) => !slot.isDisabled);
                const isDaySelectable = hasSelectableSlots;
                const isSelectedDate = dateKey === effectiveSelectedDateKey;

                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => onSelectDate(dateKey)}
                    disabled={!isDaySelectable}
                    className={cn(
                      "relative h-12 rounded-2xl border text-sm font-semibold",
                      hasSlots
                        ? "border-black/8 bg-white text-[var(--color-foreground)] hover:bg-[var(--color-surface)]/35"
                        : "border-transparent bg-[var(--color-surface)]/20 text-[var(--color-muted)]/50",
                      !hasSelectableSlots && hasSlots
                        ? "border-black/6 bg-[var(--color-surface)]/30 text-[var(--color-muted)]"
                        : "",
                      isSelectedDate && hasSlots
                        ? "border-[var(--color-accent)] bg-[var(--color-surface-strong)]/45"
                        : "",
                    )}
                    aria-label={`Vybrat den ${formatDateKeyLabel(dateKey)}`}
                  >
                    {getSlotDayNumber(dateKey)}
                    {hasSelectableSlots ? (
                      <span className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[var(--color-accent)]" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div ref={availableTimesRef} tabIndex={-1} className="space-y-4 outline-none">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-[var(--color-foreground)]">
                  Dostupné časy
                </h4>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  {effectiveSelectedDateKey
                    ? formatDateKeyLabel(effectiveSelectedDateKey)
                    : "Vyberte den v kalendáři."}
                </p>
              </div>
            </div>

            {selectedDateSlots.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-black/10 bg-[var(--color-surface)]/20 px-5 py-6 text-sm text-[var(--color-muted)]">
                Vyberte v kalendáři den se zvýrazněným termínem.
              </div>
            ) : null}

            {selectedDateSlotGroups.map((group) => (
              <TimeSlotGroup
                key={group.key}
                label={group.label}
                slots={group.slots}
                selectedKey={selectedTimeOptionKey}
                getAriaLabel={buildSlotAriaLabel}
                formatTime={formatSlotTime}
                onSelect={onCalendarSlotSelect}
              />
            ))}

            {selectedDateSlots.length > 0 && selectedDateSlots.every((slot) => slot.isDisabled) ? (
              <div className="rounded-3xl border border-dashed border-black/10 bg-[var(--color-surface)]/20 px-5 py-6 text-sm text-[var(--color-muted)]">
                Pro vybraný den už nejsou volné žádné časy. Zkuste prosím jiný den.
              </div>
            ) : null}
          </div>
        </div>
      )}

      {slotError ? (
        <p className="text-sm text-red-700">{slotError}</p>
      ) : null}
    </div>
  );
}
