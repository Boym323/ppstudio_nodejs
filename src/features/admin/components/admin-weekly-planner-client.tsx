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
import {
  buildIntervalsFromCells,
  cloneWeekDays,
  hasBlockedCells,
  patchDayAvailableIntervals,
  sanitizeIntervals,
  wouldConflictWithIntervals,
} from "./admin-weekly-planner-helpers";

const TEMPLATE_STORAGE_KEY = "ppstudio-admin-weekly-template-v2";
const DRAFT_STORAGE_PREFIX = "ppstudio-admin-weekly-draft-v1";
const FEEDBACK_STORAGE_PREFIX = "ppstudio-admin-weekly-feedback-v1";

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
  pointerType: string;
  moved: boolean;
};

function getDraftStorageKey(area: PlannerWeekData["area"], weekKey: string) {
  return `${DRAFT_STORAGE_PREFIX}:${area}:${weekKey}`;
}

function getFeedbackStorageKey(area: PlannerWeekData["area"], weekKey: string) {
  return `${FEEDBACK_STORAGE_PREFIX}:${area}:${weekKey}`;
}

function consumeStoredFeedback(area: PlannerWeekData["area"], weekKey: string): FeedbackState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storageKey = getFeedbackStorageKey(area, weekKey);
  const storedFeedback = window.sessionStorage.getItem(storageKey);

  if (!storedFeedback) {
    return null;
  }

  window.sessionStorage.removeItem(storageKey);

  try {
    const parsed = JSON.parse(storedFeedback) as FeedbackState;

    if (
      parsed &&
      (parsed.tone === "success" || parsed.tone === "error" || parsed.tone === "info") &&
      typeof parsed.message === "string" &&
      parsed.message.length > 0
    ) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

function persistFeedback(area: PlannerWeekData["area"], weekKey: string, feedback: FeedbackState) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(getFeedbackStorageKey(area, weekKey), JSON.stringify(feedback));
}

