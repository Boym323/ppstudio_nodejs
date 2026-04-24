import {
  AvailabilitySlotStatus,
  BookingStatus,
} from "@prisma/client";

import { type AdminArea } from "@/config/navigation";
import { prisma } from "@/lib/prisma";

import {
  addDays,
  dateLabelFormatter,
  dayNumberFormatter,
  formatDateKey,
  getDayBounds,
  monthDayFormatter,
  monthOnlyFormatter,
  monthTitleFormatter,
  resolveWeekStart,
  weekdayLongFormatter,
  weekdayShortFormatter,
} from "./time";
import {
  buildCellsMap,
  clampIntervalToDay,
  formatTimeRange,
  getAreaSubtitle,
  getAreaTitle,
  getBaseHref,
  getSummaryNote,
  intervalToCellRange,
  isEditablePlannerSlot,
  isSameDateKey,
  mergeIntervals,
  subtractIntervals,
  EDITABLE_SLOT_CAPACITY,
} from "./helpers";
import {
  dateToCellIndex,
} from "./time";
import {
  type PlannerBooking,
  type PlannerDay,
  type PlannerInterval,
  type PlannerWeekData,
  type TimeRange,
} from "./types";

const ACTIVE_BOOKING_STATUSES = [BookingStatus.PENDING, BookingStatus.CONFIRMED] as const;

