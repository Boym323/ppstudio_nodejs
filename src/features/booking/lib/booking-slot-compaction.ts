import {
  AvailabilitySlotServiceRestrictionMode,
  AvailabilitySlotStatus,
  BookingStatus,
  Prisma,
} from "@/generated/prisma/client";

type MergeableSlotRecord = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: AvailabilitySlotStatus;
  capacity: number;
  publicNote: string | null;
  internalNote: string | null;
  serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode;
  publishedAt: Date | null;
  cancelledAt: Date | null;
  createdByUserId: string | null;
  allowedServices: Array<{ serviceId: string }>;
  bookings: Array<{ id: string; originalAvailabilityEndsAt: Date | null }>;
};

const mergeableEditableSlotConstraints = {
  capacity: 1,
  publicNote: null,
  internalNote: null,
  serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.ANY,
  allowedServices: {
    none: {},
  },
  bookings: {
    none: {
      status: {
        not: BookingStatus.CANCELLED,
      },
    },
  },
} satisfies Prisma.AvailabilitySlotWhereInput;

const cancelledBookingsOnlyWhere = {
  bookings: {
    none: {
      status: {
        not: BookingStatus.CANCELLED,
      },
    },
  },
} satisfies Prisma.AvailabilitySlotWhereInput;

const mergeablePublishedSlotWhere = {
  ...mergeableEditableSlotConstraints,
  status: AvailabilitySlotStatus.PUBLISHED,
} satisfies Prisma.AvailabilitySlotWhereInput;

const restorableCancelledSlotWhere = {
  ...cancelledBookingsOnlyWhere,
  status: {
    in: [AvailabilitySlotStatus.PUBLISHED, AvailabilitySlotStatus.ARCHIVED],
  },
} satisfies Prisma.AvailabilitySlotWhereInput;

const activeBookingStatuses = [BookingStatus.PENDING, BookingStatus.CONFIRMED] as const;

export function getRestorableSlotEnd(
  slotEndsAt: Date,
  bookings: Array<{ originalAvailabilityEndsAt: Date | null }>,
) {
  return bookings.reduce((latestEndsAt, booking) => {
    if (!booking.originalAvailabilityEndsAt || booking.originalAvailabilityEndsAt <= latestEndsAt) {
      return latestEndsAt;
    }

    return booking.originalAvailabilityEndsAt;
  }, slotEndsAt);
}

const mergeableEditableSlotSelect = {
  id: true,
  startsAt: true,
  endsAt: true,
  status: true,
  capacity: true,
  publicNote: true,
  internalNote: true,
  serviceRestrictionMode: true,
  publishedAt: true,
  cancelledAt: true,
  createdByUserId: true,
  allowedServices: {
    select: {
      serviceId: true,
    },
  },
  bookings: {
    select: {
      id: true,
      originalAvailabilityEndsAt: true,
    },
  },
} satisfies Prisma.AvailabilitySlotSelect;

async function findMergeableSlotById(tx: Prisma.TransactionClient, slotId: string) {
  return tx.availabilitySlot.findFirst({
    where: {
      id: slotId,
      ...mergeableEditableSlotConstraints,
      status: {
        in: [AvailabilitySlotStatus.PUBLISHED, AvailabilitySlotStatus.ARCHIVED],
      },
    },
    select: mergeableEditableSlotSelect,
  });
}

async function findRestorableCancelledSlotById(tx: Prisma.TransactionClient, slotId: string) {
  return tx.availabilitySlot.findFirst({
    where: {
      id: slotId,
      ...restorableCancelledSlotWhere,
    },
    select: mergeableEditableSlotSelect,
  });
}

