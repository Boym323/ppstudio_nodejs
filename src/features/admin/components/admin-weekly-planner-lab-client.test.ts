import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const clientPath = new URL("./admin-weekly-planner-lab-client.tsx", import.meta.url);

async function clientSource() {
  return readFile(clientPath, "utf8");
}

test("produkční planner automaticky přidává do prázdných buněk a odebírá ze zelených intervalů", async () => {
  const source = await clientSource();
  assert.match(source, /dateClick=\{handleDateClick\}/);
  assert.match(source, /setMessage\("Ukládám…"\)/);
  assert.doesNotMatch(source, /Publikovat změny|Zahodit koncept|localStorage/);
  assert.match(source, /dateClick=\{handleDateClick\}/);
  assert.match(source, /applyPlannerSelectionAction/);
  assert.match(source, /function shouldAddRange/);
  assert.match(source, /!day\?\.cells\.available\.slice\(startCell, endCell\)\.some\(Boolean\)/);
  assert.match(source, /recentCellMutationRef\.current/);
  assert.match(source, /recent\.dateKey === dateKey && recent\.startCell === startCell/);
  assert.doesNotMatch(source, /eventClick=|EventClickInfo|availabilityEventClick/);
  assert.doesNotMatch(source, /syncPlannerWeekDraftAction/);
  assert.doesNotMatch(source, />Přidat</);
  assert.doesNotMatch(source, />Odebrat</);
  assert.match(source, /const canEdit = !isWeekLoading && !saveError/);
  assert.match(source, /function retrySave\(\) \{ setSaveError\(null\); setMessage\("Ukládám…"\); saveQueueRef\.current\?\.retry\(\); \}/);
  assert.match(source, />Zkusit znovu</);
  assert.match(source, /function restoreSavedState\(\) \{ saveQueueRef\.current\?\.discardPending\(\);/);
  assert.match(source, /restoreRequestedRef\.current = true; router\.refresh\(\);/);
  assert.match(source, />Obnovit uložený stav</);
});

test("produkční planner blokuje navigaci při ukládání a při změně týdne obnoví data kalendáře", async () => {
  const source = await clientSource();
  assert.match(source, /const canNavigate = !isSaving && !isWeekLoading/);
  assert.match(source, /const requestedDateRef = useRef\(effectiveInitialDate\)/);
  assert.match(source, /requestWeek\(getPlannerLabWeekStart\(new Date\(\)\), today\)/);
  assert.match(source, /calendarRef\.current\?\.getApi\(\)\.gotoDate\(focusDate\)/);
  assert.match(source, /setOpenWeekStart\(nextWeekStart\); calendarRef/);
  assert.match(source, /data\.weekKey !== requestedWeekRef\.current \|\| \(data\.weekKey === hydratedWeekRef\.current && !restoreRequestedRef\.current\)/);
  assert.match(source, /restoreRequestedRef\.current = false;/);
  assert.match(source, /routeBase: string/);
  assert.match(source, /router\.replace\(`\$\{routeBase\}\?week=/);
  assert.match(source, /isPlannerLabMobileViewport\(window\.innerWidth\)/);
  assert.match(source, /if \(activeView === "timeGridDay"\) \{/);
  assert.match(source, /requestWeek\(getPlannerLabWeekStart\(getDayBounds\(nextDate\)\.startsAt\), nextDate\)/);
  assert.match(source, /const nextWeekStart = movePlannerLabWeek\(openWeekStart, amount\)/);
  assert.match(source, /requestWeek\(nextWeekStart, focusDate\)/);
  assert.match(source, /const currentDate = calendarRef\.current\?\.getApi\(\)\.getDate\(\) \?\? info\.view\.currentStart/);
  assert.match(source, /const focusDate = formatDateKey\(currentDate\)/);
  assert.match(source, /calendar\.changeView\(nextView, requestedDateRef\.current\)/);
  assert.doesNotMatch(source, /dateAlignment="week"/);
});

test("produkční planner neobsahuje druhý workflow inspektoru dne", async () => {
  const source = await clientSource();
  assert.doesNotMatch(source, /\b(?:DayInspector|MobileInspectorSheet|PlannerSelection)\b/);
  assert.doesNotMatch(source, /isInspectorOpen|initialDayKey/);
});

test("kompaktní pohled nabízí Den, Po–Pá a Víkend místo sedmi sloupců", async () => {
  const source = await clientSource();
  assert.match(source, /\['timeGridDay', 'Den'\], \['timeGridWorkWeek', 'Po–Pá'\], \['timeGridWeekend', 'Víkend'\]/);
  assert.match(source, /styles\.workWeek/);
  assert.match(source, /timeGridWorkWeek: \{ type: "timeGrid", duration: \{ days: 5 \} \}/);
  assert.match(source, /timeGridWeekend: \{ type: "timeGrid", duration: \{ days: 2 \}/);
});

test("desktop začíná pracovním týdnem a dovoluje přepnout na celý týden", async () => {
  const source = await clientSource();
  assert.match(source, /\[\['timeGridWorkWeek', 'Po–Pá'\], \['timeGridWeek', 'Celý týden'\]\]/);
  assert.match(source, /height="100%" expandRows/);
  assert.match(source, /details\.type === "booking" \? "Rezervace"/);
});

test("úprava dostupnosti zachová pozici mobilního kalendáře", async () => {
  const source = await clientSource();
  assert.match(source, /function rememberScrollPosition/);
  assert.match(source, /function restoreScrollPosition/);
  assert.match(source, /function getCalendarScroller/);
  assert.match(source, /element\.scrollHeight > element\.clientHeight/);
  assert.match(source, /rememberScrollPosition\(\); info\.view\.calendar\.unselect\(\);/);
  assert.match(source, /restoreScrollPosition\(\);/);
  assert.match(source, /scrollTimeReset=\{false\}/);
});
