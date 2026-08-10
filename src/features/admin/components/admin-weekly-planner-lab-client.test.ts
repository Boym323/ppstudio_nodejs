import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const clientPath = new URL("./admin-weekly-planner-lab-client.tsx", import.meta.url);

async function clientSource() {
  return readFile(clientPath, "utf8");
}

test("planner začíná v bezpečném režimu prohlížení a změny vyžadují explicitní režim", async () => {
  const source = await clientSource();
  assert.match(source, /useState<PlannerMode>\("view"\)/);
  assert.match(source, /selectable=\{canEdit && mode !== "view"\}/);
  assert.match(source, /mode !== "view" && start && end/);
  assert.match(source, /aria-pressed=\{mode === item\}/);
  assert.match(source, /Přidat termín/);
  assert.match(source, /Odebrat termín/);
  assert.doesNotMatch(source, /function shouldAddRange/);
});

test("planner ukládá undo přes opačnou serverovou operaci a hlásí autosave", async () => {
  const source = await clientSource();
  assert.match(source, /function undoLastChange/);
  assert.match(source, /const reverseMode = undoChange\.mode === "add" \? "remove" : "add"/);
  assert.match(source, /recentCellMutationRef\.current = null; updateAvailabilityRange\(undoChange\.dateKey/);
  assert.match(source, /applyPlannerSelectionAction/);
  assert.match(source, />Vrátit změnu</);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /setMessage\("Ukládám…"\)/);
  assert.doesNotMatch(source, /Publikovat změny|Zahodit koncept|localStorage/);
});

test("autosave používá neměnný kontext položky fronty i při retry", async () => {
  const source = await clientSource();
  assert.match(source, /type PlannerChange = Readonly<\{ area: PlannerWeekData\["area"\]; weekKey: string; operationId: string;/);
  assert.match(source, /import \{ createIdempotencyKey \} from "@\/lib\/idempotency-key"/);
  assert.match(source, /Object\.freeze\(\{ area: data\.area, weekKey: data\.weekKey, operationId: createIdempotencyKey\(\)/);
  assert.match(source, /applyPlannerSelectionAction\(change\.area, \{ weekKey: change\.weekKey, dateKey: change\.dateKey, startCell: change\.startCell, endCell: change\.endCell, mode: change\.mode, operationId: change\.operationId/);
  assert.doesNotMatch(source, /contextRef/);
});

test("navigace čeká na prázdnou frontu a vyřešenou chybu", async () => {
  const source = await clientSource();
  assert.match(source, /const canNavigate = !isSaving && !isWeekLoading && !saveError && !hasPendingChanges/);
  assert.match(source, /Nejdřív zopakujte změnu nebo obnovte uložený stav\./);
  assert.match(source, /nextWeekStart !== requestedWeekRef\.current && !canNavigate/);
  assert.match(source, /gotoDate\(requestedDateRef\.current\)/);
});

test("obnova uloženého stavu zahodí frontu a znovu načte potvrzená data", async () => {
  const source = await clientSource();
  assert.match(source, /function requestRestoreSavedState\(\).*pendingCount/);
  assert.match(source, /discardPending\(\); setHasPendingChanges\(false\)/);
  assert.match(source, /setIsWeekLoading\(true\); restoreRequestedRef\.current = true; router\.refresh\(\)/);
  assert.match(source, /import \* as AlertDialog from "@\/components\/ui\/alert-dialog"/);
  assert.match(source, /<AlertDialog\.Title>Zahodit neuložené změny\?<\/AlertDialog\.Title>/);
  assert.match(source, /<AlertDialog\.Cancel asChild><button ref=\{restoreCancelRef\}/);
  assert.match(source, /onOpenAutoFocus=\{\(event\) => \{ event\.preventDefault\(\); restoreCancelRef\.current\?\.focus\(\); \}\}/);
  assert.doesNotMatch(source, /window\.confirm\(/);
});

test("planner má legendu a sdílené routování rezervace bez paralelního inspektoru", async () => {
  const source = await clientSource();
  assert.match(source, /Legenda kalendáře/);
  assert.match(source, /Čeká na potvrzení/);
  assert.match(source, /Potvrzená rezervace/);
  assert.match(source, /Neuložený stav/);
  assert.match(source, /Chyba ukládání/);
  assert.doesNotMatch(source, /Inspektor dne|Vytvořit rezervaci/);
  assert.match(source, /getPlannerBookingHref\(data\.area, details\.bookingId\)/);
  assert.match(source, /eventClick=\{handleEventClick\}/);
  assert.match(source, /aria-label", label/);
});

test("obsazený termín zobrazuje službu pod jménem klientky", async () => {
  const source = await clientSource();
  assert.match(source, /className=\{styles\.eventMedium\}/);
  assert.match(source, /className=\{styles\.eventTitle\}><b>\{arg\.timeText\}<\/b>/);
  assert.match(source, /details\.clientName \?\? "Klientka"/);
  assert.match(
    source,
    /className=\{styles\.eventService\}>\{details\.serviceName \?\? "Služba"\}/,
  );
});

test("planner zachová přístupné ovládání režimů bez inspektoru", async () => {
  const source = await clientSource();
  assert.match(source, /aria-pressed=\{mode === item\}/);
  assert.doesNotMatch(source, /selectedDayKey|applyInspectorRange/);
  const styles = await readFile(new URL("./planner-lab.module.css", import.meta.url), "utf8");
  assert.match(styles, /focus-visible/);
});

test("kompaktní pohled nabízí Den, Po–Pá a Víkend a zachová mobilní scroll", async () => {
  const source = await clientSource();
  assert.match(source, /\['timeGridDay', 'Den'\], \['timeGridWorkWeek', 'Po–Pá'\], \['timeGridWeekend', 'Víkend'\]/);
  assert.match(source, /longPressDelay=\{compact \? 450/);
  assert.match(source, /calendar\.changeView\(nextView, targetDate\)/);
  assert.match(source, /if \(calendar\.view\.type === nextView\) \{ calendar\.gotoDate\(targetDate\); return; \}/);
  assert.match(source, /function rememberScrollPosition/);
  assert.match(source, /scrollTimeReset=\{false\}/);
  assert.doesNotMatch(source, /key=\{compact \? "compact" : "desktop"\}/);
});

test("výběr buněk zachová lokální čas FullCalendaru i po změně letního času", async () => {
  const source = await clientSource();
  assert.match(source, /function getCalendarCellPosition\(dateTime: string\)/);
  assert.match(source, /getCalendarCellPosition\(info\.startStr\)/);
  assert.match(source, /getCalendarCellPosition\(info\.endStr\)/);
  assert.match(source, /function getCalendarClickPosition\(info: DateClickInfo\)/);
  assert.match(source, /info\.dayEl\.dataset\.date/);
  assert.match(source, /getCalendarCellPosition\(info\.dateStr\)/);
  assert.match(source, /closest<HTMLElement>\("\[data-time\]"\)/);
  assert.doesNotMatch(source, /document\.elementsFromPoint/);
  assert.match(source, /getCalendarClickPosition\(info\)/);
  assert.match(source, /!Number\.isInteger\(position\.cell\).*Math\.floor\(position\.cell\)/);
});