function getBlockedMessage(tone: CellTone) {
  if (tone === "booked") {
    return "Rezervace zůstává chráněná a z planneru ji nelze přepsat.";
  }

  if (tone === "completed") {
    return "Hotová rezervace zůstává v přehledu dne a nejde ji měnit přímo v planneru.";
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
      tone: booking.status === "COMPLETED" ? "completed" : "booked",
      editable: false,
      bookingStatus: booking.status,
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
  return {
    days: cloneWeekDays(data.days),
    feedback: null,
  };
}

export function AdminWeeklyPlannerClient({
  data,
  timeLabels,
  initialDayKey,
}: AdminWeeklyPlannerClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [workingDays, setWorkingDays] = useState(() => getInitialPlannerState(data).days);
  const [pendingInteraction, setPendingInteraction] = useState<PendingInteraction | null>(null);
  const [selectedSelection, setSelectedSelection] = useState<PlannerSelection | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(() => getInitialPlannerState(data).feedback);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);

  useEffect(() => {
    const applyHydratedState = (next: {
      days?: PlannerDay[];
      feedback?: FeedbackState | null;
      resetSelection?: boolean;
    }) => {
      queueMicrotask(() => {
        if (next.days) {
          setWorkingDays(next.days);
        }

        if (next.feedback !== undefined) {
          setFeedback(next.feedback);
        }

        if (next.resetSelection) {
          setPendingInteraction(null);
          setSelectedSelection(null);
          setMobileInspectorOpen(false);
        }
      });
    };

    const storedDraft = window.localStorage.getItem(getDraftStorageKey(data.area, data.weekKey));

    if (!storedDraft) {
      const storedFeedback = consumeStoredFeedback(data.area, data.weekKey);
      applyHydratedState({
        days: cloneWeekDays(data.days),
        feedback: storedFeedback ?? null,
        resetSelection: true,
      });

      return;
    }

    try {
      const parsed = JSON.parse(storedDraft) as ReturnType<typeof serializeDraft>;

      const nextDays = cloneWeekDays(data.days).map((day) => {
          const savedDay = parsed.find((item) => item.dateKey === day.dateKey);

          if (!savedDay) {
            return day;
          }

          return patchDayAvailableIntervals(
            day,
            sanitizeIntervals(savedDay.intervals).map((interval) => ({
              startCell: interval.startCell,
              endCell: interval.endCell,
              label: formatRangeLabel(interval.startCell, interval.endCell),
            })),
          );
        });
      applyHydratedState({
        days: nextDays,
        feedback: {
          tone: "info",
          message: "Načetl se uložený koncept tohoto týdne z tohoto zařízení.",
        },
        resetSelection: true,
      });
    } catch {
      window.localStorage.removeItem(getDraftStorageKey(data.area, data.weekKey));
      applyHydratedState({
        days: cloneWeekDays(data.days),
        feedback: null,
        resetSelection: true,
      });
    }
  }, [data.area, data.days, data.weekKey]);

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
    () => workingDays.find((day) => day.dateKey === selectedDayKey) ?? workingDays[0] ?? null,
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
    const shouldLockScroll =
      currentInteraction.pointerType === "touch" || currentInteraction.pointerType === "pen";
    const previousBodyOverscrollBehavior = document.body.style.overscrollBehavior;
    const previousBodyTouchAction = document.body.style.touchAction;

    if (shouldLockScroll) {
      document.body.style.overscrollBehavior = "none";
      document.body.style.touchAction = "none";
    }

    function handlePointerMove(event: PointerEvent) {
      const effectivePointerType = event.pointerType || currentInteraction.pointerType;
      const isMouseDrag = effectivePointerType === "mouse" && event.buttons === 1;
      const isTouchLikeDrag = (effectivePointerType === "touch" || effectivePointerType === "pen") && event.buttons <= 1;

      if (!isMouseDrag && !isTouchLikeDrag) {
        return;
      }

      if (isTouchLikeDrag && event.cancelable) {
        event.preventDefault();
      }

      const target = document.elementFromPoint(event.clientX, event.clientY);
      const cellElement = target instanceof HTMLElement ? target.closest<HTMLElement>("[data-planner-cell='1']") : null;

      if (!cellElement) {
        return;
      }

      const dayKey = cellElement.dataset.dayKey;
      const cellIndexValue = cellElement.dataset.cellIndex;

      if (!dayKey || !cellIndexValue) {
        return;
      }

      const cellIndex = Number.parseInt(cellIndexValue, 10);

      if (!Number.isInteger(cellIndex)) {
        return;
      }

      handleCellMove(dayKey, cellIndex, event.buttons, effectivePointerType);
    }

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

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      if (shouldLockScroll) {
        document.body.style.overscrollBehavior = previousBodyOverscrollBehavior;
        document.body.style.touchAction = previousBodyTouchAction;
      }
    };
  }, [pendingInteraction, workingDays]);

  if (!selectedDay) {
    return (
      <div className="rounded-[1rem] border border-rose-300/22 bg-rose-300/10 px-4 py-3 text-sm text-white/84">
        Planner teď nemá načtené dny. Obnovte stránku, prosím.
      </div>
    );
  }

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

  function selectPlannerDay() {
    setPendingInteraction(null);
    setSelectedSelection(null);
    setMobileInspectorOpen(false);
  }

  function handleCellStart(day: PlannerDay, cellIndex: number, pointerType: string) {
    const tone = getCellTone(day, cellIndex);

    setPendingInteraction({
      dateKey: day.dateKey,
      anchorCell: cellIndex,
      hoverCell: cellIndex,
      mode: tone === "available" ? "remove" : "add",
      tone,
      pointerType,
      moved: false,
    });
  }

  function handleCellMove(dayKey: string, cellIndex: number, buttons: number, pointerType: string) {
    setPendingInteraction((current) => {
      if (!current || current.dateKey !== dayKey || !isEditableTone(current.tone)) {
        return current;
      }

      const effectivePointerType = pointerType || current.pointerType;
      const isMouseDrag = effectivePointerType === "mouse" && buttons === 1;
      const isTouchLikeDrag = (effectivePointerType === "touch" || effectivePointerType === "pen") && buttons <= 1;

      if (!isMouseDrag && !isTouchLikeDrag) {
        return current;
      }

      if (current.hoverCell === cellIndex && current.moved) {
        return current;
      }

      return {
        ...current,
        hoverCell: cellIndex,
        pointerType: effectivePointerType,
        moved: current.moved || current.anchorCell !== cellIndex,
      };
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
    window.localStorage.removeItem(getDraftStorageKey(data.area, data.weekKey));
    setFeedback({ tone: "info", message: "Koncept týdne byl zahozen a planner se vrátil k publikovanému stavu." });
  }

  function publishDraft() {
    startTransition(async () => {
      const sanitizedDays = serializeDraft(workingDays).map((day) => ({
        dateKey: day.dateKey,
        intervals: sanitizeIntervals(day.intervals),
      }));
      const result = await syncPlannerWeekDraftAction(data.area, {
        weekKey: data.weekKey,
        days: sanitizedDays,
      });

      const nextFeedback = { tone: result.ok ? "success" : "error", message: result.message } as FeedbackState;
      setFeedback(nextFeedback);

      if (result.ok) {
        setPendingInteraction(null);
        setSelectedSelection(null);
        setMobileInspectorOpen(false);
        window.localStorage.removeItem(getDraftStorageKey(data.area, data.weekKey));
        persistFeedback(data.area, data.weekKey, nextFeedback);
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
            onSelectDay={selectPlannerDay}
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
            onSelectDay={selectPlannerDay}
          />
        </div>

        <div className="hidden xl:block">
          <div className="sticky top-6">
            <DayInspector
              day={selectedDay}
              legend={data.legend}
              selection={selectedSelection}
              hasUnsavedChanges={hasUnsavedChanges}
              onApplySelection={applySelectedBlock}
              pending={isPending}
              createBookingBaseHref={data.baseHref}
            />
          </div>
        </div>
      </div>

      <MobileInspectorSheet open={mobileInspectorOpen} onClose={() => setMobileInspectorOpen(false)}>
        <DayInspector
          day={selectedDay}
          legend={data.legend}
          selection={selectedSelection}
          hasUnsavedChanges={hasUnsavedChanges}
          onApplySelection={applySelectedBlock}
          pending={isPending}
          createBookingBaseHref={data.baseHref}
        />
      </MobileInspectorSheet>

      <StickyActionBar
        visible={hasUnsavedChanges}
        pending={isPending}
        onDiscard={discardDraft}
        onPublish={publishDraft}
      />
    </div>
  );
}
