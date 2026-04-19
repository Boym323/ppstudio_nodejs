import Link from "next/link";

import type { PlannerDay } from "@/features/admin/lib/admin-slots";
import { cn } from "@/lib/utils";

const PLANNER_START_HOUR = 6;
const PLANNER_END_HOUR = 20;
const PLANNER_CELL_COUNT = (PLANNER_END_HOUR - PLANNER_START_HOUR) * 2;
const PLANNER_DESKTOP_ROW_CLASS = "grid grid-rows-[repeat(28,minmax(0,1rem))] gap-y-1";
const PLANNER_MOBILE_ROW_CLASS = "grid grid-rows-[repeat(28,minmax(0,1.25rem))] gap-y-1";

export type CellTone = "available" | "booked" | "locked" | "inactive" | "past" | "empty";

export type DraftSelection = {
  dateKey: string;
  mode: "add" | "remove";
  anchorCell: number;
  hoverCell: number;
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

function ActionButton({
  children,
  tone = "default",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "default" | "accent";
}) {
  return (
    <button
      {...props}
      className={cn(
        "rounded-full px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50",
        tone === "accent"
          ? "border border-[var(--color-accent)]/42 bg-[rgba(190,160,120,0.14)] text-white"
          : "border border-white/10 bg-white/6 text-white/82",
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
  onCopyWeek,
  onSaveTemplate,
  onApplyTemplate,
  pending,
}: {
  baseHref: string;
  previousWeekKey: string;
  todayKey: string;
  nextWeekKey: string;
  currentDayKey: string;
  onCopyWeek: () => void;
  onSaveTemplate: () => void;
  onApplyTemplate: () => void;
  pending: boolean;
}) {
  return (
    <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2">
          <Link
            href={`${baseHref}?week=${previousWeekKey}&day=${currentDayKey}`}
            className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/82"
          >
            Předchozí týden
          </Link>
          <Link
            href={`${baseHref}?week=${todayKey}&day=${todayKey}`}
            className="rounded-full border border-[var(--color-accent)]/42 bg-[rgba(190,160,120,0.14)] px-4 py-2 text-sm font-medium text-white"
          >
            Tento týden
          </Link>
          <Link
            href={`${baseHref}?week=${nextWeekKey}&day=${currentDayKey}`}
            className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/82"
          >
            Další týden
          </Link>
        </div>

        <div className="hidden flex-wrap gap-2 xl:flex">
          <ActionButton onClick={onCopyWeek} disabled={pending}>
            Zkopírovat týden
          </ActionButton>
          <ActionButton onClick={onSaveTemplate}>Uložit šablonu</ActionButton>
          <ActionButton onClick={onApplyTemplate} disabled={pending}>
            Použít šablonu
          </ActionButton>
        </div>
      </div>

      <details className="mt-3 rounded-[1rem] border border-white/10 bg-black/10 px-4 py-3 xl:hidden">
        <summary className="cursor-pointer list-none text-sm font-medium text-white/82">
          Další rychlé akce
        </summary>
        <div className="mt-3 flex flex-wrap gap-2">
          <ActionButton onClick={onCopyWeek} disabled={pending}>
            Zkopírovat týden
          </ActionButton>
          <ActionButton onClick={onSaveTemplate}>Uložit šablonu</ActionButton>
          <ActionButton onClick={onApplyTemplate} disabled={pending}>
            Použít šablonu
          </ActionButton>
        </div>
      </details>
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
            "rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em]",
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
        "rounded-[1.2rem] border px-4 py-3 text-sm leading-6",
        tone === "success" && "border-emerald-300/30 bg-emerald-300/12 text-white/88",
        tone === "error" && "border-rose-300/28 bg-rose-300/12 text-white/88",
        tone === "info" && "border-white/10 bg-white/5 text-white/78",
      )}
    >
      {message}
    </div>
  );
}

export function SelectionStatus({ draft }: { draft: DraftSelection | null }) {
  if (!draft) {
    return null;
  }

  const range = getSelectionRange(draft);

  return (
    <div className="rounded-[1.2rem] border border-[var(--color-accent)]/35 bg-[rgba(190,160,120,0.12)] px-4 py-3 text-sm text-white/88">
      {draft.mode === "add" ? "Přidáváte" : "Odebíráte"} {formatRangeLabel(range.startCell, range.endCell)}
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
              "min-w-[8.25rem] shrink-0 rounded-[1.2rem] border px-3 py-3",
              day.dateKey === selectedDayKey
                ? "border-[var(--color-accent)]/45 bg-[rgba(190,160,120,0.14)]"
                : "border-white/10 bg-white/5",
            )}
          >
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/48">{day.shortLabel}</p>
            <p className="mt-2 font-display text-2xl text-white">{day.dayNumber}</p>
            <p className="mt-1 text-xs text-white/60">{day.summary.availableLabel}</p>
            {day.bookings.length > 0 ? (
              <p className="text-xs text-white/48">{day.summary.bookingLabel}</p>
            ) : null}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function GridCell({
  tone,
  selected,
  onPointerDown,
  onPointerEnter,
}: {
  tone: CellTone;
  selected: boolean;
  onPointerDown: () => void;
  onPointerEnter: () => void;
}) {
  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      className={cn(
        "h-5 w-full rounded-[0.55rem] border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/70 lg:h-4",
        tone === "available" && "border-emerald-300/40 bg-emerald-300/70 hover:bg-emerald-300/85",
        tone === "booked" && "border-rose-300/40 bg-rose-300/80 hover:bg-rose-300/88",
        tone === "locked" && "border-amber-200/30 bg-amber-200/50 hover:bg-amber-200/58",
        tone === "inactive" && "border-slate-300/18 bg-slate-300/28 hover:bg-slate-300/34",
        tone === "past" && "border-white/8 bg-white/6 hover:bg-white/8",
        tone === "empty" && "border-white/12 bg-white/8 hover:bg-white/12",
        selected && "ring-2 ring-[var(--color-accent)]/80 ring-offset-1 ring-offset-[#171417]",
      )}
    />
  );
}

