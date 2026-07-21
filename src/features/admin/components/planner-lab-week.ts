import { addDays, formatDateKey, getDayBounds, resolveWeekStart } from "@/features/admin/lib/admin-slots/time";

export type PlannerLabView = "timeGridDay" | "timeGridWorkWeek" | "timeGridWeekend" | "timeGridWeek";

export function getPlannerLabWeekStart(date: Date) {
  return formatDateKey(resolveWeekStart(formatDateKey(date)));
}

export function movePlannerLabWeek(weekStart: string, amount: number) {
  return formatDateKey(addDays(getDayBounds(weekStart).startsAt, amount * 7));
}

export function isPlannerLabMobileViewport(width: number) {
  return width < 640;
}

export function getPlannerLabDefaultView(mobile: boolean): PlannerLabView {
  return mobile ? "timeGridDay" : "timeGridWorkWeek";
}
