import { BookingStatus } from "@prisma/client";

import { type AdminArea } from "@/config/navigation";

export type TimeRange = {
  startsAt: Date;
  endsAt: Date;
};

export type PlannerInterval = {
  id: string;
  startCell: number;
  endCell: number;
  label: string;
  status: "available" | "booked" | "inactive" | "locked";
  bookingCount: number;
  canEdit: boolean;
  detail: string;
};

export type PlannerBooking = {
  id: string;
  slotId: string;
  startCell: number;
  endCell: number;
  label: string;
  clientName: string;
  serviceName: string;
  status: BookingStatus;
};

export type PlannerDay = {
  dateKey: string;
  isoDate: string;
  label: string;
  shortLabel: string;
  dayNumber: string;
  monthLabel: string;
  monthDayLabel: string;
  isToday: boolean;
  isPast: boolean;
  availableIntervals: Array<{ startCell: number; endCell: number; label: string }>;
  lockedIntervals: Array<{ startCell: number; endCell: number; label: string }>;
  bookings: PlannerBooking[];
  intervals: PlannerInterval[];
  cells: {
    available: boolean[];
    booked: boolean[];
    inactive: boolean[];
    locked: boolean[];
    past: boolean[];
  };
  summary: {
    availableLabel: string;
    bookingLabel: string;
    note: string;
  };
};

export type PlannerWeekData = {
  area: AdminArea;
  baseHref: string;
  title: string;
  subtitle: string;
  weekKey: string;
  previousWeekKey: string;
  nextWeekKey: string;
  weekRangeLabel: string;
  todayKey: string;
  days: PlannerDay[];
  legend: Array<{ tone: PlannerInterval["status"] | "past"; label: string }>;
};

export type PlannerMutationResult = {
  ok: boolean;
  message: string;
  weekKey: string;
};

export type WeeklyTemplateInput = Array<{
  weekday: number;
  intervals: Array<{
    startCell: number;
    endCell: number;
  }>;
}>;

export type WeeklyDraftInput = Array<{
  dateKey: string;
  intervals: Array<{
    startCell: number;
    endCell: number;
  }>;
}>;

export class PlannerMutationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlannerMutationError";
  }
}
