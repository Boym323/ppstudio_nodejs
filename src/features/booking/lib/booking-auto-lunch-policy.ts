import type { DayLunchMode } from "./booking-schedule-optimization";

export const CURRENT_AUTO_LUNCH_CONFIGURATION = {
  globalAutoLunchEnabled: true,
  dayLunchModes: {} as Record<string, DayLunchMode>,
};

export function getCurrentDayLunchMode(localDate: string): DayLunchMode {
  return CURRENT_AUTO_LUNCH_CONFIGURATION.dayLunchModes[localDate] ?? "AUTO";
}
