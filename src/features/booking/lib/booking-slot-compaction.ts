import {
  AvailabilitySlotServiceRestrictionMode,
  AvailabilitySlotStatus,
  BookingStatus,
  type Prisma,
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
  createdByUserId: string | null;
  allowedServices: Array<{ serviceId: string }>;
  bookings: Array<{ id: string; blockedUntil: Date | null }>;
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

const mergeableEditableSlotSelect = {
  id: true,
  startsAt: true,
  endsAt: true,
  status: true,
  capacity: true,
  publicNote: true,
  internalNote: true,
  serviceRestrictionMode: true,
  createdByUserId: true,
  allowedServices: {
    select: {
      serviceId: true,
    },
  },
  bookings: {
    select: {
      id: true,
      blockedUntil: true,
    },
  },
} satisfies Prisma.AvailabilitySlotSelect;

function overlaps(
  leftStartsAt: Date,
  leftEndsAt: Date,
  rightStartsAt: Date,
  rightEndsAt: Date,
) {
  return leftStartsAt < rightEndsAt && leftEndsAt > rightStartsAt;
}

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

  const restoredEndsAt = slot.bookings.reduce((latestEndsAt, booking) => {
    if (!booking.blockedUntil || booking.blockedUntil <= latestEndsAt) {
      return latestEndsAt;
    }

    return booking.blockedUntil;
  }, slot.endsAt);

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

export async function restoreArchivedSlotAroundManualOverride(
  tx: Prisma.TransactionClient,
  slotId: string,
  manualOverrideSlotId: string,
) {
  const archivedSlot = await findRestorableCancelledSlotById(tx, slotId);

  if (!archivedSlot || archivedSlot.status !== AvailabilitySlotStatus.ARCHIVED) {
    return null;
  }

  const manualOverrideSlot = await tx.availabilitySlot.findUnique({
    where: {
      id: manualOverrideSlotId,
    },
    select: {
      startsAt: true,
      endsAt: true,
      status: true,
    },
  });

  if (
    !manualOverrideSlot
    || manualOverrideSlot.status !== AvailabilitySlotStatus.DRAFT
    || !overlaps(
      archivedSlot.startsAt,
      archivedSlot.endsAt,
      manualOverrideSlot.startsAt,
      manualOverrideSlot.endsAt,
    )
  ) {
    return compactAdjacentEditableSlotsForBooking(tx, slotId);
  }

  const otherOverlappingActiveSlot = await tx.availabilitySlot.findFirst({
    where: {
      id: {
        notIn: [archivedSlot.id, manualOverrideSlotId],
      },
      status: {
        in: [AvailabilitySlotStatus.DRAFT, AvailabilitySlotStatus.PUBLISHED],
      },
      startsAt: {
        lt: archivedSlot.endsAt,
      },
      endsAt: {
        gt: archivedSlot.startsAt,
      },
    },
    select: {
      id: true,
    },
  });

  if (otherOverlappingActiveSlot) {
    return null;
  }

  const restoredIntervals = [
    archivedSlot.startsAt < manualOverrideSlot.startsAt
      ? {
          startsAt: archivedSlot.startsAt,
          endsAt: manualOverrideSlot.startsAt,
        }
      : null,
    manualOverrideSlot.endsAt < archivedSlot.endsAt
      ? {
          startsAt: manualOverrideSlot.endsAt,
          endsAt: archivedSlot.endsAt,
        }
      : null,
  ].filter((interval): interval is { startsAt: Date; endsAt: Date } => Boolean(interval));

  const firstInterval = restoredIntervals.shift();

  if (!firstInterval) {
    return null;
  }

  await tx.availabilitySlot.update({
    where: {
      id: archivedSlot.id,
    },
    data: {
      startsAt: firstInterval.startsAt,
      endsAt: firstInterval.endsAt,
      status: AvailabilitySlotStatus.PUBLISHED,
      publishedAt: new Date(),
    },
  });

  const restoredSlotIds = [archivedSlot.id];

  for (const interval of restoredIntervals) {
    const restoredSlot = await tx.availabilitySlot.create({
      data: {
        startsAt: interval.startsAt,
        endsAt: interval.endsAt,
        capacity: archivedSlot.capacity,
        status: AvailabilitySlotStatus.PUBLISHED,
        publicNote: archivedSlot.publicNote,
        internalNote: archivedSlot.internalNote,
        serviceRestrictionMode: archivedSlot.serviceRestrictionMode,
        publishedAt: new Date(),
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
    restoredSlotIds.push(restoredSlot.id);
  }

  const compactedSlots = [];

  for (const restoredSlotId of restoredSlotIds) {
    const compactedSlot = await compactAdjacentEditableSlotsForBooking(tx, restoredSlotId);

    if (compactedSlot) {
      compactedSlots.push(compactedSlot);
    }
  }

  return compactedSlots;
}
