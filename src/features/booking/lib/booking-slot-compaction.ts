import {
  AvailabilitySlotServiceRestrictionMode,
  AvailabilitySlotStatus,
  BookingStatus,
  type Prisma,
} from "@prisma/client";

type MergeableSlotRecord = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: AvailabilitySlotStatus;
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

const mergeablePublishedSlotWhere = {
  ...mergeableEditableSlotConstraints,
  status: AvailabilitySlotStatus.PUBLISHED,
} satisfies Prisma.AvailabilitySlotWhereInput;

const restorableCancelledSlotWhere = {
  ...mergeableEditableSlotConstraints,
  status: {
    in: [AvailabilitySlotStatus.PUBLISHED, AvailabilitySlotStatus.ARCHIVED],
  },
} satisfies Prisma.AvailabilitySlotWhereInput;

const mergeableEditableSlotSelect = {
  id: true,
  startsAt: true,
  endsAt: true,
  status: true,
  bookings: {
    select: {
      id: true,
      blockedUntil: true,
    },
  },
} satisfies Prisma.AvailabilitySlotSelect;

async function findMergeableSlotById(tx: Prisma.TransactionClient, slotId: string) {
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

  const overlappingActiveSlot = await tx.availabilitySlot.findFirst({
    where: {
      id: {
        not: slot.id,
      },
      status: {
        in: [AvailabilitySlotStatus.DRAFT, AvailabilitySlotStatus.PUBLISHED],
      },
      startsAt: {
        lt: slot.endsAt,
      },
      endsAt: {
        gt: slot.startsAt,
      },
    },
    select: {
      id: true,
    },
  });

  if (overlappingActiveSlot) {
    return null;
  }

  const restoredEndsAt = slot.bookings.reduce((latestEndsAt, booking) => {
    if (!booking.blockedUntil || booking.blockedUntil <= latestEndsAt) {
      return latestEndsAt;
    }

    return booking.blockedUntil;
  }, slot.endsAt);

  await tx.availabilitySlot.update({
    where: {
      id: slot.id,
    },
    data: {
      status: AvailabilitySlotStatus.PUBLISHED,
      publishedAt: new Date(),
      endsAt: restoredEndsAt,
    },
  });

  return {
    ...slot,
    status: AvailabilitySlotStatus.PUBLISHED,
    endsAt: restoredEndsAt,
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
  let anchorSlot = await findMergeableSlotById(tx, slotId);

  if (!anchorSlot) {
    return null;
  }

  const restoredAnchorSlot = await restoreCancelledSlotIfArchived(tx, anchorSlot);

  if (!restoredAnchorSlot) {
    return null;
  }

  anchorSlot = restoredAnchorSlot;

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
