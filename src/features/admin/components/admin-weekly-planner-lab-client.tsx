"use client";

import FullCalendar from "@fullcalendar/react";
import csLocale from "@fullcalendar/react/locales/cs";
import interactionPlugin from "@fullcalendar/react/interaction";
import themePlugin from "@fullcalendar/react/themes/classic";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CalendarApi, DateClickInfo, DateSelectInfo, DatesSetInfo, EventClickInfo } from "@fullcalendar/react";

import { applyPlannerSelectionAction } from "@/features/admin/actions/slot-planner-actions";
import { updateAutoLunchDayModeAction } from "@/features/admin/actions/settings-actions";
import type { PlannerDay, PlannerWeekData } from "@/features/admin/lib/admin-slots";
import { addDays, formatDateKey, getDayBounds, monthDayFormatter, PLANNER_CELL_COUNT, PLANNER_END_HOUR, PLANNER_FINE_STEP_MINUTES, PLANNER_GRID_MINUTES, PLANNER_START_HOUR, PLANNER_TIME_ZONE, weekdayLongFormatter } from "@/features/admin/lib/admin-slots/time";
import { getPlannerCalendarContext, MAIN_SCHOOL_HOLIDAY_NAME } from "@/features/admin/lib/calendar-context/calendar-context";
import { createIdempotencyKey } from "@/lib/idempotency-key";
import * as AlertDialog from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/toast";
import { cloneWeekDays, hasBlockedCells, normalizePlannerSelectionToHalfHours, patchDayAvailableRange } from "./admin-weekly-planner-helpers";
import { plannerWeekToFullCalendarEvents, type PlannerLabEventType } from "./planner-lab-adapter";
import { getPlannerLabDefaultView, getPlannerLabWeekStart, isPlannerLabMobileViewport, movePlannerLabWeek, type PlannerLabView } from "./planner-lab-week";
import { PlannerLabSaveQueue } from "./planner-lab-save-queue";
import styles from "./planner-lab.module.css";

type PlannerMode = "view" | "add" | "remove";
type PlannerChange = Readonly<{ area: PlannerWeekData["area"]; weekKey: string; operationId: string; days: PlannerDay[]; dateKey: string; startCell: number; endCell: number; mode: Exclude<PlannerMode, "view">; revertedOperationId?: string }>;
type UndoChange = Pick<PlannerChange, "dateKey" | "startCell" | "endCell" | "mode" | "revertedOperationId">;

function formatWeekRange(weekStart: string) { const start = getDayBounds(weekStart).startsAt; const end = addDays(start, 6); const dayMonth = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "long", timeZone: PLANNER_TIME_ZONE }); const year = new Intl.DateTimeFormat("cs-CZ", { year: "numeric", timeZone: PLANNER_TIME_ZONE }); return `${dayMonth.format(start)} – ${dayMonth.format(end)} ${year.format(end)}`; }
function modeLabel(mode: PlannerMode) { return mode === "add" ? "Přidat termín" : mode === "remove" ? "Odebrat termín" : "Prohlížení"; }
function getPlannerBookingHref(area: PlannerWeekData["area"], bookingId: string) { return area === "owner" ? `/admin/rezervace/${bookingId}` : `/admin/provoz/rezervace/${bookingId}`; }
function getCalendarCellPosition(dateTime: string) { const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(dateTime); if (!match) return null; return { dateKey: match[1], cell: (Number(match[2]) * 60 + Number(match[3]) - PLANNER_START_HOUR * 60) / PLANNER_GRID_MINUTES }; }
function getCalendarClickPosition(info: DateClickInfo) { const target = info.jsEvent.target instanceof HTMLElement ? info.jsEvent.target.closest<HTMLElement>("[data-time]") : null; const dateKey = info.dayEl.dataset.date; const time = target?.dataset.time; return dateKey && time ? getCalendarCellPosition(`${dateKey}T${time}`) : getCalendarCellPosition(info.dateStr); }
function rangesIntersect(startMinutes: number, endMinutes: number, blockedStartMinutes: number, blockedEndMinutes: number) { return startMinutes < blockedEndMinutes && endMinutes > blockedStartMinutes; }
function canStartAfterBookingBlock(day: PlannerDay, startCell: number, endCell: number) {
  const startMinutes = startCell * PLANNER_GRID_MINUTES;
  const endMinutes = endCell * PLANNER_GRID_MINUTES;
  const endsAtBookingBlock = day.cleanupBlocks.some((block) => block.endMinutes === startMinutes)
    || day.bookings.some((booking) => booking.serviceEndMinutes === startMinutes);
  const protectedBlocks = [...day.cleanupBlocks, ...day.lockedBlocks, ...day.inactiveBlocks, ...day.bookings.map((booking) => ({ startMinutes: booking.serviceStartMinutes, endMinutes: booking.serviceEndMinutes }))];
  return endsAtBookingBlock && !day.cells.past[Math.floor(startCell)] && !protectedBlocks.some((block) => rangesIntersect(startMinutes, endMinutes, block.startMinutes, block.endMinutes));
}
function intersectsAvailableBlock(day: PlannerDay, startCell: number, endCell: number) {
  return day.availableBlocks.some((block) => rangesIntersect(startCell * PLANNER_GRID_MINUTES, endCell * PLANNER_GRID_MINUTES, block.startMinutes, block.endMinutes));
}

