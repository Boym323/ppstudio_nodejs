"use client";

import FullCalendar from "@fullcalendar/react";
import csLocale from "@fullcalendar/react/locales/cs";
import interactionPlugin from "@fullcalendar/react/interaction";
import themePlugin from "@fullcalendar/react/themes/classic";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CalendarApi, DateClickInfo, DateSelectInfo, DatesSetInfo } from "@fullcalendar/react";

import { applyPlannerSelectionAction } from "@/features/admin/actions/slot-planner-actions";
import type { PlannerDay, PlannerWeekData } from "@/features/admin/lib/admin-slots";
import { addDays, dateToCellIndex, formatDateKey, getDayBounds } from "@/features/admin/lib/admin-slots/time";
import { buildIntervalsFromCells, cloneWeekDays, hasBlockedCells, patchDayAvailableIntervals } from "./admin-weekly-planner-helpers";
import { plannerWeekToFullCalendarEvents, type PlannerLabEventType } from "./planner-lab-adapter";
import { getPlannerLabDefaultView, getPlannerLabWeekStart, movePlannerLabWeek, type PlannerLabView } from "./planner-lab-week";
import { PlannerLabSaveQueue } from "./planner-lab-save-queue";
import styles from "./planner-lab.module.css";

function isCompactViewport(width: number) { return width < 1024; }
function formatWeekRange(weekStart: string) { const start = getDayBounds(weekStart).startsAt; const end = addDays(start, 6); const dayMonth = new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "long", timeZone: "Europe/Prague" }); const year = new Intl.DateTimeFormat("cs-CZ", { year: "numeric", timeZone: "Europe/Prague" }); return `${dayMonth.format(start)} – ${dayMonth.format(end)} ${year.format(end)}`; }

