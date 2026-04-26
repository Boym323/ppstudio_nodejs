import {
  AvailabilitySlotServiceRestrictionMode,
  AvailabilitySlotStatus,
} from "@prisma/client";

type BookingIntervalRecord = {
  startsAt: Date;
  endsAt: Date;
};

type SlotRestrictionRecord = {
  serviceId: string;
};

type CatalogSlotRecord = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  publicNote: string | null;
  capacity: number;
  serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode;
  allowedServiceIds: string[];
};

export type PublicCatalogSlot = {
  id: string;
  startsAt: string;
  endsAt: string;
  publicNote: string | null;
  capacity: number;
  serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode;
  allowedServiceIds: string[];
  bookedIntervals: Array<{
    startsAt: string;
    endsAt: string;
  }>;
  segments?: Array<{
    id: string;
    startsAt: string;
    endsAt: string;
  }>;
};

export type PublishedCoverageSlot = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  status: AvailabilitySlotStatus;
  serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode;
  allowedServices: SlotRestrictionRecord[];
};

function overlaps(
  leftStart: Date,
  leftEnd: Date,
  rightStart: Date,
  rightEnd: Date,
) {
  return leftStart < rightEnd && leftEnd > rightStart;
}

function areDateValuesEqual(left: Date, right: Date) {
  return left.getTime() === right.getTime();
}

function areAllowedServiceIdsEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function sortAllowedServiceIds(serviceIds: string[]) {
  return [...serviceIds].sort((left, right) => left.localeCompare(right));
}

function canMergeCatalogSlots(current: CatalogSlotRecord, next: CatalogSlotRecord) {
  return (
    areDateValuesEqual(current.endsAt, next.startsAt) &&
    current.capacity === next.capacity &&
    current.publicNote === next.publicNote &&
    current.serviceRestrictionMode === next.serviceRestrictionMode &&
    areAllowedServiceIdsEqual(current.allowedServiceIds, next.allowedServiceIds)
  );
}

export function buildMergedPublicCatalogSlots(
  slots: CatalogSlotRecord[],
  bookings: BookingIntervalRecord[],
): PublicCatalogSlot[] {
  const normalizedSlots = slots
    .map((slot) => ({
      ...slot,
      allowedServiceIds: sortAllowedServiceIds(slot.allowedServiceIds),
    }))
    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());
  const merged: Array<{
    slot: CatalogSlotRecord;
    segments: Array<{
      id: string;
      startsAt: Date;
      endsAt: Date;
    }>;
  }> = [];

  for (const slot of normalizedSlots) {
    const current = merged.at(-1);

    if (current && canMergeCatalogSlots(current.slot, slot)) {
      current.slot = {
        ...current.slot,
        endsAt: slot.endsAt,
      };
      current.segments.push({
        id: slot.id,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
      });
      continue;
    }

    merged.push({
      slot: { ...slot },
      segments: [{
        id: slot.id,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
      }],
    });
  }

  return merged
    .map(({ slot, segments }) => {
      const bookedIntervals = bookings
        .filter((booking) => overlaps(slot.startsAt, slot.endsAt, booking.startsAt, booking.endsAt))
        .map((booking) => ({
          startsAt: booking.startsAt.toISOString(),
          endsAt: booking.endsAt.toISOString(),
        }));

      return {
        id: slot.id,
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        publicNote: slot.publicNote,
        capacity: slot.capacity,
        serviceRestrictionMode: slot.serviceRestrictionMode,
        allowedServiceIds: slot.allowedServiceIds,
        bookedIntervals,
        segments: segments.length > 1
          ? segments.map((segment) => ({
              id: segment.id,
              startsAt: segment.startsAt.toISOString(),
              endsAt: segment.endsAt.toISOString(),
            }))
          : undefined,
      } satisfies PublicCatalogSlot;
    })
    .filter((slot) => slot.capacity > 0);
}

export function slotAllowsService(
  slot: Pick<PublishedCoverageSlot, "serviceRestrictionMode" | "allowedServices">,
  serviceId: string,
) {
  return !(
    slot.serviceRestrictionMode === AvailabilitySlotServiceRestrictionMode.SELECTED &&
    !slot.allowedServices.some((allowedService) => allowedService.serviceId === serviceId)
  );
}

export function resolvePublishedSlotCoverage<T extends PublishedCoverageSlot>(
  slots: T[],
  serviceId: string,
  requestedStartsAt: Date,
  requestedEndsAt: Date,
  preferredSlotId?: string,
) {
  const publishedSlots = slots
    .filter((slot) => slot.status === AvailabilitySlotStatus.PUBLISHED)
    .filter((slot) => slotAllowsService(slot, serviceId))
    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());

  const anchorCandidates = preferredSlotId
    ? publishedSlots.filter((slot) => slot.id === preferredSlotId)
    : publishedSlots.filter(
        (slot) => requestedStartsAt >= slot.startsAt && requestedStartsAt < slot.endsAt,
      );

  for (const anchor of anchorCandidates) {
    if (requestedStartsAt < anchor.startsAt || requestedStartsAt >= anchor.endsAt) {
      continue;
    }

    const coverage = [anchor];
    let coveredUntil = anchor.endsAt;

    while (coveredUntil < requestedEndsAt) {
      const nextSlot = publishedSlots.find(
        (slot) =>
          !coverage.some((coveredSlot) => coveredSlot.id === slot.id) &&
          areDateValuesEqual(slot.startsAt, coveredUntil),
      );

      if (!nextSlot) {
        coverage.length = 0;
        break;
      }

      coverage.push(nextSlot);
      coveredUntil = nextSlot.endsAt;
    }

    if (coverage.length > 0 && coveredUntil >= requestedEndsAt) {
      return {
        anchor,
        coverage,
      };
    }
  }

  return null;
}
