import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateEasterSundayDateKey,
} from "./czech-public-holidays";
import { getPlannerCalendarContext } from "./calendar-context";

test("české svátky označí pevná data a nezahrnou běžný významný den", () => {
  assert.equal(getPlannerCalendarContext("2026-09-28").publicHoliday?.name, "Den české státnosti");
  assert.equal(getPlannerCalendarContext("2026-10-28").publicHoliday?.name, "Den vzniku samostatného československého státu");
  assert.equal(getPlannerCalendarContext("2026-12-24").publicHoliday?.name, "Štědrý den");
  assert.equal(getPlannerCalendarContext("2026-03-08").publicHoliday, null);
});

test("výpočet Velikonoc je deterministický a vrací oba související svátky", () => {
  assert.equal(calculateEasterSundayDateKey(2026), "2026-04-05");
  assert.equal(getPlannerCalendarContext("2026-04-03").publicHoliday?.name, "Velký pátek");
  assert.equal(getPlannerCalendarContext("2026-04-06").publicHoliday?.name, "Velikonoční pondělí");
});

test("jarní prázdniny okresu Zlín mají správné hranice", () => {
  assert.equal(getPlannerCalendarContext("2027-03-08").schoolHoliday?.name, "Jarní prázdniny");
  assert.equal(getPlannerCalendarContext("2027-03-14").schoolHoliday?.name, "Jarní prázdniny");
  assert.equal(getPlannerCalendarContext("2027-03-15").schoolHoliday, null);
  assert.equal(getPlannerCalendarContext("2028-02-07").schoolHoliday?.name, "Jarní prázdniny");
  assert.equal(getPlannerCalendarContext("2028-02-13").schoolHoliday?.name, "Jarní prázdniny");
});

test("podzimní prázdniny 2027 respektují státní svátek 28. října", () => {
  assert.equal(getPlannerCalendarContext("2027-10-27").schoolHoliday?.name, "Podzimní prázdniny");
  assert.deepEqual(getPlannerCalendarContext("2027-10-28"), {
    publicHoliday: { name: "Den vzniku samostatného československého státu" },
    schoolHoliday: null,
  });
  assert.equal(getPlannerCalendarContext("2027-10-29").schoolHoliday?.name, "Podzimní prázdniny");
});

test("resolver zachová oba kontexty při překryvu svátku a prázdnin", () => {
  assert.deepEqual(getPlannerCalendarContext("2027-12-24"), {
    publicHoliday: { name: "Štědrý den" },
    schoolHoliday: { name: "Vánoční prázdniny" },
  });
});
