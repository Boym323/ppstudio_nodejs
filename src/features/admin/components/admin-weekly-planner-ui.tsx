import { BookingStatus } from "@prisma/client";
import Link from "next/link";

import type { PlannerDay } from "@/features/admin/lib/admin-slots";
import { cn } from "@/lib/utils";
import { AdminEscapeKeyClose } from "@/features/admin/components/admin-drawer-escape-close";

const PLANNER_START_HOUR = 6;
const PLANNER_END_HOUR = 20;
const PLANNER_CELL_COUNT = (PLANNER_END_HOUR - PLANNER_START_HOUR) * 2;
const PLANNER_DESKTOP_ROW_CLASS = "grid grid-rows-[repeat(28,minmax(0,1.2rem))] gap-y-1";
const PLANNER_MOBILE_ROW_CLASS = "grid grid-rows-[repeat(28,minmax(0,2rem))] gap-y-1.5";

export type CellTone = "available" | "booked" | "completed" | "locked" | "inactive" | "past" | "empty";

export type DraftSelection = {
  dateKey: string;
  mode: "add" | "remove";
  anchorCell: number;
  hoverCell: number;
};

export type PlannerSelection = {
  dateKey: string;
  startCell: number;
  endCell: number;
  tone: CellTone;
  editable: boolean;
  bookingStatus?: BookingStatus;
};

export type WeeklyTemplateInput = Array<{
  weekday: number;
  intervals: Array<{
    startCell: number;
    endCell: number;
  }>;
}>;

export function getCellTone(day: PlannerDay, cellIndex: number): CellTone {
  if (day.cells.booked[cellIndex]) {
    return "booked";
  }

  if (day.cells.completed[cellIndex]) {
    return "completed";
  }

  if (day.cells.locked[cellIndex]) {
    return "locked";
  }

  if (day.cells.inactive[cellIndex]) {
    return "inactive";
  }

  if (day.cells.available[cellIndex]) {
    return "available";
  }

  if (day.cells.past[cellIndex]) {
    return "past";
  }

  return "empty";
}

export function getSelectionRange(draft: DraftSelection) {
  return {
    startCell: Math.min(draft.anchorCell, draft.hoverCell),
    endCell: Math.max(draft.anchorCell, draft.hoverCell) + 1,
  };
}

export function getDayActionHref(baseHref: string, weekKey: string, dayKey: string) {
  return `${baseHref}?week=${weekKey}&day=${dayKey}`;
}

export function getWeekdayTemplateFromDays(days: PlannerDay[]): WeeklyTemplateInput {
  return days.map((day, weekday) => ({
    weekday,
    intervals: day.availableIntervals.map((interval) => ({
      startCell: interval.startCell,
      endCell: interval.endCell,
    })),
  }));
}

export function isEditableTone(tone: CellTone) {
  return tone === "available" || tone === "empty";
}

export function formatDayActionLabel(day: PlannerDay) {
  return `${day.shortLabel} ${day.monthDayLabel}`;
}

