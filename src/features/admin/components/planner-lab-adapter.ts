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
  className: string;
  extendedProps: { type: PlannerLabEventType; editable: boolean; dateKey: string; startCell: number; endCell: number; clientName?: string; serviceName?: string };
};

function toIsoRange(dateKey: string, startCell: number, endCell: number) {
  const range = getCellRangeBounds(dateKey, startCell, endCell);
  return { start: range.startsAt.toISOString(), end: range.endsAt.toISOString() };
}

function subtractCleanup(
  interval: { startCell: number; endCell: number },
  cleanupBlocks: Array<{ startMinutes: number; endMinutes: number }>,
) {
  return cleanupBlocks.reduce(
    (remaining, cleanup) => remaining.flatMap((range) => {
      const cleanupStart = cleanup.startMinutes / 30;
      const cleanupEnd = cleanup.endMinutes / 30;

      if (cleanupEnd <= range.startCell || cleanupStart >= range.endCell) {
        return [range];
      }

      return [
        cleanupStart > range.startCell
          ? { startCell: range.startCell, endCell: Math.min(cleanupStart, range.endCell) }
          : null,
        cleanupEnd < range.endCell
          ? { startCell: Math.max(cleanupEnd, range.startCell), endCell: range.endCell }
          : null,
      ].filter((part): part is { startCell: number; endCell: number } => part !== null && part.endCell > part.startCell);
    }),
    [interval],
  );
}

/** Převádí aktuální stav týdne na neměnné FullCalendar eventy. */
export function plannerWeekToFullCalendarEvents(
  week: PlannerWeekData,
  workingDays: PlannerDay[] = week.days,
): PlannerLabEvent[] {
  return workingDays.flatMap((day) => {
    const availability = (day.displayAvailableIntervals ?? day.availableIntervals).map((interval, index) => ({
      id: `availability:${day.dateKey}:${index}:${interval.startCell}-${interval.endCell}`,
      title: "Volný termín",
      ...toIsoRange(day.dateKey, interval.startCell, interval.endCell),
      editable: false as const,
      interactive: true,
      display: "background" as const,
      color: "#4ecf9b",
      className: "planner-lab-event--availability",
      extendedProps: { type: "availability" as const, editable: true, dateKey: day.dateKey, startCell: interval.startCell, endCell: interval.endCell },
    }));
    const protectedCandidates = day.lockedBlocks.length > 0
      ? day.lockedBlocks.map((interval, index) => ({
        id: `protected:${day.dateKey}:locked-${index}`,
        title: "Chráněný interval",
        startCell: interval.startMinutes / 30,
        endCell: interval.endMinutes / 30,
      }))
      : day.intervals
        .filter((interval) => interval.status === "locked" || interval.status === "inactive")
        .map((interval) => ({
          id: `protected:${day.dateKey}:${interval.id}`,
          title: interval.status === "inactive" ? "Neaktivní interval" : "Chráněný interval",
          startCell: interval.startCell,
          endCell: interval.endCell,
        }));
    const protectedIntervals = protectedCandidates.flatMap((interval) =>
      subtractCleanup(interval, day.cleanupBlocks).map((range, index) => ({
        id: `${interval.id}:${index}`,
        title: interval.title,
        ...toIsoRange(day.dateKey, range.startCell, range.endCell),
        editable: false as const,
        display: "background" as const,
        color: "#8b96a8",
        className: "planner-lab-event--protected",
        extendedProps: { type: "protected" as const, editable: false, dateKey: day.dateKey, startCell: range.startCell, endCell: range.endCell },
      })),
    );
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
        className: booking.status === "COMPLETED" ? "planner-lab-event--completed" : "planner-lab-event--booking",
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
      className: "planner-lab-event--cleanup",
      extendedProps: { type: "cleanup" as const, editable: false, dateKey: day.dateKey, startCell: block.startMinutes / 30, endCell: block.endMinutes / 30 },
    }));

    return [...availability, ...protectedIntervals, ...bookings, ...cleanup];
  });
}