function getPlannerCalendarContextClass(date: Date) {
  const context = getPlannerCalendarContext(formatDateKey(date));
  return [
    context.publicHoliday ? styles.publicHolidayColumn : "",
    context.schoolHoliday ? styles.schoolHolidayColumn : "",
  ].filter(Boolean).join(" ") || undefined;
}

function renderPlannerDayHeader(date: Date) {
  const dateKey = formatDateKey(date);
  const context = getPlannerCalendarContext(dateKey);
  const dayStart = getDayBounds(dateKey).startsAt;
  const dayHeaderClass = context.publicHoliday
    ? styles.dayHeaderPublicHoliday
    : context.schoolHoliday
      ? styles.dayHeaderSchoolHoliday
      : "";

  return <div className={`${styles.dayHeader} ${dayHeaderClass}`}>
    <span className={styles.dayHeaderDate}><span className={styles.dayWeekday}>{weekdayLongFormatter.format(dayStart).toLocaleUpperCase("cs-CZ")}</span><span className={styles.dayDate}>{monthDayFormatter.format(dayStart)}</span></span>
    {context.publicHoliday ? <span className={styles.publicHolidayNotice}><span className={styles.publicHolidayBadge}><span aria-hidden="true">🇨🇿</span><strong>ZAVŘENO</strong></span><span className={styles.publicHolidayName} title={context.publicHoliday.name}>{context.publicHoliday.name}</span></span> : null}
    {context.schoolHoliday ? <span className={`${styles.schoolHolidayBadge} ${context.schoolHoliday.name === MAIN_SCHOOL_HOLIDAY_NAME ? styles.schoolHolidaySummer : ""}`} title={context.schoolHoliday.name}><span aria-hidden="true">🎒</span><span>{context.schoolHoliday.name}</span></span> : null}
  </div>;
}