export async function getAdminPlannerWeek(area: AdminArea, week?: string | null): Promise<PlannerWeekData> {
  const weekStart = resolveWeekStart(week);
  const weekEnd = addDays(weekStart, 7);
  const now = new Date();
  const todayKey = formatDateKey(now);

  const [slots, bookings] = await Promise.all([
    prisma.availabilitySlot.findMany({
      where: {
        startsAt: {
          lt: weekEnd,
        },
        endsAt: {
          gt: weekStart,
        },
      },
      orderBy: [{ startsAt: "asc" }],
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        capacity: true,
        status: true,
        publicNote: true,
        internalNote: true,
        serviceRestrictionMode: true,
        allowedServices: {
          select: {
            serviceId: true,
          },
        },
        bookings: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    }),
    prisma.booking.findMany({
      where: {
        scheduledStartsAt: {
          lt: weekEnd,
        },
        scheduledEndsAt: {
          gt: weekStart,
        },
        status: {
          in: [...ACTIVE_BOOKING_STATUSES],
        },
      },
      orderBy: [{ scheduledStartsAt: "asc" }],
      select: {
        id: true,
        slotId: true,
        scheduledStartsAt: true,
        scheduledEndsAt: true,
        status: true,
        clientNameSnapshot: true,
        serviceNameSnapshot: true,
      },
    }),
  ]);

  const days: PlannerDay[] = [];

  for (let index = 0; index < 7; index += 1) {
    const dayStart = addDays(weekStart, index);
    const dayEnd = addDays(dayStart, 1);
    const dateKey = formatDateKey(dayStart);
    const nowCell = dateToCellIndex(now);
    const isToday = isSameDateKey(dateKey, todayKey);
    const isPast = dayEnd <= now;

    const daySlots = slots.filter((slot) => slot.startsAt < dayEnd && slot.endsAt > dayStart);
    const dayBookings = bookings
      .filter((booking) => booking.scheduledStartsAt < dayEnd && booking.scheduledEndsAt > dayStart)
      .map((booking) => {
        const clipped = clampIntervalToDay(
          { startsAt: booking.scheduledStartsAt, endsAt: booking.scheduledEndsAt },
          dayStart,
          dayEnd,
        );

        if (!clipped) {
          return null;
        }

        const cells = intervalToCellRange(clipped);
        if (cells.endCell <= cells.startCell) {
          return null;
        }

        return {
          id: booking.id,
          slotId: booking.slotId,
          startCell: cells.startCell,
          endCell: cells.endCell,
          label: formatTimeRange(clipped.startsAt, clipped.endsAt),
          clientName: booking.clientNameSnapshot,
          serviceName: booking.serviceNameSnapshot,
          status: booking.status,
        } satisfies PlannerBooking;
      })
      .filter((booking): booking is PlannerBooking => booking !== null);
    const activeBookingsBySlotId = new Map<string, number>();

    for (const booking of dayBookings) {
      activeBookingsBySlotId.set(booking.slotId, (activeBookingsBySlotId.get(booking.slotId) ?? 0) + 1);
    }

    const intervals: PlannerInterval[] = daySlots
      .flatMap<PlannerInterval>((slot) => {
        const clipped = clampIntervalToDay(
          { startsAt: slot.startsAt, endsAt: slot.endsAt },
          dayStart,
          dayEnd,
        );

        if (!clipped) {
          return [];
        }

        const cells = intervalToCellRange(clipped);
        if (cells.endCell <= cells.startCell) {
          return [];
        }

        const activeBookingCount = activeBookingsBySlotId.get(slot.id) ?? 0;
        const plainEditable = isEditablePlannerSlot(slot);

        if (slot.status !== AvailabilitySlotStatus.PUBLISHED) {
          return [{
            id: slot.id,
            startCell: cells.startCell,
            endCell: cells.endCell,
            label: formatTimeRange(clipped.startsAt, clipped.endsAt),
            status: "inactive",
            bookingCount: activeBookingCount,
            canEdit: false,
            detail: "Neaktivní nebo interní interval",
          } satisfies PlannerInterval];
        }

        const slotBookingRanges = bookings
          .filter(
            (booking) =>
              booking.slotId === slot.id &&
              booking.scheduledStartsAt < dayEnd &&
              booking.scheduledEndsAt > dayStart,
          )
          .map((booking) =>
            clampIntervalToDay(
              { startsAt: booking.scheduledStartsAt, endsAt: booking.scheduledEndsAt },
              dayStart,
              dayEnd,
            ),
          )
          .filter((range): range is TimeRange => range !== null);

        if (slotBookingRanges.length > 0) {
          const mergedBookings = mergeIntervals(slotBookingRanges);
          const freeRanges = mergedBookings.reduce(
            (remaining, bookedRange) => subtractIntervals(remaining, bookedRange),
            [{ startsAt: clipped.startsAt, endsAt: clipped.endsAt }],
          );

          const bookedIntervals: PlannerInterval[] = mergedBookings.flatMap((bookedRange, bookingIndex) => {
            const bookingCells = intervalToCellRange(bookedRange);

            if (bookingCells.endCell <= bookingCells.startCell) {
              return [];
            }

            return [{
              id: `${slot.id}:booked:${bookingIndex}`,
              startCell: bookingCells.startCell,
              endCell: bookingCells.endCell,
              label: formatTimeRange(bookedRange.startsAt, bookedRange.endsAt),
              status: "booked",
              bookingCount: activeBookingCount,
              canEdit: false,
              detail: `${activeBookingCount} rezervace`,
            } satisfies PlannerInterval];
          });

          const lockedRemainderIntervals: PlannerInterval[] = freeRanges.flatMap((freeRange, freeRangeIndex) => {
            const freeCells = intervalToCellRange(freeRange);

            if (freeCells.endCell <= freeCells.startCell) {
              return [];
            }

            return [{
              id: `${slot.id}:locked:${freeRangeIndex}`,
              startCell: freeCells.startCell,
              endCell: freeCells.endCell,
              label: formatTimeRange(freeRange.startsAt, freeRange.endsAt),
              status: "locked",
              bookingCount: activeBookingCount,
              canEdit: false,
              detail: "Zbytek intervalu je svázaný existující rezervací.",
            } satisfies PlannerInterval];
          });

          return [...bookedIntervals, ...lockedRemainderIntervals];
        }

        if (plainEditable) {
          return [{
            id: slot.id,
            startCell: cells.startCell,
            endCell: cells.endCell,
            label: formatTimeRange(clipped.startsAt, clipped.endsAt),
            status: "available",
            bookingCount: 0,
            canEdit: true,
            detail: "Běžná dostupnost",
          } satisfies PlannerInterval];
        }

        return [{
          id: slot.id,
          startCell: cells.startCell,
          endCell: cells.endCell,
          label: formatTimeRange(clipped.startsAt, clipped.endsAt),
          status: "locked",
          bookingCount: activeBookingCount,
          canEdit: false,
          detail: slot.allowedServices.length > 0
            ? "Omezeno na vybrané služby"
            : slot.capacity !== EDITABLE_SLOT_CAPACITY
              ? `Kapacita ${slot.capacity}`
              : slot.bookings.length > 0
                ? "Slot obsahuje navázané rezervace a nejde upravit přímo v planneru."
              : slot.publicNote ?? slot.internalNote ?? "Vyžaduje detailní správu",
        } satisfies PlannerInterval];
      })
      .sort((left, right) => left.startCell - right.startCell);

    const availableIntervals = intervals
      .filter((interval) => interval.status === "available")
      .map((interval) => ({
        startCell: interval.startCell,
        endCell: interval.endCell,
        label: interval.label,
      }));

    const lockedIntervals = intervals
      .filter((interval) => interval.status === "locked" || interval.status === "inactive")
      .map((interval) => ({
        startCell: interval.startCell,
        endCell: interval.endCell,
        label: interval.label,
      }));

    const bookedCells = buildCellsMap(dayBookings);
    const availableCells = buildCellsMap(availableIntervals);
    const inactiveCells = buildCellsMap(intervals.filter((interval) => interval.status === "inactive"));
    const lockedCells = buildCellsMap(intervals.filter((interval) => interval.status === "locked"));
    const pastCells = Array.from({ length: availableCells.length }, (_, cellIndex) => {
      if (isPast) {
        return true;
      }

      if (!isToday) {
        return false;
      }

      return cellIndex + 1 <= nowCell;
    });

    const day: PlannerDay = {
      dateKey,
      isoDate: dayStart.toISOString(),
      label: `${weekdayLongFormatter.format(dayStart)} ${dateLabelFormatter.format(dayStart)}`,
      shortLabel: weekdayShortFormatter.format(dayStart),
      dayNumber: dayNumberFormatter.format(dayStart),
      monthLabel: `${monthOnlyFormatter.format(dayStart)}.`,
      monthDayLabel: monthDayFormatter.format(dayStart),
      isToday,
      isPast,
      availableIntervals,
      lockedIntervals,
      bookings: dayBookings,
      intervals,
      cells: {
        available: availableCells,
        booked: bookedCells,
        inactive: inactiveCells,
        locked: lockedCells,
        past: pastCells,
      },
      summary: {
        availableLabel:
          availableIntervals.length > 0
            ? `${availableIntervals.length} volná ${availableIntervals.length === 1 ? "okna" : "okna"}`
            : "Bez volné dostupnosti",
        bookingLabel:
          dayBookings.length > 0
            ? `${dayBookings.length} ${dayBookings.length === 1 ? "rezervace" : dayBookings.length < 5 ? "rezervace" : "rezervací"}`
            : "Bez rezervací",
        note: "",
      },
    };

    day.summary.note = getSummaryNote(day);
    days.push(day);
  }

  const weekKey = formatDateKey(weekStart);
  const weekEndInclusive = addDays(weekStart, 6);

  return {
    area,
    baseHref: getBaseHref(area),
    title: getAreaTitle(area),
    subtitle: getAreaSubtitle(area),
    weekKey,
    previousWeekKey: formatDateKey(addDays(weekStart, -7)),
    nextWeekKey: formatDateKey(addDays(weekStart, 7)),
    weekRangeLabel: `${monthTitleFormatter.format(weekStart)} - ${monthTitleFormatter.format(weekEndInclusive)}`,
    todayKey,
    days,
    legend: [
      { tone: "available", label: "Dostupnost" },
      { tone: "booked", label: "Rezervace" },
      { tone: "locked", label: "Omezené" },
      { tone: "inactive", label: "Neaktivní" },
      { tone: "past", label: "Minulý čas" },
    ],
  };
}

export async function findSlotWeekContext(slotId: string) {
  const slot = await prisma.availabilitySlot.findUnique({
    where: { id: slotId },
    select: { startsAt: true },
  });

  if (!slot) {
    return null;
  }

  return {
    weekKey: formatDateKey(resolveWeekStart(formatDateKey(slot.startsAt))),
    dateKey: formatDateKey(slot.startsAt),
  };
}