async function restoreCancelledSlotIfArchived(
  tx: Prisma.TransactionClient,
  slot: MergeableSlotRecord,
) {
  if (slot.status !== AvailabilitySlotStatus.ARCHIVED) {
    return slot;
  }

  const restoredEndsAt = getRestorableSlotEnd(slot.endsAt, slot.bookings);

  const overlappingActiveSlots = await tx.availabilitySlot.findMany({
    where: {
      id: {
        not: slot.id,
      },
      status: {
        in: [AvailabilitySlotStatus.DRAFT, AvailabilitySlotStatus.PUBLISHED],
      },
      startsAt: {
        lt: restoredEndsAt,
      },
      endsAt: {
        gt: slot.startsAt,
      },
    },
    orderBy: {
      startsAt: "asc",
    },
    select: {
      startsAt: true,
      endsAt: true,
    },
  });

  const restoredIntervals: Array<{ startsAt: Date; endsAt: Date }> = [];
  let restoredStartsAt = slot.startsAt;

  for (const activeSlot of overlappingActiveSlots) {
    if (restoredStartsAt < activeSlot.startsAt) {
      restoredIntervals.push({
        startsAt: restoredStartsAt,
        endsAt: activeSlot.startsAt,
      });
    }
    if (activeSlot.endsAt > restoredStartsAt) {
      restoredStartsAt = activeSlot.endsAt;
    }
  }

  if (restoredStartsAt < restoredEndsAt) {
    restoredIntervals.push({
      startsAt: restoredStartsAt,
      endsAt: restoredEndsAt,
    });
  }

  const firstRestoredInterval = restoredIntervals.shift();

  if (!firstRestoredInterval) {
    return null;
  }

  await tx.availabilitySlot.update({
    where: {
      id: slot.id,
    },
    data: {
      status: AvailabilitySlotStatus.PUBLISHED,
      publishedAt: new Date(),
      startsAt: firstRestoredInterval.startsAt,
      endsAt: firstRestoredInterval.endsAt,
    },
  });

  for (const interval of restoredIntervals) {
    await tx.availabilitySlot.create({
      data: {
        startsAt: interval.startsAt,
        endsAt: interval.endsAt,
        capacity: slot.capacity,
        status: AvailabilitySlotStatus.PUBLISHED,
        publicNote: slot.publicNote,
        internalNote: slot.internalNote,
        serviceRestrictionMode: slot.serviceRestrictionMode,
        publishedAt: new Date(),
        createdByUserId: slot.createdByUserId,
        allowedServices: slot.allowedServices.length > 0
          ? {
              createMany: {
                data: slot.allowedServices.map(({ serviceId }) => ({ serviceId })),
              },
            }
          : undefined,
      },
    });
  }

  return {
    ...slot,
    status: AvailabilitySlotStatus.PUBLISHED,
    startsAt: firstRestoredInterval.startsAt,
    endsAt: firstRestoredInterval.endsAt,
  } satisfies MergeableSlotRecord;
}

async function findAdjacentMergeableSlot(
  tx: Prisma.TransactionClient,
  currentSlot: MergeableSlotRecord,
  direction: "left" | "right",
) {
  return tx.availabilitySlot.findFirst({
    where: {
      id: {
        not: currentSlot.id,
      },
      ...(direction === "left"
        ? {
            endsAt: currentSlot.startsAt,
          }
        : {
            startsAt: currentSlot.endsAt,
          }),
      ...mergeablePublishedSlotWhere,
    },
    orderBy: direction === "left"
      ? {
          startsAt: "desc",
        }
      : {
          startsAt: "asc",
        },
    select: mergeableEditableSlotSelect,
  });
}

async function mergeSlotsIntoAnchor(
  tx: Prisma.TransactionClient,
  anchorSlot: MergeableSlotRecord,
  adjacentSlot: MergeableSlotRecord,
  direction: "left" | "right",
) {
  if (adjacentSlot.bookings.length > 0) {
    await tx.booking.updateMany({
      where: {
        slotId: adjacentSlot.id,
      },
      data: {
        slotId: anchorSlot.id,
      },
    });
  }

  // Move the adjacent slot out of the active exclusion constraint set before
  // expanding the anchor across the same time range.
  await tx.availabilitySlot.update({
    where: {
      id: adjacentSlot.id,
    },
    data: {
      status: AvailabilitySlotStatus.ARCHIVED,
    },
  });

  await tx.availabilitySlot.update({
    where: {
      id: anchorSlot.id,
    },
    data: direction === "left"
      ? {
          startsAt: adjacentSlot.startsAt,
        }
      : {
          endsAt: adjacentSlot.endsAt,
        },
  });

  await tx.availabilitySlot.delete({
    where: {
      id: adjacentSlot.id,
    },
  });

  return {
    ...anchorSlot,
    startsAt: direction === "left" ? adjacentSlot.startsAt : anchorSlot.startsAt,
    endsAt: direction === "right" ? adjacentSlot.endsAt : anchorSlot.endsAt,
    bookings: [...anchorSlot.bookings, ...adjacentSlot.bookings],
    status: anchorSlot.status,
  } satisfies MergeableSlotRecord;
}

