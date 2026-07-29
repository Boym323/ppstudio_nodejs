import {
  AvailabilityAuditOperation,
  AvailabilitySlotServiceRestrictionMode,
  AvailabilitySlotStatus,
  Prisma,
} from "@prisma/client";
import { randomUUID } from "node:crypto";

import { type AdminArea } from "@/config/navigation";
import { prisma } from "@/lib/prisma";

import {
  EDITABLE_SLOT_CAPACITY,
  ensureHalfHourCellIndex,
  getEditablePlannerIntervals,
  intersectsAny,
  isHiddenHistoricalCancelledSlot,
  isEditablePlannerSlot,
  mergeIntervals,
  subtractIntervals,
} from "./helpers";
import {
  addDays,
  formatDateKey,
  getCellRangeBounds,
  getDayBounds,
  isDateKeyInWeek,
  isValidDateKey,
  moveIntervalToDateKey,
  resolveWeekStart,
} from "./time";
import {
  type PlannerMutationResult,
  type TimeRange,
  type WeeklyDraftInput,
  type WeeklyTemplateInput,
  PlannerMutationError,
} from "./types";

const PLANNER_TRANSACTION_MAX_RETRIES = 4;
const PLANNER_TRANSACTION_RETRY_DELAY_MS = 40;
const PLANNER_BOOKING_STATUSES = ["PENDING", "CONFIRMED", "COMPLETED"] as const;
const AVAILABILITY_TIME_ZONE = "Europe/Prague";

type AuditContext = { actorUserId: string | null; actorRole?: "OWNER" | "SALON" | null; adminArea?: string; operationId: string; revertedOperationId?: string | null; operation: AvailabilityAuditOperation; source: string };

function slotSnapshot(slot: Awaited<ReturnType<typeof getEditableDayState>>["editableSlots"][number]) {
  return { id: slot.id, startsAt: slot.startsAt.toISOString(), endsAt: slot.endsAt.toISOString(), status: slot.status, bookingCount: slot.bookings.length };
}

function intervalSnapshot(intervals: TimeRange[]) {
  return intervals.map((interval) => ({ startsAt: interval.startsAt.toISOString(), endsAt: interval.endsAt.toISOString() }));
}

async function writeAvailabilityAudit(tx: Prisma.TransactionClient, dateKey: string, state: Awaited<ReturnType<typeof getEditableDayState>>, nextIntervals: TimeRange[], audit: AuditContext) {
  const removed = state.editableSlots.map((slot) => ({ ...slotSnapshot(slot), disposition: slot.bookings.length ? "archived" : "deleted" }));
  await tx.availabilityAuditEvent.create({ data: {
    actorUserId: audit.actorUserId,
    actorRole: audit.actorRole,
    adminArea: audit.adminArea ?? null,
    dateKey,
    timeZone: AVAILABILITY_TIME_ZONE,
    operation: audit.operation,
    source: audit.source,
    operationId: audit.operationId,
    revertedOperationId: audit.revertedOperationId ?? null,
    before: { intervals: intervalSnapshot(state.editableIntervals), slots: state.editableSlots.map(slotSnapshot) },
    after: { intervals: intervalSnapshot(nextIntervals) },
    createdSlots: intervalSnapshot(nextIntervals),
    archivedOrRemovedSlots: removed,
  } });
}

function ensureValidPlannerWeekDate(weekKey: string, dateKey: string) {
  if (!isValidDateKey(weekKey) || !isValidDateKey(dateKey) || !isDateKeyInWeek(dateKey, weekKey)) {
    throw new PlannerMutationError("Zvolený den nepatří do platného týdne planneru.");
  }
}

function ensureValidPlannerWeek(weekKey: string) {
  if (!isValidDateKey(weekKey)) {
    throw new PlannerMutationError("Týden planneru nemá platné datum.");
  }
}

function isRetryablePrismaError(error: unknown) {
  const driverAdapterCause =
    typeof error === "object" && error !== null && "cause" in error
      ? (error as { cause?: unknown }).cause
      : null;

  return (
    (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) ||
    (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "DriverAdapterError" &&
      typeof driverAdapterCause === "object" &&
      driverAdapterCause !== null &&
      "kind" in driverAdapterCause &&
      driverAdapterCause.kind === "TransactionWriteConflict"
    )
  );
}

