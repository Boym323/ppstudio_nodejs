import type { PlannerDay } from "@/features/admin/lib/admin-slots";

import { formatRangeLabel, getCellTone, isEditableTone } from "./admin-weekly-planner-ui";

export const PLANNER_DAY_CELLS = 28;

export function buildAvailableCells(intervals: Array<{ startCell: number; endCell: number }>) {
  const cells = Array.from({ length: PLANNER_DAY_CELLS }, () => false);

  for (const interval of intervals) {
    for (let cell = interval.startCell; cell < interval.endCell; cell += 1) {
      cells[cell] = true;
    }
  }

  return cells;
}

export function buildIntervalsFromCells(cells: boolean[]) {
  const intervals: Array<{ startCell: number; endCell: number; label: string }> = [];
  let startCell: number | null = null;

  for (let cell = 0; cell <= cells.length; cell += 1) {
    const isActive = cell < cells.length ? cells[cell] : false;

    if (isActive && startCell === null) {
      startCell = cell;
      continue;
    }

    if (!isActive && startCell !== null) {
      intervals.push({
        startCell,
        endCell: cell,
        label: formatRangeLabel(startCell, cell),
      });
      startCell = null;
    }
  }

  return intervals;
}

export function getSummaryNote(day: PlannerDay, availableIntervals: PlannerDay["availableIntervals"]) {
  if (day.bookings.length > 0) {
    return availableIntervals.length > 0
      ? "Den kombinuje rezervace a další volná okna."
      : "Den je navázaný na rezervace a je spíš k orientaci než k hromadné editaci.";
  }

  if (availableIntervals.length > 0) {
    return "Dostupnost lze upravit přímo v mřížce nebo přes akční inspektor.";
  }

  if (day.lockedIntervals.length > 0) {
    return "Obsahuje omezené nebo technicky uzamčené intervaly.";
  }

  return day.isPast ? "Minulý den už slouží jen pro orientaci." : "Den je prázdný a připravený k doplnění.";
}

export function patchDayAvailableIntervals(day: PlannerDay, intervals: PlannerDay["availableIntervals"]): PlannerDay {
  const availableCells = buildAvailableCells(intervals);
  const nextIntervals = intervals.map((interval, index) => ({
    id: `draft-available-${day.dateKey}-${index}`,
    startCell: interval.startCell,
    endCell: interval.endCell,
    label: interval.label,
    status: "available" as const,
    bookingCount: 0,
    canEdit: true,
    detail: "Běžná dostupnost",
  }));
  const staticIntervals = day.intervals.filter((interval) => interval.status !== "available");

  return {
    ...day,
    availableIntervals: intervals,
    displayAvailableIntervals: intervals.map((interval) => ({ ...interval })),
    availableBlocks: intervals.map((interval) => ({
      startMinutes: interval.startCell * 30,
      endMinutes: interval.endCell * 30,
    })),
    intervals: [...staticIntervals, ...nextIntervals].sort((left, right) => left.startCell - right.startCell),
    cells: {
      ...day.cells,
      available: availableCells,
    },
    summary: {
      availableLabel:
        intervals.length > 0 ? `${intervals.length} volná okna` : "Bez volných oken",
      bookingLabel: day.bookings.length > 0 ? `${day.bookings.length} rezervací` : "Bez rezervací",
      note: getSummaryNote(day, intervals),
    },
  };
}

export function hasBlockedCells(day: PlannerDay, startCell: number, endCell: number) {
  for (let cell = startCell; cell < endCell; cell += 1) {
    const tone = getCellTone(day, cell);

    if (!isEditableTone(tone)) {
      return tone;
    }
  }

  return null;
}

export function wouldConflictWithIntervals(
  day: PlannerDay,
  intervals: Array<{
    startCell: number;
    endCell: number;
  }>,
) {
  return intervals.find((interval) => hasBlockedCells(day, interval.startCell, interval.endCell));
}

export function cloneWeekDays(days: PlannerDay[]) {
  return days.map((day) => ({
    ...day,
    availableIntervals: day.availableIntervals.map((interval) => ({ ...interval })),
    displayAvailableIntervals: day.displayAvailableIntervals?.map((interval) => ({ ...interval })),
    lockedIntervals: day.lockedIntervals.map((interval) => ({ ...interval })),
    cleanupBlocks: day.cleanupBlocks.map((block) => ({ ...block })),
    availableBlocks: day.availableBlocks.map((block) => ({ ...block })),
    lockedBlocks: day.lockedBlocks.map((block) => ({ ...block })),
    inactiveBlocks: day.inactiveBlocks.map((block) => ({ ...block })),
    bookings: day.bookings.map((booking) => ({ ...booking })),
    intervals: day.intervals.map((interval) => ({ ...interval })),
    cells: {
      available: [...day.cells.available],
      booked: [...day.cells.booked],
      bookedCleanup: [...day.cells.bookedCleanup],
      completed: [...day.cells.completed],
      inactive: [...day.cells.inactive],
      locked: [...day.cells.locked],
      past: [...day.cells.past],
    },
    summary: { ...day.summary },
  }));
}

export function sanitizeIntervals(intervals: Array<{ startCell: number; endCell: number }>) {
  const normalized = intervals
    .map((interval) => ({
      startCell: Math.max(0, Math.min(PLANNER_DAY_CELLS, Math.trunc(interval.startCell))),
      endCell: Math.max(0, Math.min(PLANNER_DAY_CELLS, Math.trunc(interval.endCell))),
    }))
    .filter((interval) => interval.endCell > interval.startCell)
    .sort((left, right) => left.startCell - right.startCell);

  const merged: Array<{ startCell: number; endCell: number }> = [];

  for (const interval of normalized) {
    const last = merged[merged.length - 1];

    if (!last || interval.startCell > last.endCell) {
      merged.push(interval);
      continue;
    }

    last.endCell = Math.max(last.endCell, interval.endCell);
  }

  return merged;
}
