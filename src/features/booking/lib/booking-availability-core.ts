import {
  AvailabilitySlotServiceRestrictionMode,
  AvailabilitySlotStatus,
  type Prisma,
} from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

import {
  MAX_SERVICE_CLEANUP_MINUTES,
  roundUpToQuarterHour,
} from "./booking-cleanup";
import { loadAutoLunchPolicySnapshot } from "./booking-auto-lunch-policy";
import { getPragueLocalDate } from "./booking-local-time";
import { buildMergedAvailabilityCatalogSlots } from "./booking-slot-availability";
import { ACTIVE_BOOKING_STATUSES } from "./booking-availability-shared";

export type BookingAvailabilityCatalog = {
  services: Array<{
    id: string;
    categoryName: string;
    name: string;
    slug: string;
    shortDescription: string | null;
    durationMinutes: number;
    cleanupBlockMinutes: number;
    priceFromCzk: number | null;
  }>;
  slots: ReturnType<typeof buildMergedAvailabilityCatalogSlots>;
  scheduleOptimization: {
    globalAutoLunchEnabled: boolean;
    dayLunchModes: Record<string, "AUTO" | "OFF">;
    publishedAvailability: Array<{
      startsAt: string;
      endsAt: string;
    }>;
    bookedIntervals: Array<{
      startsAt: string;
      endsAt: string;
    }>;
    serviceBlockOptions?: Array<{
      id: string;
      durationMinutes: number;
      cleanupBlockMinutes: number;
    }>;
    supportsServiceAwareOrphans?: boolean;
  };
};

export type BookingAvailabilityCatalogOptions = {
  includeServices: boolean;
  excludeBookingId?: string;
  bookingWindowStart: Date;
  bookingWindowEnd: Date;
  availabilitySlotStatus: AvailabilitySlotStatus;
  serviceWhere: Prisma.ServiceWhereInput;
};

export async function getBookingAvailabilityCatalog({
  includeServices,
  excludeBookingId,
  bookingWindowStart,
  bookingWindowEnd,
  availabilitySlotStatus,
  serviceWhere,
}: BookingAvailabilityCatalogOptions): Promise<BookingAvailabilityCatalog> {
  const bookingConflictWindowEnd = new Date(
    bookingWindowEnd.getTime() + MAX_SERVICE_CLEANUP_MINUTES * 60 * 1000,
  );

  const [services, slots, bookings, cleanupAggregate] = await Promise.all([
    includeServices
      ? prisma.service.findMany({
          where: serviceWhere,
          orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            publicName: true,
            slug: true,
            publicIntro: true,
            durationMinutes: true,
            cleanupMinutes: true,
            priceFromCzk: true,
            category: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    prisma.availabilitySlot.findMany({
      where: {
        status: availabilitySlotStatus,
        startsAt: { gte: bookingWindowStart, lte: bookingWindowEnd },
      },
      orderBy: [{ startsAt: "asc" }],
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        publicNote: true,
        capacity: true,
        serviceRestrictionMode: true,
        allowedServices: { select: { serviceId: true } },
      },
    }),
    prisma.booking.findMany({
      where: {
        id: excludeBookingId ? { not: excludeBookingId } : undefined,
        status: { in: [...ACTIVE_BOOKING_STATUSES] },
        scheduledStartsAt: { lt: bookingConflictWindowEnd },
        OR: [
          { blockedUntil: { gt: bookingWindowStart } },
          { blockedUntil: null, scheduledEndsAt: { gt: bookingWindowStart } },
        ],
      },
      select: { scheduledStartsAt: true, scheduledEndsAt: true, blockedUntil: true },
    }),
    prisma.service.aggregate({ where: serviceWhere, _max: { cleanupMinutes: true } }),
  ]);

  const bookingLookaheadMinutes = roundUpToQuarterHour(
    cleanupAggregate._max.cleanupMinutes ?? 0,
  );
  const bookedIntervals = bookings.map((booking) => ({
    startsAt: booking.scheduledStartsAt.toISOString(),
    endsAt: (booking.blockedUntil ?? booking.scheduledEndsAt).toISOString(),
  }));
  const autoLunchPolicy = await loadAutoLunchPolicySnapshot(
    prisma,
    slots.map((slot) => getPragueLocalDate(slot.startsAt)),
  );

  return {
    services: services.flatMap((service) => service.category ? [{
      id: service.id,
      categoryName: service.category.name,
      name: service.publicName || service.name,
      slug: service.slug,
      shortDescription: service.publicIntro,
      durationMinutes: service.durationMinutes,
      cleanupBlockMinutes: roundUpToQuarterHour(service.cleanupMinutes),
      priceFromCzk: service.priceFromCzk,
    }] : []),
    slots: buildMergedAvailabilityCatalogSlots(
      slots.map((slot) => ({
        id: slot.id,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        publicNote: slot.publicNote,
        capacity: slot.capacity,
        serviceRestrictionMode: slot.serviceRestrictionMode,
        allowedServiceIds: slot.allowedServices.map((allowedService) => allowedService.serviceId),
      })),
      bookings.map((booking) => ({
        startsAt: booking.scheduledStartsAt,
        endsAt: booking.blockedUntil ?? booking.scheduledEndsAt,
      })),
      bookingLookaheadMinutes,
    ),
    scheduleOptimization: {
      ...autoLunchPolicy,
      publishedAvailability: slots.map((slot) => ({
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
      })),
      bookedIntervals,
      serviceBlockOptions: services.map((service) => ({
        id: service.id,
        durationMinutes: service.durationMinutes,
        cleanupBlockMinutes: roundUpToQuarterHour(service.cleanupMinutes),
      })),
      supportsServiceAwareOrphans: slots.every(
        (slot) => slot.serviceRestrictionMode === AvailabilitySlotServiceRestrictionMode.ANY,
      ),
    },
  };
}