export function DesktopWeekGrid({
  days,
  timeLabels,
  draft,
  onCellStart,
  onCellEnter,
  selectedDayKey,
  baseHref,
  weekKey,
}: {
  days: PlannerDay[];
  timeLabels: string[];
  draft: DraftSelection | null;
  onCellStart: (day: PlannerDay, cellIndex: number) => void;
  onCellEnter: (dayKey: string, cellIndex: number) => void;
  selectedDayKey: string;
  baseHref: string;
  weekKey: string;
}) {
  const selection = draft ? getSelectionRange(draft) : null;
  const rowIndexes = Array.from({ length: PLANNER_CELL_COUNT }, (_, index) => index);

  return (
    <div className="hidden rounded-[var(--radius-panel)] border border-white/10 bg-black/10 p-5 lg:block">
      <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] gap-3 xl:grid-cols-[70px_repeat(7,minmax(0,1fr))]">
        <div />
        {days.map((day) => (
          <Link
            key={day.dateKey}
            href={getDayActionHref(baseHref, weekKey, day.dateKey)}
            className={cn(
              "rounded-[1.2rem] border px-3 py-3 text-center transition",
              day.dateKey === selectedDayKey
                ? "border-[var(--color-accent)]/45 bg-[rgba(190,160,120,0.14)]"
                : "border-white/10 bg-white/5 hover:border-white/18 hover:bg-white/7",
            )}
          >
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/50">{day.shortLabel}</p>
            <p className="mt-2 font-display text-3xl text-white">{day.dayNumber}</p>
            <p className="mt-1 text-sm text-white/60">{day.monthLabel}</p>
          </Link>
        ))}

        <div className={cn(PLANNER_DESKTOP_ROW_CLASS, "pt-2")}>
          {rowIndexes.map((cellIndex) => (
            <div
              key={`label-${cellIndex}`}
              className="flex h-4 items-start text-[11px] uppercase tracking-[0.18em] text-white/38"
            >
              {cellIndex % 2 === 0 ? timeLabels[cellIndex] ?? formatRangeLabel(cellIndex, cellIndex + 1).slice(0, 5) : ""}
            </div>
          ))}
        </div>

        {days.map((day) => (
          <div key={day.dateKey} className={cn(PLANNER_DESKTOP_ROW_CLASS, "pt-2")}>
            {rowIndexes.map((cellIndex) => {
              const selected =
                draft?.dateKey === day.dateKey &&
                selection !== null &&
                cellIndex >= selection.startCell &&
                cellIndex < selection.endCell;

              return (
                <GridCell
                  key={`${day.dateKey}-${cellIndex}`}
                  tone={getCellTone(day, cellIndex)}
                  selected={selected}
                  onPointerDown={() => onCellStart(day, cellIndex)}
                  onPointerEnter={() => onCellEnter(day.dateKey, cellIndex)}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function MobileDayGrid({
  day,
  timeLabels,
  draft,
  onCellStart,
  onCellEnter,
}: {
  day: PlannerDay;
  timeLabels: string[];
  draft: DraftSelection | null;
  onCellStart: (day: PlannerDay, cellIndex: number) => void;
  onCellEnter: (dayKey: string, cellIndex: number) => void;
}) {
  const selection = draft ? getSelectionRange(draft) : null;
  const rowIndexes = Array.from({ length: PLANNER_CELL_COUNT }, (_, index) => index);

  return (
    <div className="rounded-[var(--radius-panel)] border border-white/10 bg-black/10 p-4 lg:hidden">
      <p className="text-xs uppercase tracking-[0.28em] text-white/50">Vybraný den</p>
      <h4 className="mt-2 font-display text-3xl text-white">{day.label}</h4>
      <p className="mt-2 text-sm leading-6 text-white/64">Klepněte nebo táhněte přes čas, který chcete přidat nebo odebrat.</p>

      <div className={cn("mt-4 grid grid-cols-[44px_minmax(0,1fr)] gap-x-3", PLANNER_MOBILE_ROW_CLASS)}>
        {rowIndexes.map((cellIndex) => {
          const selected =
            draft?.dateKey === day.dateKey &&
            selection !== null &&
            cellIndex >= selection.startCell &&
            cellIndex < selection.endCell;

          return (
            <div key={`${day.dateKey}-${cellIndex}`} className="contents">
              <div className="pt-1 text-[11px] uppercase tracking-[0.16em] text-white/42">
                {cellIndex % 2 === 0 ? timeLabels[cellIndex] ?? formatRangeLabel(cellIndex, cellIndex + 1).slice(0, 5) : ""}
              </div>
              <GridCell
                tone={getCellTone(day, cellIndex)}
                selected={selected}
                onPointerDown={() => onCellStart(day, cellIndex)}
                onPointerEnter={() => onCellEnter(day.dateKey, cellIndex)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DayDetails({
  day,
  days,
  legend,
  copyTargetKey,
  onCopyTargetChange,
  onCopyDay,
  onClearDay,
  pending,
}: {
  day: PlannerDay;
  days: PlannerDay[];
  legend: Array<{ tone: CellTone | "past"; label: string }>;
  copyTargetKey: string;
  onCopyTargetChange: (value: string) => void;
  onCopyDay: () => void;
  onClearDay: () => void;
  pending: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-[1.35rem] border border-white/10 bg-white/5 p-4">
        <p className="text-xs uppercase tracking-[0.28em] text-white/50">Přehled dne</p>
        <h4 className="mt-3 font-display text-3xl text-white">{day.label}</h4>
        <p className="mt-3 text-sm leading-6 text-white/68">{day.summary.note}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full border border-emerald-300/30 bg-emerald-300/14 px-3 py-1 text-xs text-white/86">
            {day.summary.availableLabel}
          </span>
          {day.bookings.length > 0 ? (
            <span className="rounded-full border border-rose-300/28 bg-rose-300/12 px-3 py-1 text-xs text-white/82">
              {day.summary.bookingLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div className="rounded-[1.35rem] border border-white/10 bg-black/10 p-4">
        <p className="text-xs uppercase tracking-[0.24em] text-white/50">Legenda</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {legend.map((item) => (
            <span
              key={item.label}
              className={cn(
                "rounded-full border px-3 py-1 text-xs uppercase tracking-[0.16em]",
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
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <button
          type="button"
          onClick={onClearDay}
          disabled={pending}
          className="rounded-full border border-white/12 bg-white/6 px-4 py-3 text-sm font-medium text-white/85 disabled:cursor-wait disabled:opacity-60"
        >
          Nastavit den jako zavřeno
        </button>
        <div className="rounded-[1.35rem] border border-white/10 bg-white/5 p-4">
          <label className="text-xs uppercase tracking-[0.24em] text-white/50" htmlFor="copy-day-select">
            Zkopírovat rozvrh dne na
          </label>
          <div className="mt-3 flex gap-2">
            <select
              id="copy-day-select"
              value={copyTargetKey}
              onChange={(event) => onCopyTargetChange(event.target.value)}
              className="min-w-0 flex-1 rounded-full border border-white/10 bg-[#171417] px-4 py-3 text-sm text-white outline-none"
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
      </div>

      <div className="rounded-[1.35rem] border border-white/10 bg-black/10 p-4">
        <p className="text-xs uppercase tracking-[0.24em] text-white/50">Volná okna</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {day.availableIntervals.length > 0 ? (
            day.availableIntervals.map((interval) => (
              <span
                key={`${interval.startCell}-${interval.endCell}`}
                className="rounded-full border border-emerald-300/35 bg-emerald-300/18 px-3 py-1 text-sm text-white/88"
              >
                {interval.label}
              </span>
            ))
          ) : (
            <p className="text-sm text-white/56">Žádná běžná dostupnost.</p>
          )}
        </div>
      </div>

      {day.lockedIntervals.length > 0 ? (
        <div className="rounded-[1.35rem] border border-white/10 bg-black/10 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-white/50">Chráněné úseky</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {day.lockedIntervals.map((interval) => (
              <span
                key={`${interval.startCell}-${interval.endCell}`}
                className="rounded-full border border-amber-200/28 bg-amber-200/14 px-3 py-1 text-sm text-white/84"
              >
                {interval.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-[1.35rem] border border-white/10 bg-black/10 p-4">
        <p className="text-xs uppercase tracking-[0.24em] text-white/50">Rezervace</p>
        <div className="mt-3 space-y-2">
          {day.bookings.length > 0 ? (
            day.bookings.map((booking) => (
              <div
                key={booking.id}
                className="rounded-[1rem] border border-rose-300/22 bg-rose-300/12 px-3 py-3 text-sm text-white/86"
              >
                <p className="font-medium">{booking.label}</p>
                <p className="mt-1 text-white/64">{booking.clientName} • {booking.serviceName}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-white/56">Bez rezervací.</p>
          )}
        </div>
      </div>
    </div>
  );
}
