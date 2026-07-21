import assert from "node:assert/strict";
import test from "node:test";

import { getPlannerLabDefaultView, getPlannerLabWeekStart, isPlannerLabMobileViewport, movePlannerLabWeek, type PlannerLabView } from "./planner-lab-week";

test("otevřený týden je vždy pondělí, i když FullCalendar vrátí neděli", () => {
  assert.equal(getPlannerLabWeekStart(new Date("2026-07-19T10:00:00.000Z")), "2026-07-13");
});

test("navigace týdne drží přesné pondělní klíče", () => {
  assert.equal(movePlannerLabWeek("2026-07-13", 1), "2026-07-20");
  assert.equal(movePlannerLabWeek("2026-07-13", -1), "2026-07-06");
});

test("desktop včetně 1024 px používá pracovní týden a telefon jeden den", () => {
  assert.equal(isPlannerLabMobileViewport(1024), false);
  assert.equal(getPlannerLabDefaultView(false), "timeGridWorkWeek");
  assert.equal(getPlannerLabDefaultView(true), "timeGridDay");
});

test("mobilní pohledy obsahují samostatný víkend místo namačkaného týdne", () => {
  const views: PlannerLabView[] = ["timeGridDay", "timeGridWorkWeek", "timeGridWeekend"];
  assert.deepEqual(views, ["timeGridDay", "timeGridWorkWeek", "timeGridWeekend"]);
});
