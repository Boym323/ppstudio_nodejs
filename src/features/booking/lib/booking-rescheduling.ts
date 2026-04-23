import {
  AvailabilitySlotServiceRestrictionMode,
  AvailabilitySlotStatus,
  BookingActionTokenType,
  BookingStatus,
  EmailLogStatus,
  EmailLogType,
  Prisma,
} from "@prisma/client";

import { env } from "@/config/env";
import {
  buildBookingActionExpiry,
  buildBookingActionToken,
  buildBookingCancellationUrl,
  buildBookingManagementUrl,
} from "@/features/booking/lib/booking-action-tokens";
import { formatBookingDateLabel } from "@/features/booking/lib/booking-format";
import { prisma } from "@/lib/prisma";
import { getBookingPolicySettings, isBookingWithinWindow } from "@/lib/site-settings";

const ACTIVE_BOOKING_STATUSES = [BookingStatus.PENDING, BookingStatus.CONFIRMED] as const;
const MAX_BOOKING_TRANSACTION_RETRIES = 3;
const EDITABLE_SLOT_CAPACITY = 1;

export const bookingRescheduleErrorCodes = {
  notFound: "NOT_FOUND",
  statusNotAllowed: "STATUS_NOT_ALLOWED",
  invalidDateTime: "INVALID_DATE_TIME",
  sameTerm: "SAME_TERM",
  slotUnavailable: "SLOT_UNAVAILABLE",
  slotTooShort: "SLOT_TOO_SHORT",
  slotNotAllowed: "SLOT_NOT_ALLOWED",
  conflict: "CONFLICT",
  concurrentModification: "CONCURRENT_MODIFICATION",
  temporaryFailure: "TEMPORARY_FAILURE",
} as const;

export type BookingRescheduleErrorCode =
  (typeof bookingRescheduleErrorCodes)[keyof typeof bookingRescheduleErrorCodes];

export class BookingRescheduleError extends Error {
  code: BookingRescheduleErrorCode;
  suggestedField: "newDate" | "newTime" | "slot" | "form";

  constructor(
    code: BookingRescheduleErrorCode,
    message: string,
    suggestedField: "newDate" | "newTime" | "slot" | "form" = "form",
  ) {
    super(message);
    this.name = "BookingRescheduleError";
    this.code = code;
    this.suggestedField = suggestedField;
  }
}

export type RescheduleBookingInput = {
  bookingId: string;
  newStartAt: string;
  newEndAt?: string;
  slotId?: string;
  reason?: string | null;
  changedByUserId: string | null;
  changedByClient?: boolean;
  notifyClient: boolean;
  includeCalendarAttachment?: boolean;
  expectedUpdatedAt?: string;
};

export type RescheduleBookingResult = {
  bookingId: string;
  scheduledStartsAt: string;
  scheduledEndsAt: string;
  scheduledAtLabel: string;
  previousScheduledAtLabel: string;
  rescheduleCount: number;
  manualOverride: boolean;
  notificationStatus: "queued" | "logged" | "skipped" | "failed";
};

type BookingSlotRecord = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  status: AvailabilitySlotStatus;
  serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode;
  publicNote: string | null;
  internalNote: string | null;
  publishedAt: Date | null;
  cancelledAt: Date | null;
  createdByUserId: string | null;
  allowedServices: Array<{
    serviceId: string;
  }>;
};

type RescheduleTransactionResult = {
  bookingId: string;
  serviceName: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  scheduledStartsAt: Date;
  scheduledEndsAt: Date;
  previousStartsAt: Date;
  previousEndsAt: Date;
  manualOverride: boolean;
  rescheduleCount: number;
};

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function doesSlotSupportServiceDuration(startsAt: Date, endsAt: Date, serviceDurationMinutes: number) {
  return endsAt.getTime() - startsAt.getTime() >= serviceDurationMinutes * 60 * 1000;
}

function isRetryablePrismaError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

