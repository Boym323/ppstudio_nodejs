import {
  AvailabilitySlotServiceRestrictionMode,
  AvailabilitySlotStatus,
  Prisma,
} from "@prisma/client";

import { type AdminArea } from "@/config/navigation";
import { prisma } from "@/lib/prisma";

import {
  EDITABLE_SLOT_CAPACITY,
  ensureHalfHourCellIndex,
  intersectsAny,
  isEditablePlannerSlot,
  mergeIntervals,
  subtractIntervals,
} from "./helpers";
import {
  addDays,
  formatDateKey,
  getCellRangeBounds,
  getDayBounds,
  resolveWeekStart,
} from "./time";
import {
  type PlannerMutationResult,
  type TimeRange,
  type WeeklyDraftInput,
  type WeeklyTemplateInput,
  PlannerMutationError,
} from "./types";

async function getEditableDayState(tx: Prisma.TransactionClient, dateKey: string) {
  const { startsAt: dayStart, endsAt: dayEnd } = getDayBounds(dateKey);
  const slots = await tx.availabilitySlot.findMany({
    where: {
      startsAt: {
        lt: dayEnd,
      },
      endsAt: {
        gt: dayStart,
      },
    },
    orderBy: [{ startsAt: "asc" }],
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      status: true,
      capacity: true,
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
  });

  const editableSlots = slots.filter((slot) => isEditablePlannerSlot(slot));
  const lockedIntervals = slots
    .filter((slot) => {
      if (slot.status !== AvailabilitySlotStatus.PUBLISHED && slot.status !== AvailabilitySlotStatus.DRAFT) {
        return false;
      }

      return !editableSlots.some((editableSlot) => editableSlot.id === slot.id);
    })
    .map((slot) => ({ startsAt: slot.startsAt, endsAt: slot.endsAt }));
  const editableIntervals = editableSlots.map((slot) => ({ startsAt: slot.startsAt, endsAt: slot.endsAt }));

  return {
    dayStart,
    dayEnd,
    editableSlots,
    editableIntervals,
    lockedIntervals,
  };
}

async function replaceDayWithIntervals(
  tx: Prisma.TransactionClient,
  actorUserId: string | null,
  dateKey: string,
  intervals: TimeRange[],
) {
  const state = await getEditableDayState(tx, dateKey);

  if (intervals.some((interval) => intersectsAny(interval, state.lockedIntervals))) {
    throw new PlannerMutationError(
      "Kopírovaný rozvrh zasahuje do rezervací nebo omezených intervalů v cílovém dni.",
    );
  }

  if (state.editableSlots.length > 0) {
    await tx.availabilitySlot.deleteMany({
      where: {
        id: {
          in: state.editableSlots.map((slot) => slot.id),
        },
      },
    });
  }

  const merged = mergeIntervals(intervals);

  if (merged.length > 0) {
    await tx.availabilitySlot.createMany({
      data: merged.map((interval) => ({
        startsAt: interval.startsAt,
        endsAt: interval.endsAt,
        capacity: EDITABLE_SLOT_CAPACITY,
        status: AvailabilitySlotStatus.PUBLISHED,
        serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
        publishedAt: new Date(),
        createdByUserId: actorUserId,
      })),
    });
  }
}

async function readEditableIntervalsForDate(tx: Prisma.TransactionClient, dateKey: string) {
  const state = await getEditableDayState(tx, dateKey);
  return mergeIntervals(state.editableIntervals);
}