export function formatRangeLabel(startCell: number, endCell: number) {
  const plannerStartMinutes = PLANNER_START_HOUR * 60;
  const startMinutes = plannerStartMinutes + startCell * 30;
  const endMinutes = plannerStartMinutes + endCell * 30;
  const formatTime = (minutes: number) =>
    `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

  return `${formatTime(startMinutes)} - ${formatTime(endMinutes)}`;
}

function getSummaryLine(day: PlannerDay) {
  return `${day.availableIntervals.length} volných oken · ${day.bookings.length} rezervací · ${day.lockedIntervals.length} omezení`;
}

function getToneLabel(tone: CellTone) {
  if (tone === "available") {
    return "volný blok";
  }

  if (tone === "booked") {
    return "rezervace";
  }

  if (tone === "locked") {
    return "omezení";
  }

  if (tone === "completed") {
    return "hotovo";
  }

  if (tone === "inactive") {
    return "neaktivní čas";
  }

  if (tone === "past") {
    return "minulý čas";
  }

  return "prázdný blok";
}

function getSelectionToneLabel(tone: CellTone) {
  if (tone === "available") {
    return "Dostupnost";
  }

  if (tone === "booked") {
    return "Rezervace";
  }

  if (tone === "completed") {
    return "Hotovo";
  }

  if (tone === "locked") {
    return "Omezené";
  }

  if (tone === "inactive") {
    return "Neaktivní";
  }

  if (tone === "past") {
    return "Minulý čas";
  }

  return "Prázdný blok";
}

function getSelectionInterval(
  day: PlannerDay,
  selection: PlannerSelection | null,
) {
  if (!selection || selection.dateKey !== day.dateKey) {
    return null;
  }

  return (
    day.intervals.find(
      (interval) =>
        interval.startCell === selection.startCell && interval.endCell === selection.endCell,
    ) ??
    day.intervals.find(
      (interval) =>
        selection.startCell >= interval.startCell && selection.endCell <= interval.endCell,
    ) ??
    null
  );
}

function getSelectionBooking(day: PlannerDay, selection: PlannerSelection | null) {
  if (!selection || selection.dateKey !== day.dateKey) {
    return null;
  }

  return (
    day.bookings.find(
      (booking) =>
        booking.startCell === selection.startCell && booking.endCell === selection.endCell,
    ) ??
    null
  );
}

function ActionButton({
  children,
  tone = "default",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "default" | "accent" | "ghost" | "danger";
}) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center rounded-full px-3.5 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50",
        tone === "accent" && "border border-[var(--color-accent)]/42 bg-[rgba(190,160,120,0.15)] text-white",
        tone === "default" && "border border-white/10 bg-white/[0.06] text-white/84",
        tone === "ghost" && "border border-transparent bg-transparent text-white/60 hover:text-white/84",
        tone === "danger" && "border border-rose-300/26 bg-rose-300/10 text-white/88",
        props.className,
      )}
    >
      {children}
    </button>
  );
}

export function WeekToolbar({
  baseHref,
  previousWeekKey,
  todayKey,
  nextWeekKey,
  currentDayKey,
  weekRangeLabel,
  title,
  hasUnsavedChanges,
  onCopyWeek,
  onSaveTemplate,
  onApplyTemplate,
  onOpenInspector,
  pending,
}: {
  baseHref: string;
  previousWeekKey: string;
  todayKey: string;
  nextWeekKey: string;
  currentDayKey: string;
  weekRangeLabel: string;
  title: string;
  hasUnsavedChanges: boolean;
  onCopyWeek: () => void;
  onSaveTemplate: () => void;
  onApplyTemplate: () => void;
  onOpenInspector: () => void;
  pending: boolean;
}) {
  return (
    <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.04] px-3.5 py-3.5 sm:px-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">{title}</p>
            {hasUnsavedChanges ? (
              <span className="rounded-full border border-[var(--color-accent)]/30 bg-[rgba(190,160,120,0.12)] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/76">
                Neuloženo
              </span>
            ) : null}
          </div>
          <ActionButton className="xl:hidden" onClick={onOpenInspector}>
            Inspektor dne
          </ActionButton>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`${baseHref}?week=${previousWeekKey}&day=${currentDayKey}`}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/78"
              aria-label="Předchozí týden"
            >
              ←
            </Link>
            <Link
              href={`${baseHref}?week=${todayKey}&day=${todayKey}`}
              className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-white/82"
            >
              Tento týden
            </Link>
            <Link
              href={`${baseHref}?week=${nextWeekKey}&day=${currentDayKey}`}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/78"
              aria-label="Další týden"
            >
              →
            </Link>
            <p className="rounded-full border border-white/10 bg-black/20 px-3.5 py-2 text-sm font-medium text-white/88">
              {weekRangeLabel}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
          <ActionButton onClick={onCopyWeek} disabled={pending}>
            Kopírovat týden
          </ActionButton>

          <details className="group relative">
            <summary className="list-none">
              <span className="inline-flex cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-2 text-sm font-medium text-white/84">
                Šablony ▾
              </span>
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-56 rounded-[1rem] border border-white/10 bg-[#171419] p-2 shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
              <button
                type="button"
                onClick={onSaveTemplate}
                className="flex w-full rounded-[0.9rem] px-3 py-2 text-left text-sm text-white/82 hover:bg-white/[0.05]"
              >
                Uložit týden jako šablonu
              </button>
              <button
                type="button"
                onClick={onApplyTemplate}
                disabled={pending}
                className="flex w-full rounded-[0.9rem] px-3 py-2 text-left text-sm text-white/82 hover:bg-white/[0.05] disabled:opacity-50"
              >
                Použít uloženou šablonu
              </button>
            </div>
          </details>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlannerLegend({ legend }: { legend: Array<{ tone: CellTone | "past"; label: string }> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {legend.map((item) => (
        <span
          key={item.label}
          className={cn(
            "rounded-full border px-2.5 py-1 text-[10px] font-medium text-white/82",
            item.tone === "available" && "border-emerald-300/35 bg-emerald-300/15 text-white/86",
            item.tone === "booked" && "border-rose-300/35 bg-rose-300/16 text-white/86",
            item.tone === "completed" && "border-cyan-300/30 bg-cyan-300/14 text-white/86",
            item.tone === "locked" && "border-amber-200/30 bg-amber-200/16 text-white/86",
            item.tone === "inactive" && "border-slate-300/22 bg-slate-300/12 text-white/82",
            item.tone === "past" && "border-white/10 bg-white/6 text-white/70",
          )}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function PlannerFeedback({
  tone,
  message,
}: {
  tone: "success" | "error" | "info";
  message: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[1rem] border px-4 py-3 text-sm leading-6",
        tone === "success" && "border-emerald-300/25 bg-emerald-300/10 text-white/88",
        tone === "error" && "border-rose-300/22 bg-rose-300/10 text-white/88",
        tone === "info" && "border-white/10 bg-white/[0.04] text-white/72",
      )}
    >
      {message}
    </div>
  );
}

export function MobileDayPicker({
  days,
  selectedDayKey,
  baseHref,
  weekKey,
  onSelectDay,
}: {
  days: PlannerDay[];
  selectedDayKey: string;
  baseHref: string;
  weekKey: string;
  onSelectDay: (dayKey: string) => void;
}) {
  return (
    <div className="lg:hidden">
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {days.map((day) => (
          <Link
            key={day.dateKey}
            href={getDayActionHref(baseHref, weekKey, day.dateKey)}
            onClick={() => onSelectDay(day.dateKey)}
            aria-label={`${day.label}, ${day.availableIntervals.length} volná okna`}
            className={cn(
              "min-w-0 rounded-[0.9rem] border px-1.5 py-2.5 text-center",
              day.dateKey === selectedDayKey
                ? "border-[var(--color-accent)]/45 bg-[rgba(190,160,120,0.14)]"
                : "border-white/10 bg-white/[0.04]",
            )}
          >
            <p className="text-[10px] uppercase text-white/46">{day.shortLabel}</p>
            <p className="mt-1 text-xl font-semibold leading-none text-white">{day.dayNumber}</p>
            <p className="mt-1 text-[10px] leading-none text-white/58">{day.availableIntervals.length} okna</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function isCellHighlighted(
  dayKey: string,
  cellIndex: number,
  draft: DraftSelection | null,
  selectedSelection: PlannerSelection | null,
) {
  const draftRange = draft ? getSelectionRange(draft) : null;

  if (
    draft &&
    dayKey === draft.dateKey &&
    draftRange &&
    cellIndex >= draftRange.startCell &&
    cellIndex < draftRange.endCell
  ) {
    return true;
  }

  if (
    selectedSelection &&
    dayKey === selectedSelection.dateKey &&
    cellIndex >= selectedSelection.startCell &&
    cellIndex < selectedSelection.endCell
  ) {
    return true;
  }

  return false;
}

export function GridCell({
  tone,
  selected,
  hourBoundary,
  label,
  onPointerDown,
  onPointerMove,
}: {
  tone: CellTone;
  selected: boolean;
  hourBoundary: boolean;
  label: string;
  onPointerDown: () => void;
  onPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      className={cn(
        "h-8 w-full rounded-[0.65rem] border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/70 lg:h-[1.2rem]",
        hourBoundary ? "border-t-white/22" : "border-t-white/10",
        tone === "available" && "border-emerald-300/25 bg-emerald-300/66 hover:bg-emerald-300/82",
        tone === "booked" && "cursor-default border-rose-300/30 bg-rose-300/70",
        tone === "completed" && "cursor-default border-cyan-300/30 bg-cyan-300/60",
        tone === "locked" && "cursor-default border-amber-200/24 bg-amber-200/42",
        tone === "inactive" && "cursor-default border-slate-300/16 bg-slate-300/24",
        tone === "past" && "cursor-default border-white/6 bg-white/[0.04]",
        tone === "empty" && "border-white/10 bg-white/[0.07] hover:bg-white/[0.11]",
        selected &&
          "z-10 scale-[1.01] border-[var(--color-accent)]/70 ring-2 ring-[var(--color-accent)]/90 ring-offset-1 ring-offset-[#141217] shadow-[0_0_0_1px_rgba(190,160,120,0.22),0_12px_24px_rgba(0,0,0,0.28)]",
      )}
    />
  );
}

export function DesktopWeekGrid({
  days,
  timeLabels,
  draft,
  selectedSelection,
  onCellStart,
  onCellMove,
  selectedDayKey,
  baseHref,
  weekKey,
  onSelectDay,
}: {
  days: PlannerDay[];
  timeLabels: string[];
  draft: DraftSelection | null;
  selectedSelection: PlannerSelection | null;
  onCellStart: (day: PlannerDay, cellIndex: number) => void;
  onCellMove: (dayKey: string, cellIndex: number, buttons: number) => void;
  selectedDayKey: string;
  baseHref: string;
  weekKey: string;
  onSelectDay: (dayKey: string) => void;
}) {
  const rowIndexes = Array.from({ length: PLANNER_CELL_COUNT }, (_, index) => index);

  return (
    <div className="hidden overflow-hidden rounded-[1.45rem] border border-white/8 bg-[#131116] lg:block">
      <div className="overflow-x-auto">
        <div className="min-w-[920px] px-4 py-4 xl:px-5">
          <div className="grid grid-cols-[58px_repeat(7,minmax(120px,1fr))] gap-3 xl:grid-cols-[72px_repeat(7,minmax(128px,1fr))]">
            <div />
            {days.map((day) => (
              <Link
                key={day.dateKey}
                href={getDayActionHref(baseHref, weekKey, day.dateKey)}
                onClick={() => onSelectDay(day.dateKey)}
                className={cn(
                  "rounded-[1rem] border px-3 py-3 text-left transition",
                  day.dateKey === selectedDayKey
                    ? "border-[var(--color-accent)]/55 bg-[rgba(190,160,120,0.12)] shadow-[inset_0_0_0_1px_rgba(190,160,120,0.18)]"
                    : "border-white/8 bg-white/[0.03] hover:border-white/14 hover:bg-white/[0.05]",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-white/44">{day.shortLabel}</p>
                  {day.dateKey === selectedDayKey ? (
                    <span className="rounded-full border border-[var(--color-accent)]/36 bg-[rgba(190,160,120,0.12)] px-2 py-0.5 text-[10px] font-medium text-white/80">
                      Vybráno
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <p className="text-3xl font-semibold leading-none text-white">{day.dayNumber}</p>
                  <p className="text-xs text-white/44">{day.monthLabel}</p>
                </div>
                <p className="mt-2 text-xs text-white/58">{day.availableIntervals.length} volná okna</p>
              </Link>
            ))}

            <div className={cn(PLANNER_DESKTOP_ROW_CLASS, "pt-1")}>
              {rowIndexes.map((cellIndex) => (
                <div
                  key={`label-${cellIndex}`}
                  className={cn(
                    "flex h-[1.2rem] items-start border-t text-[10px] uppercase tracking-[0.16em]",
                    cellIndex % 2 === 0 ? "border-white/16 text-white/58" : "border-white/7 text-white/26",
                  )}
                >
                  {cellIndex % 2 === 0 ? timeLabels[cellIndex] ?? formatRangeLabel(cellIndex, cellIndex + 1).slice(0, 5) : ""}
                </div>
              ))}
            </div>

            {days.map((day) => (
              <div key={day.dateKey} className={cn(PLANNER_DESKTOP_ROW_CLASS, "pt-1")}>
                {rowIndexes.map((cellIndex) => (
                  (() => {
                    const tone = getCellTone(day, cellIndex);

                    return (
                  <GridCell
                    key={`${day.dateKey}-${cellIndex}`}
                    tone={tone}
                    selected={isCellHighlighted(day.dateKey, cellIndex, draft, selectedSelection)}
                    hourBoundary={cellIndex % 2 === 0}
                    label={`${day.label}, ${formatRangeLabel(cellIndex, cellIndex + 1)}, ${getToneLabel(tone)}`}
                    onPointerDown={() => onCellStart(day, cellIndex)}
                    onPointerMove={(event) => onCellMove(day.dateKey, cellIndex, event.buttons)}
                  />
                    );
                  })()
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MobileDayGrid({
  day,
  timeLabels,
  draft,
  selectedSelection,
  onCellStart,
  onCellMove,
}: {
  day: PlannerDay;
  timeLabels: string[];
  draft: DraftSelection | null;
  selectedSelection: PlannerSelection | null;
  onCellStart: (day: PlannerDay, cellIndex: number) => void;
  onCellMove: (dayKey: string, cellIndex: number, buttons: number) => void;
}) {
  const rowIndexes = Array.from({ length: PLANNER_CELL_COUNT }, (_, index) => index);

  return (
    <div className="overflow-hidden rounded-[1.3rem] border border-white/8 bg-[#131116] lg:hidden">
      <div className="px-3 py-4 sm:px-4">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.24em] text-white/42">Vybraný den</p>
          <div className="mt-2 flex min-w-0 flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
            <h4 className="text-2xl font-semibold text-white">{day.label}</h4>
            <p className="text-xs leading-5 text-white/50 sm:text-right">{getSummaryLine(day)}</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-white/58">Klepnutím vybíráte blok, tažením měníte běžnou dostupnost.</p>

          <div className={cn("mt-4 grid grid-cols-[3rem_minmax(0,1fr)] gap-x-3", PLANNER_MOBILE_ROW_CLASS)}>
            {rowIndexes.map((cellIndex) => (
              <div key={`${day.dateKey}-${cellIndex}`} className="contents">
                <div
                  className={cn(
                    "border-t pt-1 text-[10px] uppercase tracking-[0.14em]",
                    cellIndex % 2 === 0 ? "border-white/16 text-white/58" : "border-white/7 text-white/26",
                  )}
                >
                  {cellIndex % 2 === 0 ? timeLabels[cellIndex] ?? formatRangeLabel(cellIndex, cellIndex + 1).slice(0, 5) : ""}
                </div>
                <GridCell
                  tone={getCellTone(day, cellIndex)}
                  selected={isCellHighlighted(day.dateKey, cellIndex, draft, selectedSelection)}
                  hourBoundary={cellIndex % 2 === 0}
                  label={`${day.label}, ${formatRangeLabel(cellIndex, cellIndex + 1)}, ${getToneLabel(getCellTone(day, cellIndex))}`}
                  onPointerDown={() => onCellStart(day, cellIndex)}
                  onPointerMove={(event) => onCellMove(day.dateKey, cellIndex, event.buttons)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DayInspector({
  day,
  days,
  legend,
  selection,
  copyTargetKey,
  hasUnsavedChanges,
  onCopyTargetChange,
  onCopyDay,
  onClearDay,
  onApplySelection,
  onResetDay,
  pending,
}: {
  day: PlannerDay;
  days: PlannerDay[];
  legend: Array<{ tone: CellTone | "past"; label: string }>;
  selection: PlannerSelection | null;
  copyTargetKey: string;
  hasUnsavedChanges: boolean;
  onCopyTargetChange: (value: string) => void;
  onCopyDay: () => void;
  onClearDay: () => void;
  onApplySelection: () => void;
  onResetDay: () => void;
  pending: boolean;
}) {
  const activeSelection = selection && selection.dateKey === day.dateKey ? selection : null;
  const selectionInterval = getSelectionInterval(day, activeSelection);
  const selectionBooking = getSelectionBooking(day, activeSelection);
  const isDayClosed = !day.isPast && day.availableIntervals.length === 0;

  return (
    <div className="space-y-4">
      <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.04] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/42">Inspektor dne</p>
            <h4 className="text-xl font-semibold text-white">{day.label}</h4>
            <p className="text-sm text-white/60">{getSummaryLine(day)}</p>
          </div>
          {hasUnsavedChanges ? (
            <span className="rounded-full border border-[var(--color-accent)]/30 bg-[rgba(190,160,120,0.12)] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-white/76">
              koncept
            </span>
          ) : null}
        </div>
        {isDayClosed ? (
          <div className="mt-3 rounded-[0.95rem] border border-[var(--color-accent)]/22 bg-[rgba(190,160,120,0.09)] px-3 py-2 text-sm text-white/80">
            Den je aktuálně bez volných oken.
          </div>
        ) : null}
      </div>

      <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
        <p className="text-[10px] uppercase tracking-[0.24em] text-white/42">Akce dne</p>
        <div className="mt-3 grid gap-2">
          <ActionButton tone="accent" onClick={onClearDay} disabled={pending}>
            Označit den jako zavřeno
          </ActionButton>
          <ActionButton tone="default" onClick={onClearDay} disabled={pending}>
            Vymazat dostupnost
          </ActionButton>
          <div className="rounded-[0.95rem] border border-white/8 bg-black/15 p-3">
            <label className="text-[10px] uppercase tracking-[0.22em] text-white/42" htmlFor="copy-day-select">
              Kopírovat rozvrh z jiného dne
            </label>
            <div className="mt-2 flex gap-2">
              <select
                id="copy-day-select"
                value={copyTargetKey}
                onChange={(event) => onCopyTargetChange(event.target.value)}
                className="min-w-0 flex-1 rounded-full border border-white/10 bg-[#171417] px-3.5 py-2 text-sm text-white outline-none"
              >
                <option value="">Vyberte den</option>
                {days
                  .filter((candidate) => candidate.dateKey !== day.dateKey)
                  .map((candidate) => (
                    <option key={candidate.dateKey} value={candidate.dateKey}>
                      {formatDayActionLabel(candidate)}
                    </option>
                  ))}
              </select>
              <ActionButton tone="accent" onClick={onCopyDay} disabled={pending || !copyTargetKey}>
                Kopírovat
              </ActionButton>
            </div>
          </div>
          <ActionButton tone="ghost" onClick={onResetDay} disabled={pending}>
            Obnovit den z publikovaného stavu
          </ActionButton>
        </div>
      </div>

      <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
        <p className="text-[10px] uppercase tracking-[0.24em] text-white/42">Detail výběru</p>
        {activeSelection ? (
          <div className="mt-3 space-y-3">
            <div className="rounded-[0.95rem] border border-white/8 bg-black/15 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-white">{day.label}</p>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/70">
                  {getSelectionToneLabel(activeSelection.tone)}
                </span>
              </div>
              <p className="mt-2 text-base font-semibold text-white">
                {formatRangeLabel(activeSelection.startCell, activeSelection.endCell)}
              </p>
              <div className="mt-3 space-y-1 text-sm text-white/58">
                <p>
                  {activeSelection.tone === "available" && "Vybraný blok běžné dostupnosti."}
                  {activeSelection.tone === "empty" && "Prázdné místo připravené k doplnění."}
                  {activeSelection.tone === "booked" && "Rezervovaný čas je jen pro orientaci a zůstává chráněný."}
                  {activeSelection.tone === "completed" && "Dokončená rezervace zůstává v plánu pro přehled historie."}
                  {activeSelection.tone === "locked" && "Omezený nebo technický interval nelze upravit přímo z planneru."}
                  {activeSelection.tone === "inactive" && "Neaktivní interval zůstává mimo rychlou editaci."}
                  {activeSelection.tone === "past" && "Minulý čas už není možné měnit."}
                </p>
                {selectionBooking ? (
                  <p>{selectionBooking.clientName} · {selectionBooking.serviceName}</p>
                ) : null}
                {selectionInterval ? <p>{selectionInterval.detail}</p> : null}
                {selectionInterval && selectionInterval.bookingCount > 0 ? (
                  <p>Kapacita obsazena: {selectionInterval.bookingCount}</p>
                ) : null}
              </div>
            </div>
            {activeSelection.editable ? (
              <ActionButton
                tone={activeSelection.tone === "available" ? "danger" : "accent"}
                onClick={onApplySelection}
                disabled={pending}
              >
                {activeSelection.tone === "available" ? "Odebrat vybraný blok" : "Přidat vybraný blok"}
              </ActionButton>
            ) : (
              <p className="text-sm text-white/52">
                {activeSelection.tone === "completed"
                  ? "Hotovou rezervaci upravíte v detailu rezervace, ne v inspektoru dostupnosti."
                  : "Tento blok je chráněný a nelze ho z inspektoru upravit."}
              </p>
            )}
          </div>
        ) : (
          <div className="mt-3 rounded-[0.95rem] border border-dashed border-white/10 bg-black/10 px-3 py-3">
            <p className="text-sm text-white/74">Vyberte blok v mřížce.</p>
            <p className="mt-1 text-sm leading-6 text-white/52">
              Kliknutí vybere úsek, tažení vytvoří nebo upraví dostupnost.
            </p>
          </div>
        )}

        <div className="mt-4 space-y-4 border-t border-white/8 pt-4">
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/42">Volná okna</p>
              <p className="text-xs text-white/46">{day.availableIntervals.length} bloků</p>
            </div>
            <div className="mt-2 space-y-2">
              {day.availableIntervals.length > 0 ? (
                day.availableIntervals.map((interval) => (
                  <div
                    key={`${interval.startCell}-${interval.endCell}`}
                    className="flex items-center justify-between rounded-[0.9rem] border border-emerald-300/18 bg-emerald-300/10 px-3 py-2 text-left"
                  >
                    <span className="text-sm text-white/88">{interval.label}</span>
                    <span className="text-xs text-white/54">rychlá editace</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-white/54">Žádná běžná dostupnost.</p>
              )}
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/42">Rezervace</p>
            <div className="mt-2 space-y-2">
              {day.bookings.length > 0 ? (
                day.bookings.map((booking) => (
                  <div
                    key={booking.id}
                    className={cn(
                      "rounded-[0.95rem] border px-3 py-2.5 text-sm text-white/86",
                      booking.status === BookingStatus.COMPLETED
                        ? "border-cyan-300/18 bg-cyan-300/8"
                        : "border-rose-300/18 bg-rose-300/10",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{booking.label}</p>
                      {booking.status === BookingStatus.COMPLETED ? (
                        <span className="rounded-full border border-cyan-300/22 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-medium text-cyan-100/82">
                          Hotovo
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-white/58">{booking.clientName} • {booking.serviceName}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-white/48">Bez rezervací.</p>
              )}
            </div>
          </div>

          <details className="group rounded-[0.95rem] border border-white/8 bg-black/10 px-3 py-2.5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[10px] uppercase tracking-[0.24em] text-white/42">
              Legenda
              <span className="text-white/30 transition group-open:rotate-180">⌄</span>
            </summary>
            <div className="mt-3">
              <PlannerLegend legend={legend} />
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

export function MobileInspectorSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 xl:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Inspektor dne"
    >
      <AdminEscapeKeyClose onEscape={onClose} enabled={open} />
      <div
        className="absolute inset-0 bg-black/55 opacity-100 backdrop-blur-sm transition"
        onClick={onClose}
      />
      <div
        className="absolute bottom-0 left-0 right-0 max-h-[86vh] translate-y-0 overflow-y-auto rounded-t-[1.6rem] border border-white/10 bg-[#111015] p-4 shadow-[0_-16px_40px_rgba(0,0,0,0.35)] transition"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-white">Inspektor dne</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 px-3 py-2 text-sm text-white/72"
          >
            Zavřít
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function StickyActionBar({
  visible,
  pending,
  onDiscard,
  onPublish,
}: {
  visible: boolean;
  pending: boolean;
  onDiscard: () => void;
  onPublish: () => void;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-4 transition",
        visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
      )}
    >
      <div className="mx-auto max-w-5xl rounded-[1.2rem] border border-white/10 bg-[rgba(20,18,23,0.94)] px-4 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="pointer-events-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-white">Neuložené změny týdne</p>
            <p className="text-sm text-white/56">Změny zatím zůstávají jen v pracovním konceptu tohoto týdne.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton tone="ghost" onClick={onDiscard} disabled={pending}>
              Zahodit
            </ActionButton>
            <ActionButton tone="accent" onClick={onPublish} disabled={pending}>
              Publikovat změny
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}
