import { isValidDateKey } from "@/features/admin/lib/admin-slots/time";
import { getCzechPublicHoliday, type CzechHoliday } from "./czech-public-holidays";
import { SCHOOL_HOLIDAYS_2026_2027 } from "./school-holidays/2026-2027";
import { SCHOOL_HOLIDAYS_2027_2028 } from "./school-holidays/2027-2028";

export type SchoolHolidayPeriod = Readonly<{
  startDate: string;
  endDate: string;
  name: string;
}>;

export type PlannerCalendarContext = Readonly<{
  publicHoliday: Pick<CzechHoliday, "name"> | null;
  schoolHoliday: Pick<SchoolHolidayPeriod, "name"> | null;
}>;

export const MAIN_SCHOOL_HOLIDAY_NAME = "Hlavní prázdniny";

const SCHOOL_HOLIDAY_PERIODS: readonly SchoolHolidayPeriod[] = [
  ...SCHOOL_HOLIDAYS_2026_2027,
  ...SCHOOL_HOLIDAYS_2027_2028,
];

const EMPTY_CONTEXT: PlannerCalendarContext = {
  publicHoliday: null,
  schoolHoliday: null,
};

function getSchoolHoliday(dateKey: string) {
  const period = SCHOOL_HOLIDAY_PERIODS.find(
    (item) => dateKey >= item.startDate && dateKey <= item.endDate,
  );

  return period ? { name: period.name } : null;
}

/**
 * Read-only kontext pro administrativní Planner.
 * Resolver je čistý, deterministický a neprovádí síťové ani databázové operace.
 */
export function getPlannerCalendarContext(dateKey: string): PlannerCalendarContext {
  if (!isValidDateKey(dateKey)) {
    return EMPTY_CONTEXT;
  }

  const publicHoliday = getCzechPublicHoliday(dateKey);
  return {
    publicHoliday: publicHoliday ? { name: publicHoliday.name } : null,
    schoolHoliday: getSchoolHoliday(dateKey),
  };
}