export async function applyAvailabilitySelection(
  area: AdminArea,
  input: {
    weekKey: string;
    dateKey: string;
    startCell: number;
    endCell: number;
    mode: "add" | "remove";
    actorUserId: string | null;
  },
): Promise<PlannerMutationResult> {
  ensureHalfHourCellIndex(input.startCell);
  ensureHalfHourCellIndex(input.endCell);

  if (input.endCell <= input.startCell) {
    throw new PlannerMutationError("Vyberte aspoň jednu půlhodinu.");
  }

  const selection = getCellRangeBounds(input.dateKey, input.startCell, input.endCell);

  await prisma.$transaction(async (tx) => {
    const state = await getEditableDayState(tx, input.dateKey);

    if (intersectsAny(selection, state.lockedIntervals)) {
      throw new PlannerMutationError(
        "Vybraný úsek zasahuje do rezervace nebo omezeného intervalu. Tenhle čas je potřeba nechat beze změny.",
      );
    }

    const baseIntervals = mergeIntervals(state.editableIntervals);
    const nextIntervals =
      input.mode === "add"
        ? mergeIntervals([...baseIntervals, selection])
        : mergeIntervals(subtractIntervals(baseIntervals, selection));

    if (nextIntervals.some((interval) => intersectsAny(interval, state.lockedIntervals))) {
      throw new PlannerMutationError("Změna by vytvořila kolizi s uzamčeným intervalem.");
    }

    if (state.editableSlots.length > 0) {
      await tx.availabilitySlot.deleteMany({
        where: {
          id: {
            in: state.editableSlots.map((slot) => slot.id),
          },
        },
      });
    }

    if (nextIntervals.length > 0) {
      await tx.availabilitySlot.createMany({
        data: nextIntervals.map((interval) => ({
          startsAt: interval.startsAt,
          endsAt: interval.endsAt,
          capacity: EDITABLE_SLOT_CAPACITY,
          status: AvailabilitySlotStatus.PUBLISHED,
          serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
          publishedAt: new Date(),
          createdByUserId: input.actorUserId,
        })),
      });
    }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });

  return {
    ok: true,
    message:
      input.mode === "add"
        ? "Dostupnost byla upravená a sousední půlhodiny jsme spojili do souvislých oken."
        : "Dostupnost byla odebraná. Zbylé úseky zůstaly uložené jako čisté souvislé intervaly.",
    weekKey: input.weekKey,
  };
}

export async function clearPlannerDay(
  area: AdminArea,
  input: {
    weekKey: string;
    dateKey: string;
  },
): Promise<PlannerMutationResult> {
  await prisma.$transaction(async (tx) => {
    const state = await getEditableDayState(tx, input.dateKey);

    if (state.editableSlots.length > 0) {
      await tx.availabilitySlot.deleteMany({
        where: {
          id: {
            in: state.editableSlots.map((slot) => slot.id),
          },
        },
      });
    }
  });

  return {
    ok: true,
    message: "Den je nastavený jako zavřeno. Rezervace a omezené intervaly zůstaly beze změny.",
    weekKey: input.weekKey,
  };
}

export async function copyPlannerDay(
  area: AdminArea,
  input: {
    weekKey: string;
    sourceDateKey: string;
    targetDateKey: string;
    actorUserId: string | null;
  },
): Promise<PlannerMutationResult> {
  await prisma.$transaction(async (tx) => {
    const sourceIntervals = await readEditableIntervalsForDate(tx, input.sourceDateKey);
    const { startsAt: sourceDayStart } = getDayBounds(input.sourceDateKey);
    const { startsAt: targetDayStart } = getDayBounds(input.targetDateKey);
    const shiftMs = targetDayStart.getTime() - sourceDayStart.getTime();

    await replaceDayWithIntervals(
      tx,
      input.actorUserId,
      input.targetDateKey,
      sourceIntervals.map((interval) => ({
        startsAt: new Date(interval.startsAt.getTime() + shiftMs),
        endsAt: new Date(interval.endsAt.getTime() + shiftMs),
      })),
    );
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });

  return {
    ok: true,
    message: "Rozvrh dne jsme zkopírovali. Přenesla se jen běžná dostupnost bez rezervací a omezených intervalů.",
    weekKey: input.weekKey,
  };
}