function waitForRetry(delayMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

async function runPlannerTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!isRetryablePrismaError(error) || attempt >= PLANNER_TRANSACTION_MAX_RETRIES) {
        throw error;
      }

      attempt += 1;
      await waitForRetry(PLANNER_TRANSACTION_RETRY_DELAY_MS * attempt);
    }
  }
}

async function getEditableDayState(tx: Prisma.TransactionClient, dateKey: string) {
  const { startsAt: dayStart, endsAt: dayEnd } = getDayBounds(dateKey);
  const rawSlots = await tx.availabilitySlot.findMany({
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
  const bookings = await tx.booking.findMany({
    where: {
      scheduledStartsAt: { lt: dayEnd },
      OR: [
        { blockedUntil: { gt: dayStart } },
        { blockedUntil: null, scheduledEndsAt: { gt: dayStart } },
      ],
      status: { in: [...PLANNER_BOOKING_STATUSES] },
    },
    select: {
      scheduledStartsAt: true,
      scheduledEndsAt: true,
      blockedUntil: true,
    },
  });
  const slots = rawSlots.filter((slot) => !isHiddenHistoricalCancelledSlot(slot));

  const editableSlots = slots.filter((slot) => isEditablePlannerSlot(slot));
  const structuralLockedIntervals = slots
    .filter((slot) => {
      if (slot.status !== AvailabilitySlotStatus.PUBLISHED && slot.status !== AvailabilitySlotStatus.DRAFT) {
        return false;
      }

      return !editableSlots.some((editableSlot) => editableSlot.id === slot.id);
    })
    .map((slot) => ({ startsAt: slot.startsAt, endsAt: slot.endsAt }));
  const bookingProtectedIntervals = bookings.map((booking) => ({
    startsAt: booking.scheduledStartsAt,
    endsAt: booking.blockedUntil ?? booking.scheduledEndsAt,
  }));
  const protectedIntervals = mergeIntervals([...structuralLockedIntervals, ...bookingProtectedIntervals]);
  const editableIntervals = getEditablePlannerIntervals(
    editableSlots.map((slot) => ({ startsAt: slot.startsAt, endsAt: slot.endsAt })),
    protectedIntervals,
  );

  return {
    dayStart,
    dayEnd,
    editableSlots,
    editableIntervals,
    lockedIntervals: protectedIntervals,
  };
}

async function removeEditableSlots(
  tx: Prisma.TransactionClient,
  editableSlots: Awaited<ReturnType<typeof getEditableDayState>>["editableSlots"],
) {
  const deletableSlotIds = editableSlots
    .filter((slot) => slot.bookings.length === 0)
    .map((slot) => slot.id);
  const archivalSlotIds = editableSlots
    .filter((slot) => slot.bookings.length > 0)
    .map((slot) => slot.id);

  if (deletableSlotIds.length > 0) {
    await tx.availabilitySlot.deleteMany({
      where: {
        id: {
          in: deletableSlotIds,
        },
      },
    });
  }

  if (archivalSlotIds.length > 0) {
    await tx.availabilitySlot.updateMany({
      where: {
        id: {
          in: archivalSlotIds,
        },
      },
      data: {
        status: AvailabilitySlotStatus.ARCHIVED,
      },
    });
  }
}

async function replaceDayWithIntervals(
  tx: Prisma.TransactionClient,
  actorUserId: string | null,
  dateKey: string,
  intervals: TimeRange[],
  options: {
    lockedConflict?: "reject" | "preserve";
    conflictMessage?: string;
    audit: AuditContext;
  } = {},
) {
  const state = await getEditableDayState(tx, dateKey);
  const lockedConflict = options.lockedConflict ?? "reject";

  if (
    lockedConflict === "reject" &&
    intervals.some((interval) => intersectsAny(interval, state.lockedIntervals))
  ) {
    throw new PlannerMutationError(
      options.conflictMessage ??
        "Kopírovaný rozvrh zasahuje do rezervací nebo omezených intervalů v cílovém dni.",
    );
  }

  if (state.editableSlots.length > 0) {
    await removeEditableSlots(tx, state.editableSlots);
  }

  const merged =
    lockedConflict === "preserve"
      ? state.lockedIntervals.reduce(
          (currentIntervals, lockedInterval) => subtractIntervals(currentIntervals, lockedInterval),
          mergeIntervals(intervals),
        )
      : mergeIntervals(intervals);

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
  await writeAvailabilityAudit(tx, dateKey, state, merged, options.audit);
}

async function readEditableIntervalsForDate(tx: Prisma.TransactionClient, dateKey: string) {
  const state = await getEditableDayState(tx, dateKey);
  return state.editableIntervals;
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
    actorRole?: "OWNER" | "SALON" | null;
    operationId?: string;
    revertedOperationId?: string | null;
  },
): Promise<PlannerMutationResult> {
  ensureValidPlannerWeekDate(input.weekKey, input.dateKey);
  ensureHalfHourCellIndex(input.startCell);
  ensureHalfHourCellIndex(input.endCell);

  if (input.endCell <= input.startCell) {
    throw new PlannerMutationError("Vyberte aspoň jednu půlhodinu.");
  }

  const selection = getCellRangeBounds(input.dateKey, input.startCell, input.endCell);

  const operationId = input.operationId ?? randomUUID();
  await runPlannerTransaction(async (tx) => {
    const state = await getEditableDayState(tx, input.dateKey);

    if (intersectsAny(selection, state.lockedIntervals)) {
      throw new PlannerMutationError(
        "Vybraný úsek zasahuje do rezervace nebo omezeného intervalu. Tenhle čas je potřeba nechat beze změny.",
      );
    }

    const baseIntervals = state.editableIntervals;
    const nextIntervals =
      input.mode === "add"
        ? mergeIntervals([...baseIntervals, selection])
        : mergeIntervals(subtractIntervals(baseIntervals, selection));

    if (nextIntervals.some((interval) => intersectsAny(interval, state.lockedIntervals))) {
      throw new PlannerMutationError("Změna by vytvořila kolizi s uzamčeným intervalem.");
    }

    if (state.editableSlots.length > 0) {
      await removeEditableSlots(tx, state.editableSlots);
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
    await writeAvailabilityAudit(tx, input.dateKey, state, nextIntervals, { actorUserId: input.actorUserId, actorRole: input.actorRole, adminArea: area, operationId, revertedOperationId: input.revertedOperationId, operation: input.revertedOperationId ? AvailabilityAuditOperation.UNDO : input.mode === "add" ? AvailabilityAuditOperation.ADD : AvailabilityAuditOperation.REMOVE, source: input.revertedOperationId ? "planner-undo-v1" : "planner-selection-v1" });
  });

  return {
    ok: true,
    message:
      input.mode === "add"
        ? "Dostupnost byla upravená a sousední půlhodiny jsme spojili do souvislých oken."
        : "Dostupnost byla odebraná. Zbylé úseky zůstaly uložené jako čisté souvislé intervaly.",
    weekKey: input.weekKey,
    operationId,
  };
}

export async function clearPlannerDay(
  area: AdminArea,
  input: {
    weekKey: string;
    dateKey: string;
    actorUserId: string | null;
    actorRole?: "OWNER" | "SALON" | null;
  },
): Promise<PlannerMutationResult> {
  ensureValidPlannerWeekDate(input.weekKey, input.dateKey);
  const operationId = randomUUID();
  await runPlannerTransaction(async (tx) => {
    const state = await getEditableDayState(tx, input.dateKey);

    if (state.editableSlots.length > 0) {
      await removeEditableSlots(tx, state.editableSlots);
    }
    await writeAvailabilityAudit(tx, input.dateKey, state, [], { actorUserId: input.actorUserId, actorRole: input.actorRole, adminArea: area, operationId, operation: AvailabilityAuditOperation.CLEAR, source: "planner-clear-day-v1" });
  });

  return {
    ok: true,
    message: "Den je nastavený jako zavřeno. Rezervace a omezené intervaly zůstaly beze změny.",
    weekKey: input.weekKey,
    operationId,
  };
}

export async function copyPlannerWeek(
  area: AdminArea,
  input: {
    sourceWeekKey: string;
    targetWeekKey: string;
    actorUserId: string | null;
    actorRole?: "OWNER" | "SALON" | null;
  },
): Promise<PlannerMutationResult> {
  ensureValidPlannerWeek(input.sourceWeekKey);
  ensureValidPlannerWeek(input.targetWeekKey);
  const sourceWeekStart = resolveWeekStart(input.sourceWeekKey);
  const targetWeekStart = resolveWeekStart(input.targetWeekKey);

  const operationId = randomUUID();
  await runPlannerTransaction(async (tx) => {
    for (let index = 0; index < 7; index += 1) {
      const sourceDateKey = formatDateKey(addDays(sourceWeekStart, index));
      const targetDateKey = formatDateKey(addDays(targetWeekStart, index));
      const sourceIntervals = await readEditableIntervalsForDate(tx, sourceDateKey);

      await replaceDayWithIntervals(
        tx,
        input.actorUserId,
        targetDateKey,
        sourceIntervals.map((interval) => moveIntervalToDateKey(interval, targetDateKey)),
        { audit: { actorUserId: input.actorUserId, actorRole: input.actorRole, adminArea: area, operationId, operation: AvailabilityAuditOperation.COPY_WEEK, source: "planner-copy-week-v1" } },
      );
    }
  });

  return {
    ok: true,
    message: "Celý týden jsme přenesli do cílového týdne. Kopírují se jen běžné volné intervaly, ne rezervace.",
    weekKey: input.targetWeekKey,
    operationId,
  };
}

export async function applyWeeklyTemplate(
  area: AdminArea,
  input: {
    weekKey: string;
    template: WeeklyTemplateInput;
    actorUserId: string | null;
    actorRole?: "OWNER" | "SALON" | null;
  },
): Promise<PlannerMutationResult> {
  ensureValidPlannerWeek(input.weekKey);
  const weekStart = resolveWeekStart(input.weekKey);

  const operationId = randomUUID();
  await runPlannerTransaction(async (tx) => {
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

      await replaceDayWithIntervals(tx, input.actorUserId, dateKey, intervals, { audit: { actorUserId: input.actorUserId, actorRole: input.actorRole, adminArea: area, operationId, operation: AvailabilityAuditOperation.APPLY_TEMPLATE, source: "planner-week-template-v1" } });
    }
  });

  return {
    ok: true,
    message: "Týdenní šablona byla použitá na právě otevřený týden.",
    weekKey: input.weekKey,
    operationId,
  };
}

export async function syncPlannerWeekDraft(
  area: AdminArea,
  input: {
    weekKey: string;
    days: WeeklyDraftInput;
    actorUserId: string | null;
    actorRole?: "OWNER" | "SALON" | null;
  },
): Promise<PlannerMutationResult> {
  ensureValidPlannerWeek(input.weekKey);
  const weekStart = resolveWeekStart(input.weekKey);
  const allowedDateKeys = new Set(
    Array.from({ length: 7 }, (_, index) => formatDateKey(addDays(weekStart, index))),
  );

  const operationId = randomUUID();
  await runPlannerTransaction(async (tx) => {
    for (const day of input.days) {
      if (!isValidDateKey(day.dateKey) || !allowedDateKeys.has(day.dateKey)) {
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

      await replaceDayWithIntervals(tx, input.actorUserId, day.dateKey, intervals, {
        lockedConflict: "preserve",
        audit: { actorUserId: input.actorUserId, actorRole: input.actorRole, adminArea: area, operationId, operation: AvailabilityAuditOperation.SYNC_DRAFT, source: "planner-week-draft-v1" },
      });
    }
  });

  return {
    ok: true,
    message: "Změny týdne byly publikované do dostupností.",
    weekKey: input.weekKey,
    operationId,
  };
}
