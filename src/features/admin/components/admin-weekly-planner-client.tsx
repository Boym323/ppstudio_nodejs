"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  copyPlannerWeekAction,
  syncPlannerWeekDraftAction,
} from "@/features/admin/actions/slot-planner-actions";
import type { PlannerDay, PlannerWeekData } from "@/features/admin/lib/admin-slots";
import {
  type CellTone,
  type PlannerSelection,
  type WeeklyTemplateInput,
  DayInspector,
  DesktopWeekGrid,
  MobileDayGrid,
  MobileDayPicker,
  MobileInspectorSheet,
  PlannerFeedback,
  StickyActionBar,
  WeekToolbar,
  formatRangeLabel,
  getCellTone,
  getSelectionRange,
  getWeekdayTemplateFromDays,
  isEditableTone,
} from "./admin-weekly-planner-ui";

const TEMPLATE_STORAGE_KEY = "ppstudio-admin-weekly-template-v2";
const DRAFT_STORAGE_PREFIX = "ppstudio-admin-weekly-draft-v1";

type AdminWeeklyPlannerClientProps = {
  data: PlannerWeekData;
  timeLabels: string[];
  initialDayKey: string;
};

type FeedbackState = {
  tone: "success" | "error" | "info";
  message: string;
};

type PendingInteraction = {
  dateKey: string;
  anchorCell: number;
  hoverCell: number;
  mode: "add" | "remove";
  tone: CellTone;
  moved: boolean;
};

function getDraftStorageKey(area: PlannerWeekData["area"], weekKey: string) {
  return `${DRAFT_STORAGE_PREFIX}:${area}:${weekKey}`;
}

function buildAvailableCells(intervals: Array<{ startCell: number; endCell: number }>) {
  const cells = Array.from({ length: 28 }, () => false);

  for (const interval of intervals) {
    for (let cell = interval.startCell; cell < interval.endCell; cell += 1) {
      cells[cell] = true;
    }
  }

  return cells;
}