export function AdminWeeklyPlannerClient({ data, weekStart, initialDate, hasInitialDay = false, routeBase }: { data: PlannerWeekData; weekStart: string; initialDate?: string; hasInitialDay?: boolean; routeBase: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const calendarRef = useRef<{ getApi: () => CalendarApi } | null>(null);
  const calendarContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<{ pageX: number; pageY: number; calendarY: number } | null>(null);
  const effectiveInitialDate = initialDate ?? weekStart;
  const requestedWeekRef = useRef(weekStart); const requestedDateRef = useRef(effectiveInitialDate);
  const recentCellMutationRef = useRef<{ dateKey: string; startCell: number; endCell: number; expiresAt: number } | null>(null);
  const datesSetFrameRef = useRef<number | null>(null); const hydratedWeekRef = useRef(weekStart); const restoreRequestedRef = useRef(false);
  const confirmedDaysRef = useRef(cloneWeekDays(data.days));
  const saveQueueRef = useRef<PlannerLabSaveQueue<PlannerChange> | null>(null);
  const [mounted, setMounted] = useState(false); const [compact, setCompact] = useState(false);
  const [days, setDays] = useState<PlannerDay[]>(() => cloneWeekDays(data.days));
  const [message, setMessage] = useState<string | null>("Prohlížení – kalendář nic nemění."); const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false); const [isWeekLoading, setIsWeekLoading] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [restoreConfirmationOpen, setRestoreConfirmationOpen] = useState(false);
  const restoreCancelRef = useRef<HTMLButtonElement>(null);
  const [openWeekStart, setOpenWeekStart] = useState(weekStart); const [activeView, setActiveView] = useState<PlannerLabView>("timeGridWorkWeek");
  const [mode, setMode] = useState<PlannerMode>("view");
  const [selectedLunchDate, setSelectedLunchDate] = useState(initialDate ?? weekStart);
  const [undoChange, setUndoChange] = useState<UndoChange | null>(null); const undoTimeoutRef = useRef<number | null>(null);
  const clearUndo = useCallback(() => { if (undoTimeoutRef.current !== null) window.clearTimeout(undoTimeoutRef.current); undoTimeoutRef.current = null; setUndoChange(null); }, []);
  const offerUndo = useCallback((change: PlannerChange, operationId?: string) => { clearUndo(); setUndoChange({ dateKey: change.dateKey, startCell: change.startCell, endCell: change.endCell, mode: change.mode, revertedOperationId: operationId }); undoTimeoutRef.current = window.setTimeout(() => setUndoChange(null), 12_000); }, [clearUndo]);
  useEffect(() => () => { if (undoTimeoutRef.current !== null) window.clearTimeout(undoTimeoutRef.current); }, []);
  useEffect(() => { saveQueueRef.current = new PlannerLabSaveQueue(
    async (change) => { const result = await applyPlannerSelectionAction(change.area, { weekKey: change.weekKey, dateKey: change.dateKey, startCell: change.startCell, endCell: change.endCell, mode: change.mode, operationId: change.operationId, revertedOperationId: change.revertedOperationId }); return result.ok ? { ok: true as const, operationId: result.operationId } : { ok: false as const, message: result.message }; },
    setIsSaving,
    (savedChange) => { confirmedDaysRef.current = cloneWeekDays(savedChange.days); offerUndo(savedChange, savedChange.operationId); },
    () => { setHasPendingChanges(false); setSaveError(null); setMessage("Uloženo"); setIsWeekLoading(true); restoreRequestedRef.current = true; router.refresh(); },
    (error) => { setSaveError(error); setMessage(error); },
  ); return () => { saveQueueRef.current = null; }; }, [offerUndo, router]);
  useEffect(() => { const media = window.matchMedia("(max-width: 1023px)"); const update = () => setCompact(isPlannerLabMobileViewport(window.innerWidth)); const frame = window.requestAnimationFrame(() => { update(); setMounted(true); }); media.addEventListener("change", update); return () => { window.cancelAnimationFrame(frame); media.removeEventListener("change", update); }; }, []);
  useEffect(() => () => { if (datesSetFrameRef.current !== null) window.cancelAnimationFrame(datesSetFrameRef.current); }, []);
  useEffect(() => { if (data.weekKey !== requestedWeekRef.current || (data.weekKey === hydratedWeekRef.current && !restoreRequestedRef.current)) return; restoreRequestedRef.current = false; hydratedWeekRef.current = data.weekKey; const nextDays = cloneWeekDays(data.days); confirmedDaysRef.current = nextDays; setDays(cloneWeekDays(nextDays)); setOpenWeekStart(data.weekKey); setSaveError(null); setIsWeekLoading(false); calendarRef.current?.getApi().gotoDate(requestedDateRef.current); }, [data]);
  useEffect(() => { if (!mounted) return; const nextView = getPlannerLabDefaultView(compact); const frame = window.requestAnimationFrame(() => { setActiveView(nextView); const calendar = calendarRef.current?.getApi(); const mobileToday = !hasInitialDay && data.days.some((day) => day.dateKey === data.todayKey) ? data.todayKey : requestedDateRef.current; const targetDate = compact ? mobileToday : requestedDateRef.current; if (compact && !hasInitialDay) requestedDateRef.current = mobileToday; if (!calendar) return; if (calendar.view.type === nextView) { calendar.gotoDate(targetDate); return; } calendar.changeView(nextView, targetDate); }); return () => window.cancelAnimationFrame(frame); }, [compact, data.days, data.todayKey, hasInitialDay, mounted]);

  const events = useMemo(() => plannerWeekToFullCalendarEvents(data, days), [data, days]);
  const selectedLunchDay = days.find((day) => day.dateKey === selectedLunchDate) ?? days[0];
  async function changeLunchMode(nextMode: "AUTO" | "OFF") {
    if (!selectedLunchDay || !data.autoLunchEnabled || selectedLunchDay.autoLunch.mode === nextMode || isWeekLoading) return;
    setIsWeekLoading(true);
    restoreRequestedRef.current = true;
    const result = await updateAutoLunchDayModeAction({ area: data.area, dateKey: selectedLunchDay.dateKey, mode: nextMode });
    if (!result.ok) {
      setIsWeekLoading(false);
      restoreRequestedRef.current = false;
      toast({ message: result.message ?? "Změnu režimu oběda se nepodařilo uložit.", tone: "error" });
      return;
    }
    toast({ message: nextMode === "OFF" ? "Automatický oběd je pro tento den vypnutý." : "Automatický oběd je pro tento den zapnutý." });
    router.refresh();
  }
  const canEdit = !isWeekLoading && !saveError; const canNavigate = !isSaving && !isWeekLoading && !saveError && !hasPendingChanges;
  function getCalendarScroller() { return [...(calendarContainerRef.current?.querySelectorAll<HTMLElement>("*") ?? [])].find((element) => { const overflowY = window.getComputedStyle(element).overflowY; return (overflowY === "auto" || overflowY === "scroll") && element.scrollHeight > element.clientHeight; }); }
  function rememberScrollPosition() { if (!compact) return; const scroller = getCalendarScroller(); scrollPositionRef.current = { pageX: window.scrollX, pageY: window.scrollY, calendarY: scroller?.scrollTop ?? 0 }; }
  function restoreScrollPosition() { const position = scrollPositionRef.current; if (!position) return; window.requestAnimationFrame(() => window.requestAnimationFrame(() => { const scroller = getCalendarScroller(); window.scrollTo({ left: position.pageX, top: position.pageY, behavior: "auto" }); if (scroller) scroller.scrollTop = position.calendarY; scrollPositionRef.current = null; })); }
  function keepsQuarterHourStart(day: PlannerDay, startCell: number, endCell: number) {
    return !Number.isInteger(startCell) && canStartAfterBookingBlock(day, startCell, endCell);
  }
  function getSelectionRange(day: PlannerDay, startCell: number, endCell: number) {
    return keepsQuarterHourStart(day, startCell, endCell)
      ? { startCell, endCell }
      : normalizePlannerSelectionToHalfHours(startCell, endCell);
  }
  function selectAllow(info: { startStr: string; endStr: string }) { if (!canEdit || mode === "view") return false; const start = getCalendarCellPosition(info.startStr); const end = getCalendarCellPosition(info.endStr); if (!start || !end || start.dateKey !== end.dateKey || !Number.isInteger(start.cell * 2) || !Number.isInteger(end.cell * 2) || end.cell <= start.cell) return false; if (mode === "add") return true; const day = days.find((item) => item.dateKey === start.dateKey); if (!day) return false; if (keepsQuarterHourStart(day, start.cell, end.cell)) return intersectsAvailableBlock(day, start.cell, end.cell); const selection = getSelectionRange(day, start.cell, end.cell); return !hasBlockedCells(day, selection.startCell, selection.endCell); }
  function saveAvailabilityChange(nextDays: PlannerDay[], dateKey: string, startCell: number, endCell: number, nextMode: Exclude<PlannerMode, "view">, revertedOperationId?: string) { const change: PlannerChange = Object.freeze({ area: data.area, weekKey: data.weekKey, operationId: createIdempotencyKey(), days: cloneWeekDays(nextDays), dateKey, startCell, endCell, mode: nextMode, revertedOperationId }); setDays(nextDays); restoreScrollPosition(); setMessage("Ukládám…"); clearUndo(); setHasPendingChanges(true); saveQueueRef.current?.enqueue(change); }
  function retrySave() { setSaveError(null); setMessage("Ukládám…"); saveQueueRef.current?.retry(); }
  function restoreSavedState() { saveQueueRef.current?.discardPending(); setHasPendingChanges(false); setDays(cloneWeekDays(confirmedDaysRef.current)); setSaveError(null); setMessage("Načítám uložený stav…"); setIsWeekLoading(true); restoreRequestedRef.current = true; router.refresh(); }
  function requestRestoreSavedState() { if ((saveQueueRef.current?.pendingCount() ?? 0) > 1) { setRestoreConfirmationOpen(true); return; } restoreSavedState(); }
  function updateAvailabilityRange(dateKey: string, startCell: number, endCell: number, nextMode: Exclude<PlannerMode, "view">, shouldRememberScroll = true, revertedOperationId?: string) {
    if (!canEdit) return; const recent = recentCellMutationRef.current;
    if (recent && recent.dateKey === dateKey && recent.startCell === startCell && recent.endCell === endCell && recent.expiresAt > Date.now()) return;
    const day = days.find((item) => item.dateKey === dateKey);
    const startsAfterBookingBlock = day && !Number.isInteger(startCell) && canStartAfterBookingBlock(day, startCell, endCell) && (nextMode === "add" || intersectsAvailableBlock(day, startCell, endCell));
    const hasValidRange = day && endCell > startCell && startCell >= 0 && endCell <= PLANNER_CELL_COUNT && (startsAfterBookingBlock || (Number.isInteger(startCell) && Number.isInteger(endCell) && !hasBlockedCells(day, startCell, endCell)));
    if (!hasValidRange) { setMessage("Rezervace, úklid a chráněné intervaly nelze upravit."); return; }
    if (nextMode === "remove" && !intersectsAvailableBlock(day, startCell, endCell)) { setMessage("V označeném čase není dostupnost k odebrání."); return; }
    recentCellMutationRef.current = { dateKey, startCell, endCell, expiresAt: Date.now() + 400 }; if (shouldRememberScroll) rememberScrollPosition();
    const nextDays = days.map((item) => item.dateKey === dateKey ? patchDayAvailableRange(item, startCell, endCell, nextMode) : item); saveAvailabilityChange(nextDays, dateKey, startCell, endCell, nextMode, revertedOperationId);
  }
  function handleSelect(info: DateSelectInfo) { const start = getCalendarCellPosition(info.startStr); const end = getCalendarCellPosition(info.endStr); rememberScrollPosition(); info.view.calendar.unselect(); if (mode !== "view" && start && end && start.dateKey === end.dateKey) { const day = days.find((item) => item.dateKey === start.dateKey); if (day) { const selection = getSelectionRange(day, start.cell, end.cell); updateAvailabilityRange(start.dateKey, selection.startCell, selection.endCell, mode, false); } } }
  function handleDateClick(info: DateClickInfo) { if (mode === "view") return; const position = getCalendarClickPosition(info); const day = position ? days.find((item) => item.dateKey === position.dateKey) : null; if (position) { const startCell = day && !Number.isInteger(position.cell) && !canStartAfterBookingBlock(day, position.cell, position.cell + 1) ? Math.floor(position.cell) : position.cell; updateAvailabilityRange(position.dateKey, startCell, startCell + 1, mode); } }
  function handleEventClick(info: EventClickInfo) { const details = info.event.extendedProps as { type: PlannerLabEventType; bookingId?: string }; if ((details.type === "booking" || details.type === "completed") && details.bookingId) router.push(getPlannerBookingHref(data.area, details.bookingId)); }
  function undoLastChange() { if (!undoChange || isSaving || isWeekLoading) return; const reverseMode = undoChange.mode === "add" ? "remove" : "add"; const revertedOperationId = undoChange.revertedOperationId; clearUndo(); recentCellMutationRef.current = null; updateAvailabilityRange(undoChange.dateKey, undoChange.startCell, undoChange.endCell, reverseMode, true, revertedOperationId); }
  function requestWeek(nextWeekStart: string, focusDate = nextWeekStart) { if (!canNavigate) { setMessage("Nejdřív zopakujte změnu nebo obnovte uložený stav."); return; } requestedDateRef.current = focusDate; if (nextWeekStart === requestedWeekRef.current) { calendarRef.current?.getApi().gotoDate(focusDate); router.replace(`${routeBase}?week=${nextWeekStart}&day=${focusDate}`, { scroll: false }); return; } requestedWeekRef.current = nextWeekStart; setIsWeekLoading(true); setOpenWeekStart(nextWeekStart); calendarRef.current?.getApi().gotoDate(focusDate); router.replace(`${routeBase}?week=${nextWeekStart}&day=${focusDate}`, { scroll: false }); }
  function handleDatesSet(info: DatesSetInfo) { if (datesSetFrameRef.current !== null) window.cancelAnimationFrame(datesSetFrameRef.current); datesSetFrameRef.current = window.requestAnimationFrame(() => { datesSetFrameRef.current = null; const currentDate = calendarRef.current?.getApi().getDate() ?? info.view.currentStart; const nextWeekStart = getPlannerLabWeekStart(currentDate); const focusDate = formatDateKey(currentDate); if (nextWeekStart !== requestedWeekRef.current && !canNavigate) { setMessage("Nejdřív zopakujte změnu nebo obnovte uložený stav."); calendarRef.current?.getApi().gotoDate(requestedDateRef.current); return; } setOpenWeekStart(nextWeekStart); if (nextWeekStart !== requestedWeekRef.current) { requestWeek(nextWeekStart, focusDate); return; } if (focusDate !== requestedDateRef.current) { requestedDateRef.current = focusDate; router.replace(`${routeBase}?week=${nextWeekStart}&day=${focusDate}`, { scroll: false }); } }); }
  function changeView(view: PlannerLabView) { if (!canNavigate) return; setActiveView(view); const date = view === "timeGridWeekend" ? formatDateKey(addDays(getDayBounds(openWeekStart).startsAt, 5)) : view === "timeGridDay" ? requestedDateRef.current : openWeekStart; calendarRef.current?.getApi().changeView(view, date); }
  function moveNavigation(amount: -1 | 1) { const calendar = calendarRef.current?.getApi(); if (activeView === "timeGridDay") { const currentDate = formatDateKey(calendar?.getDate() ?? getDayBounds(requestedDateRef.current).startsAt); const nextDate = formatDateKey(addDays(getDayBounds(currentDate).startsAt, amount)); requestWeek(getPlannerLabWeekStart(getDayBounds(nextDate).startsAt), nextDate); return; } const nextWeekStart = movePlannerLabWeek(openWeekStart, amount); const focusDate = activeView === "timeGridWeekend" ? formatDateKey(addDays(getDayBounds(nextWeekStart).startsAt, 5)) : nextWeekStart; requestWeek(nextWeekStart, focusDate); }
  const initialView = getPlannerLabDefaultView(compact); const status = isWeekLoading ? "Načítám týden…" : isSaving ? "Ukládám…" : saveError ?? message;
  const viewChoices = compact ? ([['timeGridDay', 'Den'], ['timeGridWorkWeek', 'Po–Pá'], ['timeGridWeekend', 'Víkend']] as const) : ([['timeGridWorkWeek', 'Po–Pá'], ['timeGridWeek', 'Celý týden']] as const);
  return <div className={styles.planner}>
    <div className={styles.controls}><span className={styles.weekRange}>{formatWeekRange(openWeekStart)}</span><div className={styles.navigation} aria-label="Navigace týdne"><button type="button" className={styles.controlButton} onClick={() => moveNavigation(-1)} aria-label={activeView === "timeGridDay" ? "Předchozí den" : "Předchozí týden"} disabled={!canNavigate}>←</button><button type="button" className={styles.controlButton} onClick={() => { const today = formatDateKey(new Date()); requestWeek(getPlannerLabWeekStart(new Date()), today); }} disabled={!canNavigate}>Dnes</button><button type="button" className={styles.controlButton} onClick={() => moveNavigation(1)} aria-label={activeView === "timeGridDay" ? "Následující den" : "Následující týden"} disabled={!canNavigate}>→</button></div><div className={styles.viewSwitch} aria-label="Pohled kalendáře">{viewChoices.map(([view, label]) => <button key={view} type="button" className={`${styles.viewButton} ${activeView === view ? styles.viewButtonActive : ""}`} onClick={() => changeView(view)} disabled={!canNavigate} aria-pressed={activeView === view}>{label}</button>)}</div><div className={styles.modeSwitch} aria-label="Režim úprav">{(["view", "add", "remove"] as const).map((item) => <button key={item} type="button" className={`${styles.modeButton} ${mode === item ? styles.modeButtonActive : ""}`} onClick={() => { setMode(item); setMessage(item === "view" ? "Prohlížení – kalendář nic nemění." : `${modeLabel(item)} – zvolený interval se uloží.`); }} disabled={!canEdit} aria-pressed={mode === item}>{modeLabel(item)}</button>)}</div><div className={styles.status} role="status" aria-live="polite"><span>{status}</span></div>{saveError ? <div className={styles.statusActions}><button type="button" onClick={retrySave} className={styles.retryButton}>Zkusit znovu</button><button type="button" onClick={requestRestoreSavedState} className={styles.retryButton}>Obnovit uložený stav</button></div> : null}{undoChange ? <button type="button" onClick={undoLastChange} className={styles.retryButton}>Vrátit změnu</button> : null}</div>
    <div className={styles.legend} aria-label="Legenda kalendáře"><span><i className={styles.legendAvailability} aria-hidden="true" />Volný termín</span><span><i className={styles.legendPending} aria-hidden="true" />Čeká na potvrzení</span><span><i className={styles.legendBooking} aria-hidden="true" />Potvrzená rezervace</span><span><i className={styles.legendCleanup} aria-hidden="true" />Úklid</span><span><i className={styles.legendProtected} aria-hidden="true" />Chráněný interval</span><span><i className={styles.legendLunch} aria-hidden="true" />Oběd · automaticky</span><span><i className={styles.legendPublicHoliday} aria-hidden="true" />🇨🇿 Svátek · zavřeno</span><span><i className={styles.legendSchoolHoliday} aria-hidden="true" />🎒 Školní prázdniny</span><span><i className={styles.legendUnsaved} aria-hidden="true" />Neuložený stav</span><span><i className={styles.legendError} aria-hidden="true" />Chyba ukládání</span></div>
    <div className={styles.lunchControls} aria-label="Denní režim automatického oběda"><label htmlFor="planner-lunch-date">Oběd pro den</label><select id="planner-lunch-date" value={selectedLunchDay?.dateKey ?? ""} onChange={(event) => setSelectedLunchDate(event.target.value)} disabled={!selectedLunchDay || isWeekLoading}>{days.map((day) => <option key={day.dateKey} value={day.dateKey}>{day.label}</option>)}</select><button type="button" className={`${styles.modeButton} ${selectedLunchDay?.autoLunch.mode === "AUTO" ? styles.modeButtonActive : ""}`} onClick={() => changeLunchMode("AUTO")} disabled={!data.autoLunchEnabled || !selectedLunchDay || isWeekLoading} aria-pressed={selectedLunchDay?.autoLunch.mode === "AUTO"}>AUTO</button><button type="button" className={`${styles.modeButton} ${selectedLunchDay?.autoLunch.mode === "OFF" ? styles.modeButtonActive : ""}`} onClick={() => changeLunchMode("OFF")} disabled={!data.autoLunchEnabled || !selectedLunchDay || isWeekLoading} aria-pressed={selectedLunchDay?.autoLunch.mode === "OFF"}>OFF</button><span className={styles.lunchNote}>{!data.autoLunchEnabled ? "Automatický oběd je globálně vypnutý." : selectedLunchDay?.autoLunch.warning ? "Pro tento den není možné umístit automatickou 45minutovou obědovou přestávku." : selectedLunchDay?.autoLunch.mode === "OFF" ? "Automatický oběd je pro tento den vypnutý." : selectedLunchDay?.autoLunch.startsAt ? "Systém chrání 45 minut a přizpůsobuje čas rezervacím." : "Automatický oběd není pro tuto směnu potřeba."}</span></div>
    <div ref={calendarContainerRef} className={`${styles.calendar} ${activeView === "timeGridWorkWeek" ? styles.workWeek : ""}`} data-testid="fullcalendar-planner">{mounted ? <FullCalendar ref={calendarRef} plugins={[themePlugin, timeGridPlugin, interactionPlugin]} locales={[csLocale]} locale="cs" colorScheme="dark" initialView={initialView} initialDate={effectiveInitialDate} firstDay={1} timeZone={PLANNER_TIME_ZONE} events={events} selectable={canEdit && mode !== "view"} selectMirror={compact} longPressDelay={compact ? 450 : undefined} selectLongPressDelay={compact ? 450 : undefined} selectAllow={selectAllow} select={handleSelect} dateClick={handleDateClick} eventClick={handleEventClick} eventDidMount={(info) => { const details = info.event.extendedProps as { type: PlannerLabEventType; clientName?: string; serviceName?: string }; const label = details.type === "booking" || details.type === "completed" ? `${details.type === "completed" ? "Dokončená rezervace" : "Rezervace"}: ${details.serviceName ?? "služba"}, ${details.clientName ?? "klientka"}. Otevřít detail.` : info.event.title; info.el.setAttribute("aria-label", label); if (details.type === "booking" || details.type === "completed") info.el.setAttribute("title", label); }} dayHeaderClass={(arg) => getPlannerCalendarContextClass(arg.date)} dayHeaderContent={(arg) => renderPlannerDayHeader(arg.date)} slotLaneClass={(arg) => getPlannerCalendarContextClass(arg.date)} datesSet={handleDatesSet} editable={false} eventStartEditable={false} eventDurationEditable={false} allDaySlot={false} slotMinTime={`${String(PLANNER_START_HOUR).padStart(2, "0")}:00:00`} slotMaxTime={`${String(PLANNER_END_HOUR).padStart(2, "0")}:00:00`} slotDuration={`00:${String(PLANNER_GRID_MINUTES).padStart(2, "0")}:00`} snapDuration={`00:${String(PLANNER_FINE_STEP_MINUTES).padStart(2, "0")}:00`} scrollTimeReset={false} height="100%" expandRows nowIndicator weekends slotEventOverlap={false} eventMinHeight={0} eventShortHeight={0} views={{ timeGridWorkWeek: { type: "timeGrid", duration: { days: 5 } }, timeGridWeekend: { type: "timeGrid", duration: { days: 2 } }}} eventContent={(arg) => { const details = arg.event.extendedProps as { type: PlannerLabEventType; clientName?: string; serviceName?: string }; if (details.type === "availability" || details.type === "protected") return null; if (details.type === "cleanup") return <span className={styles.cleanupEvent}><b>{arg.timeText}</b><span>Úklid</span></span>; if (details.type === "lunch") return <span className={styles.lunchEvent}><b>{arg.timeText}</b><span>Oběd · automaticky</span></span>; if (details.type === "booking" || details.type === "completed") return <span className={styles.eventMedium}><span className={styles.eventTitle}><b>{arg.timeText}</b><span>{details.clientName ?? "Klientka"}</span></span><span className={styles.eventService}>{details.serviceName ?? "Služba"}</span></span>; return <span className={styles.eventShort}><b>{arg.timeText}</b><span>{arg.event.title}</span></span>; }} /> : <div className="h-full animate-pulse bg-white/[.04]" />}</div>
    <AlertDialog.Root open={restoreConfirmationOpen} onOpenChange={setRestoreConfirmationOpen}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay />
        <AlertDialog.Content className="rounded-[1.7rem] border border-white/10 bg-[#131116] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.45)] sm:p-6" onOpenAutoFocus={(event) => { event.preventDefault(); restoreCancelRef.current?.focus(); }}>
          <AlertDialog.Title>Zahodit neuložené změny?</AlertDialog.Title>
          <AlertDialog.Description>Obnovením uloženého stavu přijdete o aktuální neuložené úpravy. Akci můžete zrušit tlačítkem Zpět.</AlertDialog.Description>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild><button ref={restoreCancelRef} type="button" className="rounded-full border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:border-white/18 hover:bg-white/6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]">Zpět</button></AlertDialog.Cancel>
            <AlertDialog.Action asChild><button type="button" onClick={restoreSavedState} className="rounded-full bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400">Zahodit změny</button></AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  </div>;
}