export async function compactAdjacentEditableSlotsForBooking(
  tx: Prisma.TransactionClient,
  slotId: string,
) {
  let anchorSlot = await findRestorableCancelledSlotById(tx, slotId);

  if (!anchorSlot) {
    return null;
  }

  const restoredAnchorSlot = await restoreCancelledSlotIfArchived(tx, anchorSlot);

  if (!restoredAnchorSlot) {
    return null;
  }

  anchorSlot = restoredAnchorSlot;

  // Obnovit lze i termín s vlastním omezením služby či poznámkou. Slučovat
  // ale smíme pouze čisté editovatelné intervaly, jinak bychom jeho pravidla
  // rozšířili na sousední volné termíny.
  const mergeableAnchorSlot = await findMergeableSlotById(tx, anchorSlot.id);

  if (!mergeableAnchorSlot) {
    return anchorSlot;
  }

  anchorSlot = mergeableAnchorSlot;

  while (true) {
    const leftSlot = await findAdjacentMergeableSlot(tx, anchorSlot, "left");

    if (!leftSlot) {
      break;
    }

    anchorSlot = await mergeSlotsIntoAnchor(tx, anchorSlot, leftSlot, "left");
  }

  while (true) {
    const rightSlot = await findAdjacentMergeableSlot(tx, anchorSlot, "right");

    if (!rightSlot) {
      break;
    }

    anchorSlot = await mergeSlotsIntoAnchor(tx, anchorSlot, rightSlot, "right");
  }

  return anchorSlot;
}

type ManualOverrideSlotRecord = Pick<
  MergeableSlotRecord,
  | "id"
  | "startsAt"
  | "endsAt"
  | "status"
  | "capacity"
  | "publicNote"
  | "internalNote"
  | "serviceRestrictionMode"
  | "publishedAt"
  | "cancelledAt"
  | "createdByUserId"
  | "allowedServices"
>;

function isPlainEditablePublishedSlot(slot: ManualOverrideSlotRecord) {
  return (
    slot.status === AvailabilitySlotStatus.PUBLISHED &&
    slot.capacity === 1 &&
    slot.publicNote === null &&
    slot.internalNote === null &&
    slot.serviceRestrictionMode === AvailabilitySlotServiceRestrictionMode.ANY &&
    slot.allowedServices.length === 0
  );
}

/**
 * Removes a manual-override interval from overlapping ordinary availability.
 * The original rows stay archived as lifecycle history so cancellation can
 * restore the exact pre-override interval through the existing compaction
 * path.
 */