export async function copyPlannerWeek(
  area: AdminArea,
  input: {
    sourceWeekKey: string;
    targetWeekKey: string;
    actorUserId: string | null;
  },
): Promise<PlannerMutationResult> {
  const sourceWeekStart = resolveWeekStart(input.sourceWeekKey);
  const targetWeekStart = resolveWeekStart(input.targetWeekKey);

  await prisma.$transaction(async (tx) => {
    for (let index = 0; index < 7; index += 1) {
      const sourceDateKey = formatDateKey(addDays(sourceWeekStart, index));
      const targetDateKey = formatDateKey(addDays(targetWeekStart, index));
      const sourceIntervals = await readEditableIntervalsForDate(tx, sourceDateKey);
      const shiftMs = getDayBounds(targetDateKey).startsAt.getTime() - getDayBounds(sourceDateKey).startsAt.getTime();

      await replaceDayWithIntervals(
        tx,
        input.actorUserId,
        targetDateKey,
        sourceIntervals.map((interval) => ({
          startsAt: new Date(interval.startsAt.getTime() + shiftMs),
          endsAt: new Date(interval.endsAt.getTime() + shiftMs),
        })),
      );
    }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });

  return {
    ok: true,
    message: "Celý týden jsme přenesli do cílového týdne. Kopírují se jen běžné volné intervaly, ne rezervace.",
    weekKey: input.targetWeekKey,
  };
}

export async function applyWeeklyTemplate(
  area: AdminArea,
  input: {
    weekKey: string;
    template: WeeklyTemplateInput;
    actorUserId: string | null;
  },
): Promise<PlannerMutationResult> {
  const weekStart = resolveWeekStart(input.weekKey);

  await prisma.$transaction(async (tx) => {
    for (const dayTemplate of input.template) {
      if (dayTemplate.weekday < 0 || dayTemplate.weekday > 6) {
        throw new PlannerMutationError("Šablona týdne obsahuje neplatný den.");
      }

      const dateKey = formatDateKey(addDays(weekStart, dayTemplate.weekday));
      const intervals = dayTemplate.intervals.map((interval) => {
        ensureHalfHourCellIndex(interval.startCell);
        ensureHalfHourCellIndex(interval.endCell);

        if (interval.endCell <= interval.startCell) {
          throw new PlannerMutationError("Šablona týdne obsahuje prázdný interval.");
        }

        return getCellRangeBounds(dateKey, interval.startCell, interval.endCell);
      });

      await replaceDayWithIntervals(tx, input.actorUserId, dateKey, intervals);
    }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });

  return {
    ok: true,
    message: "Týdenní šablona byla použitá na právě otevřený týden.",
    weekKey: input.weekKey,
  };
}

export async function syncPlannerWeekDraft(
  area: AdminArea,
  input: {
    weekKey: string;
    days: WeeklyDraftInput;
    actorUserId: string | null;
  },
): Promise<PlannerMutationResult> {
  const weekStart = resolveWeekStart(input.weekKey);
  const allowedDateKeys = new Set(
    Array.from({ length: 7 }, (_, index) => formatDateKey(addDays(weekStart, index))),
  );

  await prisma.$transaction(async (tx) => {
    for (const day of input.days) {
      if (!allowedDateKeys.has(day.dateKey)) {
        throw new PlannerMutationError("Koncept obsahuje den mimo aktuálně otevřený týden.");
      }

      const intervals = day.intervals.map((interval) => {
        ensureHalfHourCellIndex(interval.startCell);
        ensureHalfHourCellIndex(interval.endCell);

        if (interval.endCell <= interval.startCell) {
          throw new PlannerMutationError("Koncept týdne obsahuje prázdný interval.");
        }

        return getCellRangeBounds(day.dateKey, interval.startCell, interval.endCell);
      });

      await replaceDayWithIntervals(tx, input.actorUserId, day.dateKey, intervals);
    }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });

  return {
    ok: true,
    message: "Změny týdne byly publikované do dostupností.",
    weekKey: input.weekKey,
  };
}