function buildIntervalsFromCells(cells: boolean[]) {
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

function getSummaryNote(day: PlannerDay, availableIntervals: PlannerDay["availableIntervals"]) {
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

function patchDayAvailableIntervals(day: PlannerDay, intervals: PlannerDay["availableIntervals"]): PlannerDay {
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

function hasBlockedCells(day: PlannerDay, startCell: number, endCell: number) {
  for (let cell = startCell; cell < endCell; cell += 1) {
    const tone = getCellTone(day, cell);

    if (!isEditableTone(tone)) {
      return tone;
    }
  }

  return null;
}

function wouldConflictWithIntervals(
  day: PlannerDay,
  intervals: Array<{
    startCell: number;
    endCell: number;
  }>,
) {
  return intervals.find((interval) => hasBlockedCells(day, interval.startCell, interval.endCell));
}

function cloneWeekDays(days: PlannerDay[]) {
  return days.map((day) => ({
    ...day,
    availableIntervals: day.availableIntervals.map((interval) => ({ ...interval })),
    lockedIntervals: day.lockedIntervals.map((interval) => ({ ...interval })),
    bookings: day.bookings.map((booking) => ({ ...booking })),
    intervals: day.intervals.map((interval) => ({ ...interval })),
    cells: {
      available: [...day.cells.available],
      booked: [...day.cells.booked],
      inactive: [...day.cells.inactive],
      locked: [...day.cells.locked],
      past: [...day.cells.past],
    },
    summary: { ...day.summary },
  }));
}

function getBlockedMessage(tone: CellTone) {
  if (tone === "booked") {
    return "Rezervace zůstává chráněná a z planneru ji nelze přepsat.";
  }

  if (tone === "past") {
    return "Minulý čas už není možné měnit.";
  }

  return "Tento úsek je omezený nebo neaktivní a nejde ho upravit přímo z týdenního planneru.";
}

function findSelectionAtCell(day: PlannerDay, cellIndex: number): PlannerSelection {
  const availableInterval = day.availableIntervals.find(
    (interval) => cellIndex >= interval.startCell && cellIndex < interval.endCell,
  );

  if (availableInterval) {
    return {
      dateKey: day.dateKey,
      startCell: availableInterval.startCell,
      endCell: availableInterval.endCell,
      tone: "available",
      editable: true,
    };
  }

  const booking = day.bookings.find((interval) => cellIndex >= interval.startCell && cellIndex < interval.endCell);

  if (booking) {
    return {
      dateKey: day.dateKey,
      startCell: booking.startCell,
      endCell: booking.endCell,
      tone: "booked",
      editable: false,
    };
  }

  const locked = day.lockedIntervals.find((interval) => cellIndex >= interval.startCell && cellIndex < interval.endCell);

  if (locked) {
    return {
      dateKey: day.dateKey,
      startCell: locked.startCell,
      endCell: locked.endCell,
      tone: "locked",
      editable: false,
    };
  }

  const inactive = day.intervals.find(
    (interval) => interval.status === "inactive" && cellIndex >= interval.startCell && cellIndex < interval.endCell,
  );

  if (inactive) {
    return {
      dateKey: day.dateKey,
      startCell: inactive.startCell,
      endCell: inactive.endCell,
      tone: "inactive",
      editable: false,
    };
  }

  return {
    dateKey: day.dateKey,
    startCell: cellIndex,
    endCell: cellIndex + 1,
    tone: getCellTone(day, cellIndex),
    editable: isEditableTone(getCellTone(day, cellIndex)),
  };
}

function serializeDraft(days: PlannerDay[]) {
  return days.map((day) => ({
    dateKey: day.dateKey,
    intervals: day.availableIntervals.map((interval) => ({
      startCell: interval.startCell,
      endCell: interval.endCell,
    })),
  }));
}

function getInitialPlannerState(data: PlannerWeekData): {
  days: PlannerDay[];
  feedback: FeedbackState | null;
} {
  const nextDays = cloneWeekDays(data.days);

  if (typeof window === "undefined") {
    return {
      days: nextDays,
      feedback: null,
    };
  }

  const storedDraft = window.localStorage.getItem(getDraftStorageKey(data.area, data.weekKey));

  if (!storedDraft) {
    return {
      days: nextDays,
      feedback: null,
    };
  }

  try {
    const parsed = JSON.parse(storedDraft) as ReturnType<typeof serializeDraft>;

    return {
      days: nextDays.map((day) => {
        const savedDay = parsed.find((item) => item.dateKey === day.dateKey);

        if (!savedDay) {
          return day;
        }

        return patchDayAvailableIntervals(
          day,
          savedDay.intervals.map((interval) => ({
            startCell: interval.startCell,
            endCell: interval.endCell,
            label: formatRangeLabel(interval.startCell, interval.endCell),
          })),
        );
      }),
      feedback: {
        tone: "info",
        message: "Načetl se uložený koncept tohoto týdne z tohoto zařízení.",
      },
    };
  } catch {
    window.localStorage.removeItem(getDraftStorageKey(data.area, data.weekKey));

    return {
      days: nextDays,
      feedback: null,
    };
  }
}

export function AdminWeeklyPlannerClient({
  data,
  timeLabels,
  initialDayKey,
}: AdminWeeklyPlannerClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [initialPlannerState] = useState(() => getInitialPlannerState(data));
  const [workingDays, setWorkingDays] = useState(initialPlannerState.days);
  const [pendingInteraction, setPendingInteraction] = useState<PendingInteraction | null>(null);
  const [selectedSelection, setSelectedSelection] = useState<PlannerSelection | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(initialPlannerState.feedback);
  const [copyTargetKey, setCopyTargetKey] = useState("");
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);

  const activeDraft =
    pendingInteraction && pendingInteraction.moved
      ? {
          dateKey: pendingInteraction.dateKey,
          mode: pendingInteraction.mode,
          anchorCell: pendingInteraction.anchorCell,
          hoverCell: pendingInteraction.hoverCell,
        }
      : null;

  const selectedDayKey =
    selectedSelection?.dateKey ?? activeDraft?.dateKey ?? initialDayKey ?? workingDays[0]?.dateKey;
  const selectedDay = useMemo(
    () => workingDays.find((day) => day.dateKey === selectedDayKey) ?? workingDays[0],
    [selectedDayKey, workingDays],
  );
  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(serializeDraft(workingDays)) !== JSON.stringify(serializeDraft(data.days)),
    [data.days, workingDays],
  );

  useEffect(() => {
    if (!pendingInteraction) {
      return undefined;
    }

    const currentInteraction = pendingInteraction;

    function handlePointerUp() {
      setPendingInteraction(null);
      const day = workingDays.find((item) => item.dateKey === currentInteraction.dateKey);

      if (!day) {
        return;
      }

      if (currentInteraction.moved) {
        const range = getSelectionRange({
          dateKey: currentInteraction.dateKey,
          mode: currentInteraction.mode,
          anchorCell: currentInteraction.anchorCell,
          hoverCell: currentInteraction.hoverCell,
        });
        const blockedTone = hasBlockedCells(day, range.startCell, range.endCell);

        if (blockedTone) {
          setFeedback({ tone: "error", message: getBlockedMessage(blockedTone) });
          return;
        }

        const nextCells = [...day.cells.available];

        for (let cell = range.startCell; cell < range.endCell; cell += 1) {
          nextCells[cell] = currentInteraction.mode === "add";
        }

        const nextIntervals = buildIntervalsFromCells(nextCells);

        setWorkingDays((currentDays) =>
          currentDays.map((item) =>
            item.dateKey === day.dateKey ? patchDayAvailableIntervals(item, nextIntervals) : item,
          ),
        );
        setSelectedSelection({
          dateKey: day.dateKey,
          startCell: range.startCell,
          endCell: range.endCell,
          tone: currentInteraction.mode === "add" ? "available" : "empty",
          editable: true,
        });
        setFeedback({
          tone: "info",
          message:
            currentInteraction.mode === "add"
              ? "Změna je připravená v konceptu. Publikujte ji až po kontrole týdne."
              : "Odebrání je zatím jen v konceptu. Vše můžete ještě zkontrolovat nebo zahodit.",
        });
        return;
      }

      setSelectedSelection(findSelectionAtCell(day, currentInteraction.anchorCell));
      setMobileInspectorOpen(true);
    }

    window.addEventListener("pointerup", handlePointerUp);
    return () => window.removeEventListener("pointerup", handlePointerUp);
  }, [pendingInteraction, workingDays]);

  function updateDay(dateKey: string, updater: (day: PlannerDay) => PlannerDay | null) {
    setWorkingDays((currentDays) =>
      currentDays.map((day) => {
        if (day.dateKey !== dateKey) {
          return day;
        }

        const nextDay = updater(day);

        if (!nextDay) {
          return day;
        }

        return nextDay;
      }),
    );
  }

  function handleCellStart(day: PlannerDay, cellIndex: number) {
    const tone = getCellTone(day, cellIndex);

    setPendingInteraction({
      dateKey: day.dateKey,
      anchorCell: cellIndex,
      hoverCell: cellIndex,
      mode: tone === "available" ? "remove" : "add",
      tone,
      moved: false,
    });
  }

  function handleCellMove(dayKey: string, cellIndex: number, buttons: number) {
    if (buttons !== 1) {
      return;
    }

    setPendingInteraction((current) => {
      if (!current || current.dateKey !== dayKey || !isEditableTone(current.tone)) {
        return current;
      }

      if (current.hoverCell === cellIndex && current.moved) {
        return current;
      }

      return {
        ...current,
        hoverCell: cellIndex,
        moved: current.moved || current.anchorCell !== cellIndex,
      };
    });
  }

  function clearSelectedDay() {
    updateDay(selectedDay.dateKey, (day) => patchDayAvailableIntervals(day, []));
    setSelectedSelection(null);
    setFeedback({
      tone: "info",
      message: "Den je v konceptu nastavený bez volných oken. Publikací se změna propíše do planneru.",
    });
  }

  function resetSelectedDay() {
    const originalDay = data.days.find((day) => day.dateKey === selectedDay.dateKey);

    if (!originalDay) {
      return;
    }

    updateDay(selectedDay.dateKey, () => cloneWeekDays([originalDay])[0]);
    setFeedback({
      tone: "info",
      message: "Vybraný den jsme vrátili do publikovaného stavu.",
    });
  }

  function copyDayLocally() {
    if (!copyTargetKey || copyTargetKey === selectedDay.dateKey) {
      setFeedback({ tone: "error", message: "Vyberte jiný cílový den v rámci týdne." });
      return;
    }

    const targetDay = workingDays.find((day) => day.dateKey === copyTargetKey);

    if (!targetDay) {
      return;
    }

    const blockedCell = selectedDay.availableIntervals
      .flatMap((interval) =>
        Array.from({ length: interval.endCell - interval.startCell }, (_, index) => interval.startCell + index),
      )
      .find((cell) => hasBlockedCells(targetDay, cell, cell + 1));

    if (blockedCell !== undefined) {
      setFeedback({
        tone: "error",
        message: "Cílový den obsahuje rezervaci nebo omezení v části, kam by se rozvrh zkopíroval.",
      });
      return;
    }

    updateDay(copyTargetKey, (day) =>
      patchDayAvailableIntervals(
        day,
        selectedDay.availableIntervals.map((interval) => ({ ...interval })),
      ),
    );
    setFeedback({
      tone: "success",
      message: "Rozvrh dne jsme zkopírovali do konceptu cílového dne.",
    });
  }

  function applyTemplateLocally() {
    const storedValue = window.localStorage.getItem(TEMPLATE_STORAGE_KEY);

    if (!storedValue) {
      setFeedback({ tone: "error", message: "Na tomto zařízení ještě není uložená žádná šablona týdne." });
      return;
    }

    let template: WeeklyTemplateInput;

    try {
      template = JSON.parse(storedValue) as WeeklyTemplateInput;
    } catch {
      setFeedback({ tone: "error", message: "Uložená šablona se nepodařila přečíst." });
      return;
    }

    try {
      const nextDays = workingDays.map((day, weekday) => {
        const templateDay = template.find((item) => item.weekday === weekday);

        if (!templateDay) {
          return day;
        }

        if (wouldConflictWithIntervals(day, templateDay.intervals)) {
          throw new Error(day.label);
        }

        return patchDayAvailableIntervals(
          day,
          templateDay.intervals.map((interval) => ({
            startCell: interval.startCell,
            endCell: interval.endCell,
            label: formatRangeLabel(interval.startCell, interval.endCell),
          })),
        );
      });

      setWorkingDays(nextDays);
      setFeedback({
        tone: "success",
        message: "Šablona týdne je načtená do konceptu. Zkontrolujte ji a potom ji publikujte.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? `Šablonu nešlo bezpečně použít pro ${error.message}, protože by zasahovala do rezervace nebo omezení.`
            : "Šablonu nešlo bezpečně použít, protože by zasahovala do rezervace nebo omezení.",
      });
    }
  }

  function saveTemplate() {
    window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(getWeekdayTemplateFromDays(workingDays)));
    setFeedback({ tone: "success", message: "Týden je uložený jako šablona v tomto zařízení." });
  }

  function discardDraft() {
    setWorkingDays(cloneWeekDays(data.days));
    setSelectedSelection(null);
    setCopyTargetKey("");
    window.localStorage.removeItem(getDraftStorageKey(data.area, data.weekKey));
    setFeedback({ tone: "info", message: "Koncept týdne byl zahozen a planner se vrátil k publikovanému stavu." });
  }

  function saveDraft() {
    window.localStorage.setItem(
      getDraftStorageKey(data.area, data.weekKey),
      JSON.stringify(serializeDraft(workingDays)),
    );
    setFeedback({ tone: "success", message: "Koncept týdne je uložený lokálně v tomto zařízení." });
  }

  function publishDraft() {
    startTransition(async () => {
      const result = await syncPlannerWeekDraftAction(data.area, {
        weekKey: data.weekKey,
        days: serializeDraft(workingDays),
      });

      setFeedback({ tone: result.ok ? "success" : "error", message: result.message });

      if (result.ok) {
        window.localStorage.removeItem(getDraftStorageKey(data.area, data.weekKey));
        router.replace(`${data.baseHref}?week=${data.weekKey}&day=${selectedDay.dateKey}`, { scroll: false });
        router.refresh();
      }
    });
  }

  function copyWeekToNext() {
    if (hasUnsavedChanges) {
      setFeedback({
        tone: "info",
        message: "Nejdřív publikujte nebo zahoďte aktuální koncept týdne. Teprve potom zkopírujte celý týden dál.",
      });
      return;
    }

    startTransition(async () => {
      const result = await copyPlannerWeekAction(data.area, {
        sourceWeekKey: data.weekKey,
        targetWeekKey: data.nextWeekKey,
      });

      setFeedback({ tone: result.ok ? "success" : "error", message: result.message });

      if (result.ok) {
        router.push(`${data.baseHref}?week=${data.nextWeekKey}&day=${selectedDay.dateKey}`);
      }
    });
  }

  function applySelectedBlock() {
    if (!selectedSelection || !selectedSelection.editable || selectedSelection.dateKey !== selectedDay.dateKey) {
      return;
    }

    updateDay(selectedSelection.dateKey, (day) => {
      const blockedTone = hasBlockedCells(day, selectedSelection.startCell, selectedSelection.endCell);

      if (blockedTone && selectedSelection.tone !== "available") {
        setFeedback({ tone: "error", message: getBlockedMessage(blockedTone) });
        return null;
      }

      const nextCells = [...day.cells.available];

      for (let cell = selectedSelection.startCell; cell < selectedSelection.endCell; cell += 1) {
        nextCells[cell] = selectedSelection.tone !== "available";
      }

      return patchDayAvailableIntervals(day, buildIntervalsFromCells(nextCells));
    });

    setFeedback({
      tone: "info",
      message:
        selectedSelection.tone === "available"
          ? "Vybraný blok jsme odebrali jen v konceptu týdne."
          : "Vybraný blok jsme přidali do konceptu týdne.",
    });
  }

  return (
    <div className="space-y-4 pb-28">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <WeekToolbar
            baseHref={data.baseHref}
            previousWeekKey={data.previousWeekKey}
            todayKey={data.todayKey}
            nextWeekKey={data.nextWeekKey}
            currentDayKey={selectedDay.dateKey}
            weekRangeLabel={data.weekRangeLabel}
            title={data.title}
            hasUnsavedChanges={hasUnsavedChanges}
            onCopyWeek={copyWeekToNext}
            onSaveTemplate={saveTemplate}
            onApplyTemplate={applyTemplateLocally}
            onOpenInspector={() => setMobileInspectorOpen(true)}
            pending={isPending}
          />

          {feedback ? <PlannerFeedback tone={feedback.tone} message={feedback.message} /> : null}

          <MobileDayPicker
            days={workingDays}
            selectedDayKey={selectedDay.dateKey}
            baseHref={data.baseHref}
            weekKey={data.weekKey}
          />

          <MobileDayGrid
            day={selectedDay}
            timeLabels={timeLabels}
            draft={activeDraft}
            selectedSelection={selectedSelection}
            onCellStart={handleCellStart}
            onCellMove={handleCellMove}
          />

          <DesktopWeekGrid
            days={workingDays}
            timeLabels={timeLabels}
            draft={activeDraft}
            selectedSelection={selectedSelection}
            onCellStart={handleCellStart}
            onCellMove={handleCellMove}
            selectedDayKey={selectedDay.dateKey}
            baseHref={data.baseHref}
            weekKey={data.weekKey}
          />
        </div>

        <div className="hidden xl:block">
          <div className="sticky top-6">
            <DayInspector
              day={selectedDay}
              days={workingDays}
              legend={data.legend}
              selection={selectedSelection}
              copyTargetKey={copyTargetKey}
              hasUnsavedChanges={hasUnsavedChanges}
              onCopyTargetChange={setCopyTargetKey}
              onCopyDay={copyDayLocally}
              onClearDay={clearSelectedDay}
              onApplySelection={applySelectedBlock}
              onResetDay={resetSelectedDay}
              pending={isPending}
            />
          </div>
        </div>
      </div>

      <MobileInspectorSheet open={mobileInspectorOpen} onClose={() => setMobileInspectorOpen(false)}>
        <DayInspector
          day={selectedDay}
          days={workingDays}
          legend={data.legend}
          selection={selectedSelection}
          copyTargetKey={copyTargetKey}
          hasUnsavedChanges={hasUnsavedChanges}
          onCopyTargetChange={setCopyTargetKey}
          onCopyDay={copyDayLocally}
          onClearDay={clearSelectedDay}
          onApplySelection={applySelectedBlock}
          onResetDay={resetSelectedDay}
          pending={isPending}
        />
      </MobileInspectorSheet>

      <StickyActionBar
        visible={hasUnsavedChanges}
        pending={isPending}
        onDiscard={discardDraft}
        onSaveDraft={saveDraft}
        onPublish={publishDraft}
      />
    </div>
  );
}
