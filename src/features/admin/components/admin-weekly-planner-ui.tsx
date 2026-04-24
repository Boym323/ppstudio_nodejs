import Link from "next/link";

import type { PlannerDay } from "@/features/admin/lib/admin-slots";
import { cn } from "@/lib/utils";
import { AdminEscapeKeyClose } from "@/features/admin/components/admin-drawer-escape-close";

const PLANNER_START_HOUR = 6;
const PLANNER_END_HOUR = 20;
const PLANNER_CELL_COUNT = (PLANNER_END_HOUR - PLANNER_START_HOUR) * 2;
const PLANNER_DESKTOP_ROW_CLASS = "grid grid-rows-[repeat(28,minmax(0,1.2rem))] gap-y-1";
const PLANNER_MOBILE_ROW_CLASS = "grid grid-rows-[repeat(28,minmax(0,1.5rem))] gap-y-1.5";

export type CellTone = "available" | "booked" | "locked" | "inactive" | "past" | "empty";

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
  return `${day.availableIntervals.length} volná okna, ${day.bookings.length} rezervací, ${day.lockedIntervals.length} omezení`;
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
        "inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50",
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
    <div className="rounded-[1.3rem] border border-white/8 bg-white/[0.04] px-4 py-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/44">{title}</p>
            {hasUnsavedChanges ? (
              <span className="rounded-full border border-[var(--color-accent)]/30 bg-[rgba(190,160,120,0.12)] px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-white/76">
                Neuloženo
              </span>
            ) : null}
          </div>
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
          </div>
          <div>
            <p className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{weekRangeLabel}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <ActionButton onClick={onCopyWeek} disabled={pending}>
            Kopírovat týden
          </ActionButton>

          <details className="group relative">
            <summary className="list-none">
              <span className="inline-flex cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white/84">
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

          <ActionButton className="xl:hidden" onClick={onOpenInspector}>
            Inspektor dne
          </ActionButton>
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
            "rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.16em]",
            item.tone === "available" && "border-emerald-300/35 bg-emerald-300/15 text-white/86",
            item.tone === "booked" && "border-rose-300/35 bg-rose-300/16 text-white/86",
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
}: {
  days: PlannerDay[];
  selectedDayKey: string;
  baseHref: string;
  weekKey: string;
}) {
  return (
    <div className="lg:hidden">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {days.map((day) => (
          <Link
            key={day.dateKey}
            href={getDayActionHref(baseHref, weekKey, day.dateKey)}
            className={cn(
              "min-w-[7.75rem] shrink-0 rounded-[1rem] border px-3 py-3",
              day.dateKey === selectedDayKey
                ? "border-[var(--color-accent)]/45 bg-[rgba(190,160,120,0.14)]"
                : "border-white/10 bg-white/[0.04]",
            )}
          >
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/46">{day.shortLabel}</p>
            <p className="mt-1 text-2xl font-semibold text-white">{day.dayNumber}</p>
            <p className="mt-1 text-xs text-white/58">{day.availableIntervals.length} volná okna</p>
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
  onPointerDown,
  onPointerMove,
}: {
  tone: CellTone;
  selected: boolean;
  onPointerDown: () => void;
  onPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      className={cn(
        "h-6 w-full rounded-[0.65rem] border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/70 lg:h-[1.2rem]",
        tone === "available" && "border-emerald-300/25 bg-emerald-300/66 hover:bg-emerald-300/82",
        tone === "booked" && "cursor-default border-rose-300/30 bg-rose-300/70",
        tone === "locked" && "cursor-default border-amber-200/24 bg-amber-200/42",
        tone === "inactive" && "cursor-default border-slate-300/16 bg-slate-300/24",
        tone === "past" && "cursor-default border-white/6 bg-white/[0.04]",
        tone === "empty" && "border-white/10 bg-white/[0.07] hover:bg-white/[0.11]",
        selected && "ring-2 ring-[var(--color-accent)]/85 ring-offset-1 ring-offset-[#141217]",
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
                className={cn(
                  "rounded-[1rem] border px-3 py-3 text-left transition",
                  day.dateKey === selectedDayKey
                    ? "border-[var(--color-accent)]/46 bg-[rgba(190,160,120,0.12)]"
                    : "border-white/8 bg-white/[0.03] hover:border-white/14 hover:bg-white/[0.05]",
                )}
              >
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/44">{day.shortLabel}</p>
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
                  className="flex h-[1.2rem] items-start text-[10px] uppercase tracking-[0.16em] text-white/32"
                >
                  {cellIndex % 2 === 0 ? timeLabels[cellIndex] ?? formatRangeLabel(cellIndex, cellIndex + 1).slice(0, 5) : ""}
                </div>
              ))}
            </div>

            {days.map((day) => (
              <div key={day.dateKey} className={cn(PLANNER_DESKTOP_ROW_CLASS, "pt-1")}>
                {rowIndexes.map((cellIndex) => (
                  <GridCell
                    key={`${day.dateKey}-${cellIndex}`}
                    tone={getCellTone(day, cellIndex)}
                    selected={isCellHighlighted(day.dateKey, cellIndex, draft, selectedSelection)}
                    onPointerDown={() => onCellStart(day, cellIndex)}
                    onPointerMove={(event) => onCellMove(day.dateKey, cellIndex, event.buttons)}
                  />
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
      <div className="overflow-x-auto px-4 py-4">
        <div className="min-w-[320px]">
          <p className="text-[10px] uppercase tracking-[0.24em] text-white/42">Vybraný den</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <h4 className="text-2xl font-semibold text-white">{day.label}</h4>
            <p className="text-xs text-white/50">{getSummaryLine(day)}</p>
          </div>
          <p className="mt-2 text-sm leading-6 text-white/58">Klepnutím vybíráte blok, tažením měníte běžnou dostupnost.</p>

          <div className={cn("mt-4 grid grid-cols-[48px_minmax(280px,1fr)] gap-x-3", PLANNER_MOBILE_ROW_CLASS)}>
            {rowIndexes.map((cellIndex) => (
              <div key={`${day.dateKey}-${cellIndex}`} className="contents">
                <div className="pt-1 text-[10px] uppercase tracking-[0.14em] text-white/38">
                  {cellIndex % 2 === 0 ? timeLabels[cellIndex] ?? formatRangeLabel(cellIndex, cellIndex + 1).slice(0, 5) : ""}
                </div>
                <GridCell
                  tone={getCellTone(day, cellIndex)}
                  selected={isCellHighlighted(day.dateKey, cellIndex, draft, selectedSelection)}
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
  return (
    <div className="space-y-4">
      <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.04] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] text-white/42">Inspektor dne</p>
            <h4 className="mt-2 text-2xl font-semibold text-white">{day.label}</h4>
            <p className="mt-2 text-sm text-white/58">{getSummaryLine(day)}</p>
          </div>
          {hasUnsavedChanges ? (
            <span className="rounded-full border border-[var(--color-accent)]/30 bg-[rgba(190,160,120,0.12)] px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-white/76">
              koncept
            </span>
          ) : null}
        </div>
      </div>

      <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.03] p-4">
        <p className="text-[10px] uppercase tracking-[0.24em] text-white/42">Hlavní akce dne</p>
        <div className="mt-3 grid gap-2">
          <ActionButton tone="accent" onClick={onClearDay} disabled={pending}>
            Označit den jako zavřeno
          </ActionButton>
          <ActionButton tone="default" onClick={onClearDay} disabled={pending}>
            Vymazat dostupnost dne
          </ActionButton>
          <div className="rounded-[1rem] border border-white/8 bg-black/15 p-3">
            <label className="text-[10px] uppercase tracking-[0.22em] text-white/42" htmlFor="copy-day-select">
              Kopírovat rozvrh z jiného dne
            </label>
            <div className="mt-3 flex gap-2">
              <select
                id="copy-day-select"
                value={copyTargetKey}
                onChange={(event) => onCopyTargetChange(event.target.value)}
                className="min-w-0 flex-1 rounded-full border border-white/10 bg-[#171417] px-4 py-2.5 text-sm text-white outline-none"
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

      <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.03] p-4">
        <p className="text-[10px] uppercase tracking-[0.24em] text-white/42">Detail výběru z gridu</p>
        {selection && selection.dateKey === day.dateKey ? (
          <div className="mt-3 space-y-3">
            <div className="rounded-[1rem] border border-white/8 bg-black/15 p-3">
              <p className="text-sm font-medium text-white">{formatRangeLabel(selection.startCell, selection.endCell)}</p>
              <p className="mt-1 text-sm text-white/58">
                {selection.tone === "available" && "Vybraný blok běžné dostupnosti."}
                {selection.tone === "empty" && "Prázdné místo připravené k doplnění."}
                {selection.tone === "booked" && "Rezervovaný čas je jen pro orientaci a zůstává chráněný."}
                {selection.tone === "locked" && "Omezený nebo technický interval nelze upravit přímo z planneru."}
                {selection.tone === "inactive" && "Neaktivní interval zůstává mimo rychlou editaci."}
                {selection.tone === "past" && "Minulý čas už není možné měnit."}
              </p>
            </div>
            {selection.editable ? (
              <ActionButton tone={selection.tone === "available" ? "danger" : "accent"} onClick={onApplySelection} disabled={pending}>
                {selection.tone === "available" ? "Odebrat vybraný blok" : "Přidat vybraný blok"}
              </ActionButton>
            ) : (
              <p className="text-sm text-white/52">Tento blok je chráněný a nelze ho z inspektoru upravit.</p>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-white/56">
            Vyberte blok v mřížce. Jedno kliknutí zvýrazní konkrétní úsek, tažení vytvoří nebo upraví dostupnost.
          </p>
        )}
      </div>

      <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] uppercase tracking-[0.24em] text-white/42">Volná okna</p>
          <p className="text-xs text-white/46">{day.availableIntervals.length} bloků</p>
        </div>
        <div className="mt-3 space-y-2">
          {day.availableIntervals.length > 0 ? (
            day.availableIntervals.map((interval) => (
              <div
                key={`${interval.startCell}-${interval.endCell}`}
                className="flex items-center justify-between rounded-[0.9rem] border border-emerald-300/18 bg-emerald-300/10 px-3 py-2 text-left"
              >
                <span className="text-sm text-white/88">{interval.label}</span>
                <span className="text-xs text-white/54">rychlá editace v gridu</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-white/54">Žádná běžná dostupnost.</p>
          )}
        </div>
      </div>

      <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.03] p-4">
        <p className="text-[10px] uppercase tracking-[0.24em] text-white/42">Rezervace</p>
        <div className="mt-3 space-y-2">
          {day.bookings.length > 0 ? (
            day.bookings.map((booking) => (
              <div
                key={booking.id}
                className="rounded-[0.95rem] border border-rose-300/18 bg-rose-300/10 px-3 py-2.5 text-sm text-white/86"
              >
                <p className="font-medium">{booking.label}</p>
                <p className="mt-1 text-white/58">{booking.clientName} • {booking.serviceName}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-white/48">Bez rezervací.</p>
          )}
        </div>
      </div>

      <div className="rounded-[1.25rem] border border-white/8 bg-white/[0.03] p-4">
        <p className="text-[10px] uppercase tracking-[0.24em] text-white/42">Stavy v mřížce</p>
        <div className="mt-3">
          <PlannerLegend legend={legend} />
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
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 xl:hidden",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!open}
    >
      <AdminEscapeKeyClose onEscape={onClose} enabled={open} />
      <div
        className={cn(
          "absolute inset-0 bg-black/55 backdrop-blur-sm transition",
          open ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 max-h-[86vh] overflow-y-auto rounded-t-[1.6rem] border border-white/10 bg-[#111015] p-4 shadow-[0_-16px_40px_rgba(0,0,0,0.35)] transition",
          open ? "translate-y-0" : "translate-y-full",
        )}
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
  onSaveDraft,
  onPublish,
}: {
  visible: boolean;
  pending: boolean;
  onDiscard: () => void;
  onSaveDraft: () => void;
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
            <ActionButton onClick={onSaveDraft} disabled={pending}>
              Uložit koncept
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