export function AdminWeeklyPlannerLabClient({ data, weekStart }: { data: PlannerWeekData; weekStart: string }) {
  const router = useRouter();
  const calendarRef = useRef<{ getApi: () => CalendarApi } | null>(null);
  const calendarContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<{ pageX: number; pageY: number; calendarY: number } | null>(null);
  const requestedWeekRef = useRef(weekStart);
  const requestedDateRef = useRef(weekStart);
  const recentCellMutationRef = useRef<{ dateKey: string; startCell: number; endCell: number; expiresAt: number } | null>(null);
  const hydratedWeekRef = useRef(weekStart);
  const contextRef = useRef({ area: data.area, weekKey: data.weekKey });
  const confirmedDaysRef = useRef(cloneWeekDays(data.days));
  const saveQueueRef = useRef<PlannerLabSaveQueue<{ days: PlannerDay[]; dateKey: string; startCell: number; endCell: number; mode: "add" | "remove" }> | null>(null);
  const [mounted, setMounted] = useState(false); const [compact, setCompact] = useState(false);
  const [days, setDays] = useState(() => cloneWeekDays(data.days));
  const [message, setMessage] = useState<string | null>("Uloženo"); const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false); const [isWeekLoading, setIsWeekLoading] = useState(false);
  const [openWeekStart, setOpenWeekStart] = useState(weekStart); const [activeView, setActiveView] = useState<PlannerLabView>("timeGridWorkWeek");
  useEffect(() => { saveQueueRef.current = new PlannerLabSaveQueue(
    async (change) => { const context = contextRef.current; const result = await applyPlannerSelectionAction(context.area, { weekKey: context.weekKey, dateKey: change.dateKey, startCell: change.startCell, endCell: change.endCell, mode: change.mode }); return result.ok ? { ok: true as const } : { ok: false as const, message: result.message }; },
    setIsSaving,
    (savedChange) => { confirmedDaysRef.current = cloneWeekDays(savedChange.days); setSaveError(null); setMessage("Uloženo"); },
    (error) => { setDays(cloneWeekDays(confirmedDaysRef.current)); setSaveError(error); setMessage(error); },
  ); return () => { saveQueueRef.current = null; }; }, []);
  useEffect(() => { const media = window.matchMedia("(max-width: 1023px)"); const update = () => setCompact(isCompactViewport(window.innerWidth)); const frame = window.requestAnimationFrame(() => { update(); setMounted(true); }); media.addEventListener("change", update); return () => { window.cancelAnimationFrame(frame); media.removeEventListener("change", update); }; }, []);
  useEffect(() => {
    if (data.weekKey !== requestedWeekRef.current || data.weekKey === hydratedWeekRef.current) return;
    hydratedWeekRef.current = data.weekKey;
    contextRef.current = { area: data.area, weekKey: data.weekKey };
    const nextDays = cloneWeekDays(data.days);
    confirmedDaysRef.current = nextDays;
    setDays(cloneWeekDays(nextDays));
    setOpenWeekStart(data.weekKey);
    setSaveError(null);
    setIsWeekLoading(false);
    calendarRef.current?.getApi().gotoDate(requestedDateRef.current);
  }, [data]);
  useEffect(() => { const frame = window.requestAnimationFrame(() => setActiveView(getPlannerLabDefaultView(compact))); return () => window.cancelAnimationFrame(frame); }, [compact]);

  const events = useMemo(() => plannerWeekToFullCalendarEvents(data, days), [data, days]);
  const canEdit = !isWeekLoading && !saveError; const canNavigate = !isSaving && !isWeekLoading;
  function getCalendarScroller() { return [...(calendarContainerRef.current?.querySelectorAll<HTMLElement>("*") ?? [])].find((element) => { const overflowY = window.getComputedStyle(element).overflowY; return (overflowY === "auto" || overflowY === "scroll") && element.scrollHeight > element.clientHeight; }); }
  function rememberScrollPosition() { if (!compact) return; const scroller = getCalendarScroller(); scrollPositionRef.current = { pageX: window.scrollX, pageY: window.scrollY, calendarY: scroller?.scrollTop ?? 0 }; }
  function restoreScrollPosition() { const position = scrollPositionRef.current; if (!position) return; window.requestAnimationFrame(() => window.requestAnimationFrame(() => { const scroller = getCalendarScroller(); window.scrollTo({ left: position.pageX, top: position.pageY, behavior: "auto" }); if (scroller) scroller.scrollTop = position.calendarY; scrollPositionRef.current = null; })); }
  function selectAllow(info: { start: Date; end: Date }) { if (!canEdit) return false; const day = days.find((item) => item.dateKey === formatDateKey(info.start)); if (!day) return false; const startCell = dateToCellIndex(info.start); const endCell = dateToCellIndex(info.end); return endCell > startCell && !hasBlockedCells(day, startCell, endCell); }
  function saveAvailabilityChange(nextDays: PlannerDay[], dateKey: string, startCell: number, endCell: number, nextMode: "add" | "remove") { setDays(nextDays); restoreScrollPosition(); setMessage("Ukládám…"); saveQueueRef.current?.enqueue({ days: cloneWeekDays(nextDays), dateKey, startCell, endCell, mode: nextMode }); }
  function updateAvailabilityRange(dateKey: string, startCell: number, endCell: number, shouldAdd: boolean, shouldRememberScroll = true) {
    if (!canEdit) return;
    const recent = recentCellMutationRef.current;
    if (recent && recent.dateKey === dateKey && recent.startCell === startCell && recent.endCell === endCell && recent.expiresAt > Date.now()) return;
    const day = days.find((item) => item.dateKey === dateKey);
    if (!day || endCell <= startCell || hasBlockedCells(day, startCell, endCell)) { setMessage("Rezervace, úklid a chráněné intervaly nelze upravit."); return; }
    if (!shouldAdd && !day.cells.available.slice(startCell, endCell).some(Boolean)) { setMessage("V označeném čase není dostupnost k odebrání."); return; }
    recentCellMutationRef.current = { dateKey, startCell, endCell, expiresAt: Date.now() + 400 };
    if (shouldRememberScroll) rememberScrollPosition();
    const cells = [...day.cells.available]; for (let cell = startCell; cell < endCell; cell += 1) cells[cell] = shouldAdd;
    const nextDays = days.map((item) => item.dateKey === dateKey ? patchDayAvailableIntervals(item, buildIntervalsFromCells(cells)) : item);
    saveAvailabilityChange(nextDays, dateKey, startCell, endCell, shouldAdd ? "add" : "remove");
  }
  function shouldAddRange(dateKey: string, startCell: number, endCell: number) { const day = days.find((item) => item.dateKey === dateKey); return !day?.cells.available.slice(startCell, endCell).some(Boolean); }
  function handleSelect(info: DateSelectInfo) { const dateKey = formatDateKey(info.start); const startCell = dateToCellIndex(info.start); const endCell = dateToCellIndex(info.end); rememberScrollPosition(); info.view.calendar.unselect(); updateAvailabilityRange(dateKey, startCell, endCell, shouldAddRange(dateKey, startCell, endCell), false); }
  function handleDateClick(info: DateClickInfo) { const dateKey = formatDateKey(info.date); const cell = dateToCellIndex(info.date); updateAvailabilityRange(dateKey, cell, cell + 1, shouldAddRange(dateKey, cell, cell + 1)); }
  function requestWeek(nextWeekStart: string, focusDate = nextWeekStart) { if (!canNavigate) return; if (nextWeekStart === requestedWeekRef.current) { requestedDateRef.current = focusDate; calendarRef.current?.getApi().gotoDate(focusDate); return; } requestedWeekRef.current = nextWeekStart; requestedDateRef.current = focusDate; setIsWeekLoading(true); setOpenWeekStart(nextWeekStart); calendarRef.current?.getApi().gotoDate(focusDate); router.replace(`/admin/volne-terminy/lab?week=${nextWeekStart}&day=${focusDate}`, { scroll: false }); }
  function handleDatesSet(info: DatesSetInfo) { const nextWeekStart = getPlannerLabWeekStart(info.view.currentStart); setOpenWeekStart(nextWeekStart); if (nextWeekStart !== requestedWeekRef.current && canNavigate) requestWeek(nextWeekStart); }
  function changeView(view: PlannerLabView) { if (!canNavigate) return; setActiveView(view); const date = view === "timeGridWeekend" ? formatDateKey(addDays(getDayBounds(openWeekStart).startsAt, 5)) : openWeekStart; calendarRef.current?.getApi().changeView(view, date); }
  const initialView = getPlannerLabDefaultView(compact);
  const status = isWeekLoading ? "Načítám týden…" : isSaving ? "Ukládám…" : saveError ?? message;
  const viewChoices = compact
    ? ([['timeGridDay', 'Den'], ['timeGridWorkWeek', 'Po–Pá'], ['timeGridWeekend', 'Víkend']] as const)
    : ([['timeGridWorkWeek', 'Po–Pá'], ['timeGridWeek', 'Celý týden']] as const);
  return <div className={styles.planner}>
    <div className={styles.controls}><span className={styles.weekRange}>{formatWeekRange(openWeekStart)}</span><div className={styles.navigation} aria-label="Navigace týdne"><button type="button" className={styles.controlButton} onClick={() => requestWeek(movePlannerLabWeek(openWeekStart, -1))} aria-label="Předchozí týden" disabled={!canNavigate}>←</button><button type="button" className={styles.controlButton} onClick={() => { const today = formatDateKey(new Date()); requestWeek(getPlannerLabWeekStart(new Date()), today); }} disabled={!canNavigate}>Dnes</button><button type="button" className={styles.controlButton} onClick={() => requestWeek(movePlannerLabWeek(openWeekStart, 1))} aria-label="Následující týden" disabled={!canNavigate}>→</button></div><div className={styles.viewSwitch} aria-label="Pohled kalendáře">{viewChoices.map(([view, label]) => <button key={view} type="button" className={`${styles.viewButton} ${activeView === view ? styles.viewButtonActive : ""}`} onClick={() => changeView(view)} disabled={!canNavigate} aria-pressed={activeView === view}>{label}</button>)}</div>{status ? <div className={styles.status} role="status"><span>{status}</span>{saveError ? <button type="button" onClick={() => { setSaveError(null); setMessage("Uloženo"); }} className={styles.retryButton}>Zkusit znovu</button> : null}</div> : null}</div>
    <div ref={calendarContainerRef} className={`${styles.calendar} ${activeView === "timeGridWorkWeek" ? styles.workWeek : ""}`} data-testid="planner-lab-calendar">{mounted ? <FullCalendar key={compact ? "compact" : "desktop"} ref={calendarRef} plugins={[themePlugin, timeGridPlugin, interactionPlugin]} locales={[csLocale]} locale="cs" colorScheme="dark" initialView={initialView} initialDate={weekStart} firstDay={1} timeZone="Europe/Prague" events={events} selectable={canEdit} selectMirror={compact} longPressDelay={compact ? 250 : undefined} selectLongPressDelay={compact ? 250 : undefined} selectAllow={selectAllow} select={handleSelect} dateClick={handleDateClick} datesSet={handleDatesSet} editable={false} eventStartEditable={false} eventDurationEditable={false} allDaySlot={false} slotMinTime="06:00:00" slotMaxTime="20:00:00" slotDuration="00:30:00" snapDuration="00:30:00" scrollTimeReset={false} height="100%" expandRows nowIndicator weekends slotEventOverlap={false} eventMinHeight={0} eventShortHeight={0} views={{ timeGridWorkWeek: { type: "timeGrid", duration: { days: 5 } }, timeGridWeekend: { type: "timeGrid", duration: { days: 2 } }}} eventContent={(arg) => { const details = arg.event.extendedProps as { type: PlannerLabEventType; clientName?: string; serviceName?: string }; if (details.type === "availability" || details.type === "protected") return null; if (details.type === "cleanup") return <span className={styles.cleanupEvent}><b>{arg.timeText}</b><span>Úklid</span></span>; const eventLabel = details.clientName || arg.event.title || (details.type === "booking" ? "Rezervace" : details.type === "completed" ? "Dokončeno" : "Blokováno"); const durationMinutes = arg.event.start && arg.event.end ? (arg.event.end.getTime() - arg.event.start.getTime()) / 60_000 : 0; if (arg.isShort || arg.isNarrow || durationMinutes < 45) return <span className={styles.eventShort}><b>{arg.timeText}</b><span>{eventLabel}</span></span>; if (durationMinutes < 90) return <span className={styles.eventMedium}><b>{arg.timeText}</b><span>{eventLabel}</span></span>; return <span className={styles.eventLong}><b>{arg.timeText}</b><span>{eventLabel}</span><span className={styles.eventService}>{details.serviceName}</span></span>; }} /> : <div className="h-full animate-pulse bg-white/[.04]" />}</div>
  </div>;
}
