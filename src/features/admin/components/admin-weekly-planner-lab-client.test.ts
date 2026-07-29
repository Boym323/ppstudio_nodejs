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
  assert.match(source, /if \(mode !== "view"\) updateAvailabilityRange/);
  assert.match(source, /aria-pressed=\{mode === item\}/);
  assert.match(source, /Přidat termín/);
  assert.match(source, /Odebrat termín/);
  assert.doesNotMatch(source, /function shouldAddRange/);
});

test("planner ukládá undo přes opačnou serverovou operaci a hlásí autosave", async () => {
  const source = await clientSource();
  assert.match(source, /function undoLastChange/);
  assert.match(source, /const reverseMode = undoChange\.mode === "add" \? "remove" : "add"/);
  assert.match(source, /applyPlannerSelectionAction/);
  assert.match(source, />Vrátit změnu</);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /setMessage\("Ukládám…"\)/);
  assert.doesNotMatch(source, /Publikovat změny|Zahodit koncept|localStorage/);
});

test("planner má legendu a sdílené routování rezervace bez paralelního inspektoru", async () => {
  const source = await clientSource();
  assert.match(source, /Legenda kalendáře/);
  assert.match(source, /Neuložený stav/);
  assert.match(source, /Chyba ukládání/);
  assert.doesNotMatch(source, /Inspektor dne|Vytvořit rezervaci/);
  assert.match(source, /getPlannerBookingHref\(data\.area, details\.bookingId\)/);
  assert.match(source, /eventClick=\{handleEventClick\}/);
  assert.match(source, /aria-label", label/);
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
  assert.match(source, /calendar\?\.changeView\(nextView, targetDate\)/);
  assert.match(source, /function rememberScrollPosition/);
  assert.match(source, /scrollTimeReset=\{false\}/);
});