async function lockRequestedSlot(
  tx: Prisma.TransactionClient,
  slotId: string,
): Promise<BookingSlotRecord | null> {
  const lockedSlotRows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "AvailabilitySlot"
    WHERE "id" = ${slotId}
    FOR UPDATE
  `);

  if (lockedSlotRows.length === 0) {
    return null;
  }

  return tx.availabilitySlot.findUnique({
    where: {
      id: slotId,
    },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      capacity: true,
      status: true,
      serviceRestrictionMode: true,
      publicNote: true,
      internalNote: true,
      publishedAt: true,
      cancelledAt: true,
      createdByUserId: true,
      allowedServices: {
        select: {
          serviceId: true,
        },
      },
    },
  });
}

async function splitSlotForEditing(
  tx: Prisma.TransactionClient,
  slot: BookingSlotRecord,
  requestedStartsAt: Date,
  requestedEndsAt: Date,
) {
  const shouldSplitSlotForAdminEditing =
    slot.capacity === EDITABLE_SLOT_CAPACITY
    && (requestedStartsAt.getTime() > slot.startsAt.getTime()
      || requestedEndsAt.getTime() < slot.endsAt.getTime());

  if (!shouldSplitSlotForAdminEditing) {
    return;
  }

  const beforeInterval =
    requestedStartsAt.getTime() > slot.startsAt.getTime()
      ? { startsAt: slot.startsAt, endsAt: requestedStartsAt }
      : null;
  const afterInterval =
    requestedEndsAt.getTime() < slot.endsAt.getTime()
      ? { startsAt: requestedEndsAt, endsAt: slot.endsAt }
      : null;

  await tx.availabilitySlot.update({
    where: {
      id: slot.id,
    },
    data: {
      startsAt: requestedStartsAt,
      endsAt: requestedEndsAt,
    },
  });

  const intervalFragments = [beforeInterval, afterInterval].filter(
    (fragment): fragment is { startsAt: Date; endsAt: Date } => fragment !== null,
  );

  for (const fragment of intervalFragments) {
    await tx.availabilitySlot.create({
      data: {
        startsAt: fragment.startsAt,
        endsAt: fragment.endsAt,
        capacity: slot.capacity,
        status: slot.status,
        serviceRestrictionMode: slot.serviceRestrictionMode,
        publicNote: slot.publicNote,
        internalNote: slot.internalNote,
        publishedAt: slot.publishedAt,
        cancelledAt: slot.cancelledAt,
        createdByUserId: slot.createdByUserId,
        allowedServices: slot.allowedServices.length > 0
          ? {
              createMany: {
                data: slot.allowedServices.map((allowedService) => ({
                  serviceId: allowedService.serviceId,
                })),
              },
            }
          : undefined,
      },
    });
  }
}

async function maybeDeleteOrphanedManualOverrideSlot(
  tx: Prisma.TransactionClient,
  slotId: string,
  bookingId: string,
) {
  const slot = await tx.availabilitySlot.findUnique({
    where: {
      id: slotId,
    },
    select: {
      id: true,
      status: true,
      bookings: {
        where: {
          id: {
            not: bookingId,
          },
          status: {
            in: [...ACTIVE_BOOKING_STATUSES],
          },
        },
        select: {
          id: true,
        },
        take: 1,
      },
    },
  });

  if (!slot || slot.status !== AvailabilitySlotStatus.DRAFT || slot.bookings.length > 0) {
    return;
  }

  await tx.availabilitySlot.delete({
    where: {
      id: slotId,
    },
  });
}

function getUniqueConstraintTargets(error: Prisma.PrismaClientKnownRequestError) {
  const target = error.meta?.target;

  if (Array.isArray(target)) {
    return target.map((item) => String(item));
  }

  if (typeof target === "string") {
    return [target];
  }

  return [];
}

function mapKnownPrismaError(error: Prisma.PrismaClientKnownRequestError) {
  if (error.code !== "P2002") {
    return null;
  }

  const targets = getUniqueConstraintTargets(error);

  if (
    targets.includes("Booking_exact_duplicate_active_key")
    || (
      targets.includes("slotId")
      && targets.includes("clientId")
      && targets.includes("scheduledStartsAt")
      && targets.includes("scheduledEndsAt")
    )
  ) {
    return new BookingRescheduleError(
      bookingRescheduleErrorCodes.conflict,
      "Nový termín už koliduje s jinou aktivní rezervací.",
      "slot",
    );
  }

  return new BookingRescheduleError(
    bookingRescheduleErrorCodes.concurrentModification,
    "Rezervace se mezitím změnila v jiném okně. Obnovte detail a zkuste to znovu.",
  );
}

async function queueBookingRescheduledNotification(input: {
  bookingId: string;
  clientId: string;
  clientEmail: string;
  clientName: string;
  serviceName: string;
  previousStartsAt: Date;
  previousEndsAt: Date;
  scheduledStartsAt: Date;
  scheduledEndsAt: Date;
  includeCalendarAttachment: boolean;
}) {
  const now = new Date();
  const manageToken = buildBookingActionToken();
  const cancellationToken = buildBookingActionToken();
  const actionToken = await prisma.bookingActionToken.create({
    data: {
      bookingId: input.bookingId,
      type: BookingActionTokenType.RESCHEDULE,
      tokenHash: manageToken.tokenHash,
      expiresAt: buildBookingActionExpiry(now),
      lastSentAt: now,
    },
    select: {
      id: true,
    },
  });

  await prisma.bookingActionToken.create({
    data: {
      bookingId: input.bookingId,
      type: BookingActionTokenType.CANCEL,
      tokenHash: cancellationToken.tokenHash,
      expiresAt: buildBookingActionExpiry(now),
      lastSentAt: now,
    },
  });

  await prisma.emailLog.create({
    data: {
      bookingId: input.bookingId,
      clientId: input.clientId,
      actionTokenId: actionToken.id,
      type: EmailLogType.BOOKING_RESCHEDULED,
      status: env.EMAIL_DELIVERY_MODE === "background" ? undefined : EmailLogStatus.SENT,
      attemptCount: env.EMAIL_DELIVERY_MODE === "background" ? undefined : 1,
      nextAttemptAt: env.EMAIL_DELIVERY_MODE === "background" ? now : undefined,
      processingStartedAt: null,
      processingToken: null,
      recipientEmail: input.clientEmail,
      subject: `Změna termínu rezervace: ${input.serviceName}`,
      templateKey: "booking-rescheduled-v1",
      payload: {
        bookingId: input.bookingId,
        serviceName: input.serviceName,
        clientName: input.clientName,
        previousStartsAt: input.previousStartsAt.toISOString(),
        previousEndsAt: input.previousEndsAt.toISOString(),
        scheduledStartsAt: input.scheduledStartsAt.toISOString(),
        scheduledEndsAt: input.scheduledEndsAt.toISOString(),
        manageReservationUrl: buildBookingManagementUrl(manageToken.rawToken),
        cancellationUrl: buildBookingCancellationUrl(cancellationToken.rawToken),
        includeCalendarAttachment: input.includeCalendarAttachment,
      },
      provider: env.EMAIL_DELIVERY_MODE === "background" ? undefined : "log",
      sentAt: env.EMAIL_DELIVERY_MODE === "background" ? undefined : now,
    },
  });

  return env.EMAIL_DELIVERY_MODE === "background" ? "queued" : "logged";
}

async function rescheduleBookingInTransaction(
  tx: Prisma.TransactionClient,
  input: RescheduleBookingInput,
  requestedStartsAt: Date,
) {
  await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "Booking"
    WHERE "id" = ${input.bookingId}
    FOR UPDATE
  `);

  const booking = await tx.booking.findUnique({
    where: {
      id: input.bookingId,
    },
    select: {
      id: true,
      status: true,
      slotId: true,
      serviceId: true,
      serviceDurationMinutes: true,
      serviceNameSnapshot: true,
      scheduledStartsAt: true,
      scheduledEndsAt: true,
      clientId: true,
      clientNameSnapshot: true,
      clientEmailSnapshot: true,
      clientPhoneSnapshot: true,
      clientNote: true,
      manualOverride: true,
      updatedAt: true,
      rescheduleCount: true,
      slot: {
        select: {
          id: true,
          startsAt: true,
          endsAt: true,
          capacity: true,
          status: true,
          serviceRestrictionMode: true,
          publicNote: true,
          internalNote: true,
          publishedAt: true,
          cancelledAt: true,
          createdByUserId: true,
          allowedServices: {
            select: {
              serviceId: true,
            },
          },
        },
      },
    },
  });

  if (!booking) {
    throw new BookingRescheduleError(
      bookingRescheduleErrorCodes.notFound,
      "Rezervaci se nepodařilo najít.",
    );
  }

  if (input.expectedUpdatedAt) {
    const expectedUpdatedAt = new Date(input.expectedUpdatedAt);

    if (
      !Number.isNaN(expectedUpdatedAt.getTime())
      && booking.updatedAt.getTime() !== expectedUpdatedAt.getTime()
    ) {
      throw new BookingRescheduleError(
        bookingRescheduleErrorCodes.concurrentModification,
        "Rezervace se mezitím změnila v jiném okně. Obnovte detail a zkuste to znovu.",
      );
    }
  }

  if (booking.status !== BookingStatus.PENDING && booking.status !== BookingStatus.CONFIRMED) {
    throw new BookingRescheduleError(
      bookingRescheduleErrorCodes.statusNotAllowed,
      "Tuto rezervaci už není možné přesunout. Přesun podporujeme jen u čekajících a potvrzených rezervací.",
    );
  }

  const requestedEndsAt = input.newEndAt
    ? new Date(input.newEndAt)
    : new Date(requestedStartsAt.getTime() + booking.serviceDurationMinutes * 60 * 1000);

  if (
    Number.isNaN(requestedEndsAt.getTime())
    || requestedEndsAt <= requestedStartsAt
  ) {
    throw new BookingRescheduleError(
      bookingRescheduleErrorCodes.invalidDateTime,
      "Vyplňte platný nový datum a čas rezervace.",
      "newTime",
    );
  }

  if (requestedEndsAt.getTime() - requestedStartsAt.getTime() !== booking.serviceDurationMinutes * 60 * 1000) {
    throw new BookingRescheduleError(
      bookingRescheduleErrorCodes.invalidDateTime,
      "Nový termín musí respektovat délku vybrané služby.",
      "newTime",
    );
  }

  if (
    booking.scheduledStartsAt.getTime() === requestedStartsAt.getTime()
    && booking.scheduledEndsAt.getTime() === requestedEndsAt.getTime()
  ) {
    throw new BookingRescheduleError(
      bookingRescheduleErrorCodes.sameTerm,
      "Nový termín je stejný jako ten současný.",
      "newTime",
    );
  }

  const bookingPolicy = await getBookingPolicySettings();
  const now = new Date();
  const isWithinPublicWindow = isBookingWithinWindow(
    requestedStartsAt,
    now,
    bookingPolicy.minAdvanceHours,
    bookingPolicy.maxAdvanceDays,
  );

  const requestedSlot = input.slotId && input.slotId !== booking.slotId
    ? await lockRequestedSlot(tx, input.slotId)
    : null;

  if (input.slotId && input.slotId !== booking.slotId && !requestedSlot) {
    throw new BookingRescheduleError(
      bookingRescheduleErrorCodes.slotUnavailable,
      "Vybraný slot už není k dispozici.",
      "slot",
    );
  }

  const excludedSlotIds = [booking.slotId, requestedSlot?.id].filter((value): value is string => Boolean(value));
  const overlappingSlots = await tx.availabilitySlot.findMany({
    where: {
      id: excludedSlotIds.length > 0 ? { notIn: excludedSlotIds } : undefined,
      startsAt: {
        lt: requestedEndsAt,
      },
      endsAt: {
        gt: requestedStartsAt,
      },
    },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      capacity: true,
      status: true,
      serviceRestrictionMode: true,
      publicNote: true,
      internalNote: true,
      publishedAt: true,
      cancelledAt: true,
      createdByUserId: true,
      allowedServices: {
        select: {
          serviceId: true,
        },
      },
    },
    orderBy: [{ startsAt: "asc" }],
  });

  const possiblePublishedSlots = [requestedSlot, booking.slot, ...overlappingSlots]
    .filter((slot): slot is BookingSlotRecord => Boolean(slot))
    .filter(
      (slot, index, collection) =>
        collection.findIndex((candidate) => candidate.id === slot.id) === index,
    )
    .filter(
      (slot) =>
        slot.status === AvailabilitySlotStatus.PUBLISHED
        && requestedStartsAt >= slot.startsAt
        && requestedEndsAt <= slot.endsAt,
    );

  const blockingSlots = overlappingSlots.filter((slot) => slot.status !== AvailabilitySlotStatus.PUBLISHED);

  if (blockingSlots.length > 0) {
    throw new BookingRescheduleError(
      bookingRescheduleErrorCodes.conflict,
      "Nový termín zasahuje do interně blokovaného času.",
      "slot",
    );
  }

  let resolvedSlot: BookingSlotRecord | null = requestedSlot ?? possiblePublishedSlots[0] ?? null;
  let manualOverride = false;

  if (resolvedSlot) {
    if (!doesSlotSupportServiceDuration(resolvedSlot.startsAt, resolvedSlot.endsAt, booking.serviceDurationMinutes)) {
      throw new BookingRescheduleError(
        bookingRescheduleErrorCodes.slotTooShort,
        "Vybraný slot už neodpovídá délce služby.",
        "slot",
      );
    }

    if (requestedStartsAt < resolvedSlot.startsAt || requestedEndsAt > resolvedSlot.endsAt) {
      resolvedSlot = null;
      manualOverride = true;
    } else {
      const slotAllowsService = !(
        resolvedSlot.serviceRestrictionMode === AvailabilitySlotServiceRestrictionMode.SELECTED
        && !resolvedSlot.allowedServices.some((allowedService) => allowedService.serviceId === booking.serviceId)
      );
      const isPubliclyAvailable =
        resolvedSlot.status === AvailabilitySlotStatus.PUBLISHED
        && isWithinPublicWindow
        && slotAllowsService;

      if (!isPubliclyAvailable) {
        if (!slotAllowsService) {
          throw new BookingRescheduleError(
            bookingRescheduleErrorCodes.slotNotAllowed,
            "Vybraný slot není pro tuto službu dostupný.",
            "slot",
          );
        }

        manualOverride = true;
      }
    }
  } else {
    manualOverride = true;
  }

  const activeBookingCount = await tx.booking.count({
    where: {
      id: {
        not: booking.id,
      },
      status: {
        in: [...ACTIVE_BOOKING_STATUSES],
      },
      scheduledStartsAt: {
        lt: requestedEndsAt,
      },
      scheduledEndsAt: {
        gt: requestedStartsAt,
      },
      ...(manualOverride || !resolvedSlot
        ? {}
        : {
            slotId: resolvedSlot.id,
          }),
    },
  });

  const allowedCapacity = manualOverride || !resolvedSlot ? 1 : resolvedSlot.capacity;

  if (activeBookingCount >= allowedCapacity) {
    throw new BookingRescheduleError(
      bookingRescheduleErrorCodes.conflict,
      "Nový termín koliduje s jinou aktivní rezervací.",
      "slot",
    );
  }

  if (!resolvedSlot) {
    resolvedSlot = await tx.availabilitySlot.create({
      data: {
        startsAt: requestedStartsAt,
        endsAt: requestedEndsAt,
        capacity: EDITABLE_SLOT_CAPACITY,
        status: AvailabilitySlotStatus.DRAFT,
        serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
        internalNote: input.reason
          ? `Interní výjimka po přesunu: ${normalizeWhitespace(input.reason)}`
          : "Interní výjimka pro přesun rezervace.",
        createdByUserId: input.changedByUserId ?? null,
      },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        capacity: true,
        status: true,
        serviceRestrictionMode: true,
        publicNote: true,
        internalNote: true,
        publishedAt: true,
        cancelledAt: true,
        createdByUserId: true,
        allowedServices: {
          select: {
            serviceId: true,
          },
        },
      },
    });
  }

  if (resolvedSlot.status === AvailabilitySlotStatus.PUBLISHED) {
    await splitSlotForEditing(tx, resolvedSlot, requestedStartsAt, requestedEndsAt);
  }

  const normalizedReason = input.reason ? normalizeWhitespace(input.reason) : null;
  const rescheduledAt = new Date();

  await tx.booking.update({
    where: {
      id: booking.id,
    },
    data: {
      slotId: resolvedSlot.id,
      scheduledStartsAt: requestedStartsAt,
      scheduledEndsAt: requestedEndsAt,
      manualOverride,
      rescheduledAt,
      rescheduleCount: {
        increment: 1,
      },
      reminder24hQueuedAt: null,
      reminder24hSentAt: null,
    },
  });

  await tx.bookingRescheduleLog.create({
    data: {
      bookingId: booking.id,
      oldStartAt: booking.scheduledStartsAt,
      oldEndAt: booking.scheduledEndsAt,
      newStartAt: requestedStartsAt,
      newEndAt: requestedEndsAt,
      changedByUserId: input.changedByUserId,
      changedByClient: input.changedByClient ?? false,
      reason: normalizedReason,
    },
  });

  if (booking.manualOverride) {
    await maybeDeleteOrphanedManualOverrideSlot(tx, booking.slotId, booking.id);
  }

  return {
    bookingId: booking.id,
    serviceName: booking.serviceNameSnapshot,
    clientId: booking.clientId,
    clientName: booking.clientNameSnapshot,
    clientEmail: booking.clientEmailSnapshot,
    scheduledStartsAt: requestedStartsAt,
    scheduledEndsAt: requestedEndsAt,
    previousStartsAt: booking.scheduledStartsAt,
    previousEndsAt: booking.scheduledEndsAt,
    manualOverride,
    rescheduleCount: booking.rescheduleCount + 1,
  } satisfies RescheduleTransactionResult;
}

