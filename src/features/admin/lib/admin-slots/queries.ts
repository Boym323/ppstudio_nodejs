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
  getCellRangeBounds,
  monthDayFormatter,
  monthOnlyFormatter,
  monthTitleFormatter,
  resolveWeekStart,
  timeFormatter,
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
  intervalToPlannerCells,
  isHiddenHistoricalCancelledSlot,
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

const PLANNER_BOOKING_STATUSES = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
] as const;

function mergeMinuteBlocks(blocks: Array<{ startMinutes: number; endMinutes: number }>) {
  const sorted = [...blocks]
    .filter((block) => block.endMinutes > block.startMinutes)
    .sort((left, right) => left.startMinutes - right.startMinutes);

  const merged: Array<{ startMinutes: number; endMinutes: number }> = [];

  for (const block of sorted) {
    const previous = merged.at(-1);

    if (!previous) {
      merged.push({ ...block });
      continue;
    }

    if (previous.endMinutes >= block.startMinutes) {
      previous.endMinutes = Math.max(previous.endMinutes, block.endMinutes);
      continue;
    }

    merged.push({ ...block });
  }

  return merged;
}

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
        OR: [
          {
            blockedUntil: {
              gt: weekStart,
            },
          },
          {
            blockedUntil: null,
            scheduledEndsAt: {
              gt: weekStart,
            },
          },
        ],
        status: {
          in: [...PLANNER_BOOKING_STATUSES],
        },
      },
      orderBy: [{ scheduledStartsAt: "asc" }],
      select: {
        id: true,
        slotId: true,
        scheduledStartsAt: true,
        scheduledEndsAt: true,
        blockedUntil: true,
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

    const daySlots = slots.filter(
      (slot) =>
        slot.startsAt < dayEnd &&
        slot.endsAt > dayStart &&
        !isHiddenHistoricalCancelledSlot(slot),
    );
    const dayBookings = bookings
      .filter((booking) => booking.scheduledStartsAt < dayEnd && (booking.blockedUntil ?? booking.scheduledEndsAt) > dayStart)
      .map((booking) => {
        const blockedUntil = booking.blockedUntil ?? booking.scheduledEndsAt;
        const hasCleanupBlock = blockedUntil.getTime() > booking.scheduledEndsAt.getTime();
        const blockedClipped = clampIntervalToDay(
          { startsAt: booking.scheduledStartsAt, endsAt: booking.blockedUntil ?? booking.scheduledEndsAt },
          dayStart,
          dayEnd,
        );
        const serviceClipped = clampIntervalToDay(
          { startsAt: booking.scheduledStartsAt, endsAt: booking.scheduledEndsAt },
          dayStart,
          dayEnd,
        );

        if (!blockedClipped) {
          return null;
        }

        const cells = intervalToPlannerCells(blockedClipped, "cover");
        if (cells.endCell <= cells.startCell) {
          return null;
        }

        return {
          id: booking.id,
          slotId: booking.slotId,
          startCell: cells.startCell,
          endCell: cells.endCell,
          serviceStartMinutes: dateToCellIndex(
            (serviceClipped ?? blockedClipped).startsAt,
          ) * 30,
          serviceEndMinutes: dateToCellIndex(
            (serviceClipped ?? blockedClipped).endsAt,
          ) * 30,
          label: serviceClipped
            ? formatTimeRange(serviceClipped.startsAt, serviceClipped.endsAt)
            : formatTimeRange(blockedClipped.startsAt, blockedClipped.endsAt),
          blockedLabel: formatTimeRange(blockedClipped.startsAt, blockedClipped.endsAt),
          cleanupBlockedUntilLabel: hasCleanupBlock ? timeFormatter.format(blockedUntil) : null,
          hasCleanupBlock,
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

    const availableBlocks: PlannerDay["availableBlocks"] = [];
    const lockedBlocks: PlannerDay["lockedBlocks"] = [];
    const inactiveBlocks: PlannerDay["inactiveBlocks"] = [];
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

        // Rezervace sama nemění charakter slotu. Pro zobrazení zbytkové
        // dostupnosti posuzujeme jen jeho nastavení; rezervované období se
        // odečítá níže přes slotBlockingRanges.
        const plainEditable = isEditablePlannerSlot({ ...slot, bookings: [] });
        const cells = intervalToPlannerCells(
          clipped,
          slot.status === AvailabilitySlotStatus.PUBLISHED && plainEditable ? "inside" : "cover",
        );
        const activeBookingCount = activeBookingsBySlotId.get(slot.id) ?? 0;

        if (slot.status !== AvailabilitySlotStatus.PUBLISHED) {
          inactiveBlocks.push({
            startMinutes: dateToCellIndex(clipped.startsAt) * 30,
            endMinutes: dateToCellIndex(clipped.endsAt) * 30,
          });
          if (cells.endCell <= cells.startCell) {
            return [];
          }
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

        const slotBlockingRanges = bookings
          .filter(
            (booking) =>
              booking.scheduledStartsAt < clipped.endsAt &&
              (booking.blockedUntil ?? booking.scheduledEndsAt) > clipped.startsAt,
          )
          .map((booking) =>
            clampIntervalToDay(
              { startsAt: booking.scheduledStartsAt, endsAt: booking.blockedUntil ?? booking.scheduledEndsAt },
              clipped.startsAt,
              clipped.endsAt,
            ),
          )
          .filter((range): range is TimeRange => range !== null);
        const hasOwnBookings = activeBookingCount > 0;

        if (slotBlockingRanges.length > 0) {
          const mergedBookings = mergeIntervals(slotBlockingRanges);
          if (!hasOwnBookings) {
            for (const blockedRange of mergedBookings) {
              lockedBlocks.push({
                startMinutes: dateToCellIndex(blockedRange.startsAt) * 30,
                endMinutes: dateToCellIndex(blockedRange.endsAt) * 30,
              });
            }
          }
          const freeRanges = mergedBookings.reduce(
            (remaining, bookedRange) => subtractIntervals(remaining, bookedRange),
            [{ startsAt: clipped.startsAt, endsAt: clipped.endsAt }],
          );

          const blockingIntervals: PlannerInterval[] = mergedBookings.flatMap<PlannerInterval>((bookedRange, bookingIndex) => {
            const bookingCells = intervalToPlannerCells(bookedRange, "cover");

            if (bookingCells.endCell <= bookingCells.startCell) {
              return [];
            }

            return [{
              id: `${slot.id}:${hasOwnBookings ? "booked" : "blocked"}:${bookingIndex}`,
              startCell: bookingCells.startCell,
              endCell: bookingCells.endCell,
              label: formatTimeRange(bookedRange.startsAt, bookedRange.endsAt),
              status: hasOwnBookings ? "booked" : "locked",
              bookingCount: activeBookingCount,
              canEdit: false,
              detail: hasOwnBookings
                ? `${activeBookingCount} rezervace`
                : "Blokováno navazující rezervací nebo úklidem.",
            } satisfies PlannerInterval];
          });

          const remainderIntervals: PlannerInterval[] = freeRanges.flatMap<PlannerInterval>((freeRange, freeRangeIndex) => {
            const freeCells = intervalToPlannerCells(
              freeRange,
              plainEditable ? "inside" : "cover",
            );

            if (plainEditable) {
              availableBlocks.push({
                startMinutes: dateToCellIndex(freeRange.startsAt) * 30,
                endMinutes: dateToCellIndex(freeRange.endsAt) * 30,
              });
              if (freeCells.endCell <= freeCells.startCell) {
                return [];
              }
              const plannerRange = getCellRangeBounds(dateKey, freeCells.startCell, freeCells.endCell);

              return [{
                id: `${slot.id}:available:${freeRangeIndex}`,
                startCell: freeCells.startCell,
                endCell: freeCells.endCell,
                label: formatTimeRange(plannerRange.startsAt, plannerRange.endsAt),
                status: "available",
                bookingCount: 0,
                canEdit: true,
                detail: "Běžná dostupnost",
              } satisfies PlannerInterval];
            }

            lockedBlocks.push({
              startMinutes: dateToCellIndex(freeRange.startsAt) * 30,
              endMinutes: dateToCellIndex(freeRange.endsAt) * 30,
            });
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
              detail: "Interval nelze upravit přímo v planneru.",
            } satisfies PlannerInterval];
          });

          return [...blockingIntervals, ...remainderIntervals];
        }

        if (plainEditable) {
          availableBlocks.push({
            startMinutes: dateToCellIndex(clipped.startsAt) * 30,
            endMinutes: dateToCellIndex(clipped.endsAt) * 30,
          });
          if (cells.endCell <= cells.startCell) {
            return [];
          }
          const plannerRange = getCellRangeBounds(dateKey, cells.startCell, cells.endCell);

          return [{
            id: slot.id,
            startCell: cells.startCell,
            endCell: cells.endCell,
            label: formatTimeRange(plannerRange.startsAt, plannerRange.endsAt),
            status: "available",
            bookingCount: 0,
            canEdit: true,
            detail: "Běžná dostupnost",
          } satisfies PlannerInterval];
        }

        lockedBlocks.push({
          startMinutes: dateToCellIndex(clipped.startsAt) * 30,
          endMinutes: dateToCellIndex(clipped.endsAt) * 30,
        });
        if (cells.endCell <= cells.startCell) {
          return [];
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

    const availableIntervals = mergeMinuteBlocks(availableBlocks)
      .map((block) => ({
        startCell: Math.ceil(block.startMinutes / 30),
        endCell: Math.floor(block.endMinutes / 30),
      }))
      .filter((interval) => interval.endCell > interval.startCell)
      .map((interval) => {
        const plannerRange = getCellRangeBounds(dateKey, interval.startCell, interval.endCell);

        return {
          startCell: interval.startCell,
          endCell: interval.endCell,
          label: formatTimeRange(plannerRange.startsAt, plannerRange.endsAt),
        };
      });
    const displayAvailableIntervals = mergeMinuteBlocks(availableBlocks).map((block) => {
      const plannerRange = getCellRangeBounds(
        dateKey,
        block.startMinutes / 30,
        block.endMinutes / 30,
      );

      return {
        startCell: block.startMinutes / 30,
        endCell: block.endMinutes / 30,
        label: formatTimeRange(plannerRange.startsAt, plannerRange.endsAt),
      };
    });

    const lockedIntervals = intervals
      .filter((interval) => interval.status === "locked" || interval.status === "inactive")
      .map((interval) => ({
        startCell: interval.startCell,
        endCell: interval.endCell,
        label: interval.label,
      }));

    const bookedCells = buildCellsMap(
      dayBookings.filter(
        (booking) =>
          booking.status === BookingStatus.PENDING ||
          booking.status === BookingStatus.CONFIRMED,
      ),
    );
    const cleanupRanges = bookings
      .filter(
        (booking) =>
          booking.status === BookingStatus.PENDING ||
          booking.status === BookingStatus.CONFIRMED ||
          booking.status === BookingStatus.COMPLETED,
      )
      .map((booking) => {
        const blockedUntil = booking.blockedUntil ?? booking.scheduledEndsAt;

        if (blockedUntil.getTime() <= booking.scheduledEndsAt.getTime()) {
          return null;
        }

        return clampIntervalToDay(
          { startsAt: booking.scheduledEndsAt, endsAt: blockedUntil },
          dayStart,
          dayEnd,
        );
      })
      .filter((range): range is TimeRange => range !== null);
    const cleanupBlocks = mergeIntervals(cleanupRanges).map((range) => ({
      startMinutes: dateToCellIndex(range.startsAt) * 30,
      endMinutes: dateToCellIndex(range.endsAt) * 30,
    }));
    const bookedCleanupCells = Array.from({ length: bookedCells.length }, () => false);
    for (const cleanupBlock of cleanupBlocks) {
      const cleanupCells = intervalToPlannerCells(
        getCellRangeBounds(
          dateKey,
          cleanupBlock.startMinutes / 30,
          cleanupBlock.endMinutes / 30,
        ),
        "cover",
      );
      for (let cell = cleanupCells.startCell; cell < cleanupCells.endCell; cell += 1) {
        bookedCleanupCells[cell] = true;
      }
    }
    const completedCells = buildCellsMap(
      dayBookings.filter((booking) => booking.status === BookingStatus.COMPLETED),
    );
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
      displayAvailableIntervals,
      lockedIntervals,
      cleanupBlocks,
      availableBlocks,
      lockedBlocks,
      inactiveBlocks,
      bookings: dayBookings,
      intervals,
      cells: {
        available: availableCells,
        booked: bookedCells,
        bookedCleanup: bookedCleanupCells,
        completed: completedCells,
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
      { tone: "cleanup", label: "Úklid" },
      { tone: "completed", label: "Hotovo" },
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
