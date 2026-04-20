"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  applyPlannerSelectionAction,
  applyWeeklyTemplateAction,
  clearPlannerDayAction,
  copyPlannerDayAction,
  copyPlannerWeekAction,
} from "@/features/admin/actions/slot-planner-actions";
import type { PlannerDay, PlannerWeekData } from "@/features/admin/lib/admin-slots";
import {
  type DraftSelection,
  type WeeklyTemplateInput,
  DayDetails,
  DesktopWeekGrid,
  MobileDayGrid,
  MobileDayPicker,
  PlannerFeedback,
  SelectionStatus,
  WeekToolbar,
  getCellTone,
  getSelectionRange,
  getWeekdayTemplateFromDays,
  isEditableTone,
} from "./admin-weekly-planner-ui";

const TEMPLATE_STORAGE_KEY = "ppstudio-admin-weekly-template-v2";

type AdminWeeklyPlannerClientProps = {
  data: PlannerWeekData;
  timeLabels: string[];
  initialDayKey: string;
};

type FeedbackState = {
  tone: "success" | "error" | "info";
  message: string;
};

function getBlockedMessage(tone: ReturnType<typeof getCellTone>) {
  if (tone === "booked") {
    return "Tahle část dne už patří k rezervaci a nejde ji z planneru upravit.";
  }

  if (tone === "past") {
    return "Minulý čas už není možné měnit.";
  }

  return "Tento interval je omezený nebo neaktivní a nejde ho upravit přímo z týdenního planneru.";
}

export function AdminWeeklyPlannerClient({
  data,
  timeLabels,
  initialDayKey,
}: AdminWeeklyPlannerClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draftSelection, setDraftSelection] = useState<DraftSelection | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [copyTargetKey, setCopyTargetKey] = useState("");

  const selectedDayKey = draftSelection?.dateKey ?? initialDayKey;
  const selectedDay = useMemo(
    () => data.days.find((day) => day.dateKey === selectedDayKey) ?? data.days[0],
    [data.days, selectedDayKey],
  );

  useEffect(() => {
    if (!draftSelection) {
      return undefined;
    }

    const currentDraft = draftSelection;

    function handlePointerUp() {
      const range = getSelectionRange(currentDraft);
      setDraftSelection(null);

      startTransition(async () => {
        const result = await applyPlannerSelectionAction(data.area, {
          weekKey: data.weekKey,
          dateKey: currentDraft.dateKey,
          startCell: range.startCell,
          endCell: range.endCell,
          mode: currentDraft.mode,
        });

        if (result.ok) {
          setFeedback(null);
          setCopyTargetKey("");
          router.replace(`${data.baseHref}?week=${data.weekKey}&day=${currentDraft.dateKey}`, { scroll: false });
          router.refresh();
        } else {
          setFeedback({ tone: "error", message: result.message });
        }
      });
    }

    window.addEventListener("pointerup", handlePointerUp);
    return () => window.removeEventListener("pointerup", handlePointerUp);
  }, [data, draftSelection, router]);

  function handleCellStart(day: PlannerDay, cellIndex: number) {
    const tone = getCellTone(day, cellIndex);

    if (!isEditableTone(tone)) {
      setFeedback({ tone: "error", message: getBlockedMessage(tone) });
      return;
    }

    setDraftSelection({
      dateKey: day.dateKey,
      mode: tone === "available" ? "remove" : "add",
      anchorCell: cellIndex,
      hoverCell: cellIndex,
    });
  }

  function handleCellMove(dayKey: string, cellIndex: number, buttons: number) {
    if (buttons !== 1) {
      return;
    }

    setDraftSelection((current) => {
      if (!current || current.dateKey !== dayKey) {
        return current;
      }

      return { ...current, hoverCell: cellIndex };
    });
  }

  function runServerAction(action: () => Promise<{ ok: boolean; message: string }>, onSuccess?: () => void) {
    startTransition(async () => {
      const result = await action();
      setFeedback({ tone: result.ok ? "success" : "error", message: result.message });

      if (result.ok) {
        onSuccess?.();
        router.refresh();
      }
    });
  }

  function runDayCopy() {
    if (!copyTargetKey || copyTargetKey === selectedDay.dateKey) {
      setFeedback({ tone: "error", message: "Vyberte jiný cílový den v rámci týdne." });
      return;
    }

    runServerAction(() =>
      copyPlannerDayAction(data.area, {
        weekKey: data.weekKey,
        sourceDateKey: selectedDay.dateKey,
        targetDateKey: copyTargetKey,
      }),
    );
  }

  function runClearDay() {
    runServerAction(() =>
      clearPlannerDayAction(data.area, {
        weekKey: data.weekKey,
        dateKey: selectedDay.dateKey,
      }),
    );
  }

  function runCopyWeek(targetWeekKey: string) {
    runServerAction(
      () =>
        copyPlannerWeekAction(data.area, {
          sourceWeekKey: data.weekKey,
          targetWeekKey,
        }),
      () => {
        router.push(`${data.baseHref}?week=${targetWeekKey}&day=${selectedDay.dateKey}`);
      },
    );
  }

  function saveTemplate() {
    const payload = getWeekdayTemplateFromDays(data.days);
    window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(payload));
    setFeedback({ tone: "success", message: "Šablona týdne je uložená v tomto zařízení." });
  }

  function applyTemplate() {
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

    runServerAction(() =>
      applyWeeklyTemplateAction(data.area, {
        weekKey: data.weekKey,
        template,
      }),
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <WeekToolbar
            baseHref={data.baseHref}
            previousWeekKey={data.previousWeekKey}
            todayKey={data.todayKey}
            nextWeekKey={data.nextWeekKey}
            currentDayKey={selectedDay.dateKey}
            onCopyWeek={() => runCopyWeek(data.nextWeekKey)}
            onSaveTemplate={saveTemplate}
            onApplyTemplate={applyTemplate}
            pending={isPending}
          />

          {feedback ? <PlannerFeedback tone={feedback.tone} message={feedback.message} /> : null}
          <SelectionStatus draft={draftSelection} />

          <MobileDayPicker
            days={data.days}
            selectedDayKey={selectedDay.dateKey}
            baseHref={data.baseHref}
            weekKey={data.weekKey}
          />

          <MobileDayGrid
            day={selectedDay}
            timeLabels={timeLabels}
            draft={draftSelection}
            onCellStart={handleCellStart}
            onCellMove={handleCellMove}
          />
          <DesktopWeekGrid
            days={data.days}
            timeLabels={timeLabels}
            draft={draftSelection}
            onCellStart={handleCellStart}
            onCellMove={handleCellMove}
            selectedDayKey={selectedDay.dateKey}
            baseHref={data.baseHref}
            weekKey={data.weekKey}
          />
        </div>

        <DayDetails
          day={selectedDay}
          days={data.days}
          legend={data.legend}
          copyTargetKey={copyTargetKey}
          onCopyTargetChange={setCopyTargetKey}
          onCopyDay={runDayCopy}
          onClearDay={runClearDay}
          pending={isPending}
        />
      </div>
    </div>
  );
}