export async function rescheduleBooking(
  input: RescheduleBookingInput,
): Promise<RescheduleBookingResult> {
  const requestedStartsAt = new Date(input.newStartAt);

  if (Number.isNaN(requestedStartsAt.getTime())) {
    throw new BookingRescheduleError(
      bookingRescheduleErrorCodes.invalidDateTime,
      "Vyplňte platný nový datum a čas rezervace.",
      "newTime",
    );
  }

  for (let attempt = 1; attempt <= MAX_BOOKING_TRANSACTION_RETRIES; attempt += 1) {
    try {
      const transactionResult = await prisma.$transaction(
        async (tx) => rescheduleBookingInTransaction(tx, input, requestedStartsAt),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      let notificationStatus: RescheduleBookingResult["notificationStatus"] = "skipped";

      if (input.notifyClient && transactionResult.clientEmail.trim().length > 0) {
        try {
          notificationStatus = await queueBookingRescheduledNotification({
            bookingId: transactionResult.bookingId,
            clientId: transactionResult.clientId,
            clientEmail: transactionResult.clientEmail,
            clientName: transactionResult.clientName,
            serviceName: transactionResult.serviceName,
            previousStartsAt: transactionResult.previousStartsAt,
            previousEndsAt: transactionResult.previousEndsAt,
            scheduledStartsAt: transactionResult.scheduledStartsAt,
            scheduledEndsAt: transactionResult.scheduledEndsAt,
            includeCalendarAttachment: input.includeCalendarAttachment ?? true,
          });
        } catch (error) {
          notificationStatus = "failed";
          console.error("Booking reschedule notification enqueue failed", {
            bookingId: transactionResult.bookingId,
            error,
          });
        }
      }

      return {
        bookingId: transactionResult.bookingId,
        scheduledStartsAt: transactionResult.scheduledStartsAt.toISOString(),
        scheduledEndsAt: transactionResult.scheduledEndsAt.toISOString(),
        scheduledAtLabel: formatBookingDateLabel(
          transactionResult.scheduledStartsAt,
          transactionResult.scheduledEndsAt,
        ),
        previousScheduledAtLabel: formatBookingDateLabel(
          transactionResult.previousStartsAt,
          transactionResult.previousEndsAt,
        ),
        rescheduleCount: transactionResult.rescheduleCount,
        manualOverride: transactionResult.manualOverride,
        notificationStatus,
      };
    } catch (error) {
      if (error instanceof BookingRescheduleError) {
        throw error;
      }

      if (isRetryablePrismaError(error) && attempt < MAX_BOOKING_TRANSACTION_RETRIES) {
        continue;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        const mappedError = mapKnownPrismaError(error);

        if (mappedError) {
          throw mappedError;
        }
      }

      throw error;
    }
  }

  throw new BookingRescheduleError(
    bookingRescheduleErrorCodes.temporaryFailure,
    "Přesun se teď nepodařilo dokončit kvůli souběžné změně. Zkuste to prosím znovu.",
  );
}