export async function preparePublishedAvailabilityForManualOverride(
  tx: Prisma.TransactionClient,
  slots: ManualOverrideSlotRecord[],
  requestedStartsAt: Date,
  requestedEndsAt: Date,
  ignoredBookingId?: string,
) {
  const candidateSlots = slots
    .filter((slot, index, collection) => collection.findIndex((candidate) => candidate.id === slot.id) === index)
    .filter(
      (slot) =>
        slot.status === AvailabilitySlotStatus.PUBLISHED &&
        slot.startsAt < requestedEndsAt &&
        slot.endsAt > requestedStartsAt,
    )
    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());

  if (candidateSlots.length === 0) {
    return {
      archivedSlotIds: [] as string[],
      protectedSlotIds: [] as string[],
    };
  }

  // The callers already lock the whole requested availability range. Keep a
  // local lock here as well so this helper remains safe when reused directly.
  await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "AvailabilitySlot"
    WHERE "id" IN (${Prisma.join(candidateSlots.map((slot) => slot.id))})
    FOR UPDATE
  `);

  const slotsWithOtherActiveBookings = await tx.availabilitySlot.findMany({
    where: {
      id: {
        in: candidateSlots.map((slot) => slot.id),
      },
      bookings: {
        some: {
          id: ignoredBookingId ? { not: ignoredBookingId } : undefined,
          status: {
            not: BookingStatus.CANCELLED,
          },
        },
      },
    },
    select: {
      id: true,
    },
  });
  const slotsWithOtherActiveBookingIds = new Set(
    slotsWithOtherActiveBookings.map((slot) => slot.id),
  );

  const protectedSlotIds = candidateSlots
    .filter(
      (slot) =>
        !isPlainEditablePublishedSlot(slot) ||
        slotsWithOtherActiveBookingIds.has(slot.id),
    )
    .map((slot) => slot.id);

  if (protectedSlotIds.length > 0) {
    return {
      archivedSlotIds: [] as string[],
      protectedSlotIds,
    };
  }

  for (const slot of candidateSlots) {
    const leftInterval = slot.startsAt < requestedStartsAt
      ? { startsAt: slot.startsAt, endsAt: requestedStartsAt }
      : null;
    const rightInterval = requestedEndsAt < slot.endsAt
      ? { startsAt: requestedEndsAt, endsAt: slot.endsAt }
      : null;

    // Move the original row out of the exclusion constraint before writing
    // either edge fragment or the new DRAFT override.
    await tx.availabilitySlot.update({
      where: {
        id: slot.id,
      },
      data: {
        status: AvailabilitySlotStatus.ARCHIVED,
      },
    });

    for (const interval of [leftInterval, rightInterval]) {
      if (!interval || interval.startsAt >= interval.endsAt) {
        continue;
      }

      await tx.availabilitySlot.create({
        data: {
          startsAt: interval.startsAt,
          endsAt: interval.endsAt,
          capacity: slot.capacity,
          status: AvailabilitySlotStatus.PUBLISHED,
          publicNote: slot.publicNote,
          internalNote: slot.internalNote,
          serviceRestrictionMode: slot.serviceRestrictionMode,
          publishedAt: slot.publishedAt,
          cancelledAt: slot.cancelledAt,
          createdByUserId: slot.createdByUserId,
          allowedServices: slot.allowedServices.length > 0
            ? {
                createMany: {
                  data: slot.allowedServices.map(({ serviceId }) => ({ serviceId })),
                },
              }
            : undefined,
        },
      });
    }
  }

  return {
    archivedSlotIds: candidateSlots.map((slot) => slot.id),
    protectedSlotIds: [] as string[],
  };
}

export async function restoreArchivedSlotAroundManualOverride(
  tx: Prisma.TransactionClient,
  slotId: string,
  manualOverrideSlotId: string,
) {
  void manualOverrideSlotId;
  const archivedSlot = await findRestorableCancelledSlotById(tx, slotId);

  if (!archivedSlot || archivedSlot.status !== AvailabilitySlotStatus.ARCHIVED) {
    return null;
  }

  // Historický slot musí zůstat vcelku. Jeho zkrácení na první volný fragment
  // by při pozdějším odstranění DRAFT override nenávratně ztratilo jeho střed.
  const restorationSlot = await tx.availabilitySlot.create({
    data: {
      startsAt: archivedSlot.startsAt,
      endsAt: archivedSlot.endsAt,
      capacity: archivedSlot.capacity,
      status: AvailabilitySlotStatus.ARCHIVED,
      publicNote: archivedSlot.publicNote,
      internalNote: archivedSlot.internalNote,
      serviceRestrictionMode: archivedSlot.serviceRestrictionMode,
      createdByUserId: archivedSlot.createdByUserId,
      allowedServices: archivedSlot.allowedServices.length > 0
        ? {
            createMany: {
              data: archivedSlot.allowedServices.map(({ serviceId }) => ({ serviceId })),
            },
          }
        : undefined,
    },
    select: {
      id: true,
    },
  });

  return compactAdjacentEditableSlotsForBooking(tx, restorationSlot.id);
}

export async function archiveOrphanedManualOverrideSlotAfterCancellation(
  tx: Prisma.TransactionClient,
  slotId: string,
) {
  const slot = await tx.availabilitySlot.findFirst({
    where: {
      id: slotId,
      status: AvailabilitySlotStatus.DRAFT,
      bookings: {
        none: {
          status: {
            in: [...activeBookingStatuses],
          },
        },
      },
    },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
    },
  });

  if (!slot) {
    return null;
  }

  await tx.availabilitySlot.update({
    where: {
      id: slot.id,
    },
    data: {
      status: AvailabilitySlotStatus.ARCHIVED,
    },
  });

  const archivedSlots = await tx.availabilitySlot.findMany({
    where: {
      id: {
        not: slot.id,
      },
      ...restorableCancelledSlotWhere,
      status: AvailabilitySlotStatus.ARCHIVED,
      startsAt: {
        lt: slot.endsAt,
      },
      endsAt: {
        gt: slot.startsAt,
      },
    },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
    },
  });

  for (const archivedSlot of archivedSlots) {
    await compactAdjacentEditableSlotsForBooking(tx, archivedSlot.id);
  }

  return slot;
}
