import type { PlannerDay, PlannerWeekData } from "@/features/admin/lib/admin-slots";
import { getCellRangeBounds } from "@/features/admin/lib/admin-slots/time";

export type PlannerLabEventType =
  | "availability"
  | "booking"
  | "cleanup"
  | "protected"
  | "completed";

export type PlannerLabEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  editable: false;
  interactive?: boolean;
  display: "background" | "block";
  color: string;
  classNames: string[];
  extendedProps: { type: PlannerLabEventType; editable: boolean; dateKey: string; startCell: number; endCell: number; clientName?: string; serviceName?: string };
};

function toIsoRange(dateKey: string, startCell: number, endCell: number) {
  const range = getCellRangeBounds(dateKey, startCell, endCell);
  return { start: range.startsAt.toISOString(), end: range.endsAt.toISOString() };
}

/** Převádí aktuální stav týdne na neměnné FullCalendar eventy. */
export function plannerWeekToFullCalendarEvents(
  week: PlannerWeekData,
  workingDays: PlannerDay[] = week.days,
): PlannerLabEvent[] {
  return workingDays.flatMap((day) => {
    const availability = day.availableIntervals.map((interval, index) => ({
      id: `availability:${day.dateKey}:${index}:${interval.startCell}-${interval.endCell}`,
      title: "",
      ...toIsoRange(day.dateKey, interval.startCell, interval.endCell),
      editable: false as const,
      interactive: true,
      display: "background" as const,
      color: "#4ecf9b",
      classNames: ["planner-lab-event--availability"],
      extendedProps: { type: "availability" as const, editable: true, dateKey: day.dateKey, startCell: interval.startCell, endCell: interval.endCell },
    }));
    const protectedIntervals = day.intervals
      .filter((interval) => interval.status === "locked" || interval.status === "inactive")
      .map((interval) => ({
        id: `protected:${day.dateKey}:${interval.id}`,
        title: interval.status === "inactive" ? "Neaktivní interval" : "Chráněný interval",
        ...toIsoRange(day.dateKey, interval.startCell, interval.endCell),
        editable: false as const,
        display: "background" as const,
        color: "#8b96a8",
        classNames: ["planner-lab-event--protected"],
        extendedProps: { type: "protected" as const, editable: false, dateKey: day.dateKey, startCell: interval.startCell, endCell: interval.endCell },
      }));
    const bookings = day.bookings.map((booking) => {
      const serviceStartCell = booking.serviceStartMinutes / 30;
      const serviceEndCell = booking.serviceEndMinutes / 30;

      return {
        id: `booking:${day.dateKey}:${booking.id}`,
        title: `${booking.serviceName} · ${booking.clientName}`,
        ...toIsoRange(day.dateKey, serviceStartCell, serviceEndCell),
        editable: false as const,
        display: "block" as const,
        color: booking.status === "COMPLETED" ? "#64748b" : "#ee7890",
        classNames: [booking.status === "COMPLETED" ? "planner-lab-event--completed" : "planner-lab-event--booking"],
        extendedProps: {
          type: (booking.status === "COMPLETED" ? "completed" : "booking") as "booking" | "completed",
          editable: false,
          dateKey: day.dateKey,
          startCell: serviceStartCell,
          endCell: serviceEndCell,
          clientName: booking.clientName,
          serviceName: booking.serviceName,
        },
      };
    });
    const cleanup = day.cleanupBlocks.map((block, index) => ({
      id: `cleanup:${day.dateKey}:${index}:${block.startMinutes}-${block.endMinutes}`,
      title: "Úklid",
      ...toIsoRange(day.dateKey, block.startMinutes / 30, block.endMinutes / 30),
      editable: false as const,
      display: "block" as const,
      color: "#d6a64e",
      classNames: ["planner-lab-event--cleanup"],
      extendedProps: { type: "cleanup" as const, editable: false, dateKey: day.dateKey, startCell: block.startMinutes / 30, endCell: block.endMinutes / 30 },
    }));

    return [...availability, ...protectedIntervals, ...bookings, ...cleanup];
  });
}
