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
  ensureQuarterHourCellIndex,
  getEditablePlannerIntervals,
  intersectsAny,
  isHiddenHistoricalCancelledSlot,
  isEditablePlannerSlot,
  mergeIntervals,
  subtractIntervals,
} from "./helpers";
import {
  getCellRangeBounds,
  getDayBounds,
  isDateKeyInWeek,
  isValidDateKey,
} from "./time";
import {
  type PlannerMutationResult,
  type TimeRange,
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

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function selectionFingerprint(area: AdminArea, input: {
  weekKey: string;
  dateKey: string;
  startCell: number;
  endCell: number;
  mode: "add" | "remove";
  revertedOperationId?: string | null;
}) {
  return JSON.stringify({
    area,
    weekKey: input.weekKey,
    dateKey: input.dateKey,
    startCell: input.startCell,
    endCell: input.endCell,
    mode: input.mode,
    revertedOperationId: input.revertedOperationId ?? null,
  });
}

function selectionResult(input: { weekKey: string; mode: "add" | "remove"; operationId: string }): PlannerMutationResult {
  return {
    ok: true,
    message:
      input.mode === "add"
        ? "Dostupnost byla upravená a sousední půlhodiny jsme spojili do souvislých oken."
        : "Dostupnost byla odebraná. Zbylé úseky zůstaly uložené jako čisté souvislé intervaly.",
    weekKey: input.weekKey,
    operationId: input.operationId,
  };
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
    bookingBlockEnds: bookings.map((booking) => booking.blockedUntil ?? booking.scheduledEndsAt),
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
    operationId: string;
    revertedOperationId?: string | null;
  },
): Promise<PlannerMutationResult> {
  ensureValidPlannerWeekDate(input.weekKey, input.dateKey);
  ensureQuarterHourCellIndex(input.startCell);
  ensureQuarterHourCellIndex(input.endCell);

  if (input.endCell <= input.startCell) {
    throw new PlannerMutationError("Vyberte aspoň jednu půlhodinu.");
  }

  const selection = getCellRangeBounds(input.dateKey, input.startCell, input.endCell);

  const operationId = input.operationId;
  const fingerprint = selectionFingerprint(area, input);
  const result = selectionResult({ weekKey: input.weekKey, mode: input.mode, operationId });

  try {
    const existingResult = await runPlannerTransaction(async (tx) => {
      const existingOperation = await tx.availabilityOperation.findUnique({ where: { operationId } });

      if (existingOperation) {
        if (existingOperation.fingerprint !== fingerprint) {
          throw new PlannerMutationError("Tento idempotentní klíč už patří k jiné změně dostupnosti.");
        }

        return {
          ok: true,
          message: existingOperation.resultMessage,
          weekKey: existingOperation.weekKey,
          operationId,
        } satisfies PlannerMutationResult;
      }

      await tx.availabilityOperation.create({
        data: {
          operationId,
          fingerprint,
          weekKey: result.weekKey,
          resultMessage: result.message,
        },
      });

    const state = await getEditableDayState(tx, input.dateKey);

    if (intersectsAny(selection, state.lockedIntervals)) {
      throw new PlannerMutationError(
        "Vybraný úsek zasahuje do rezervace nebo omezeného intervalu. Tenhle čas je potřeba nechat beze změny.",
      );
    }

    const usesQuarterHourStart = !Number.isInteger(input.startCell);
    const startsImmediatelyAfterBookingBlock = state.bookingBlockEnds.some(
      (bookingBlockEnd) => bookingBlockEnd.getTime() === selection.startsAt.getTime(),
    );

    if (usesQuarterHourStart && !startsImmediatelyAfterBookingBlock) {
      throw new PlannerMutationError(
        "Čtvrthodinový začátek lze použít jen bezprostředně po skončení rezervace nebo úklidu.",
      );
    }

    if (!usesQuarterHourStart && !Number.isInteger(input.endCell)) {
      throw new PlannerMutationError(
        "Čtvrthodinový konec je možné použít jen u termínu, který začíná po úklidu.",
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
      return null;
    });

    return existingResult ?? result;
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const existingOperation = await prisma.availabilityOperation.findUnique({ where: { operationId } });
    if (!existingOperation) {
      throw error;
    }
    if (existingOperation.fingerprint !== fingerprint) {
      throw new PlannerMutationError("Tento idempotentní klíč už patří k jiné změně dostupnosti.");
    }

    return { ok: true, message: existingOperation.resultMessage, weekKey: existingOperation.weekKey, operationId };
  }
}
