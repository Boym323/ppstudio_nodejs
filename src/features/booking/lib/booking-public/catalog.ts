import { AvailabilitySlotStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getBookingPolicySettings } from "@/lib/site-settings";

import {
  ACTIVE_BOOKING_STATUSES,
  type PublicBookingCatalog,
} from "./shared";
import { buildMergedPublicCatalogSlots } from "../booking-slot-availability";

type PublicBookingCatalogOptions = {
  includeServices?: boolean;
};

export async function getPublicBookingCatalog(
  options: PublicBookingCatalogOptions = {},
): Promise<PublicBookingCatalog> {
  const includeServices = options.includeServices ?? true;
  const now = new Date();
  const bookingPolicy = await getBookingPolicySettings();
  const bookingWindowStart = new Date(
    now.getTime() + bookingPolicy.minAdvanceHours * 60 * 60 * 1000,
  );
  const bookingWindowEnd = new Date(
    now.getTime() + bookingPolicy.maxAdvanceDays * 24 * 60 * 60 * 1000,
  );

  const [services, slots, bookings] = await Promise.all([
    includeServices
      ? prisma.service.findMany({
          where: {
            isActive: true,
            isPubliclyBookable: true,
            category: {
              is: {
                isActive: true,
              },
            },
          },
          orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            slug: true,
            publicIntro: true,
            durationMinutes: true,
            priceFromCzk: true,
            category: {
              select: {
                name: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    prisma.availabilitySlot.findMany({
      where: {
        status: AvailabilitySlotStatus.PUBLISHED,
        startsAt: {
          gte: bookingWindowStart,
          lte: bookingWindowEnd,
        },
      },
      orderBy: [{ startsAt: "asc" }],
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        publicNote: true,
        capacity: true,
        serviceRestrictionMode: true,
        allowedServices: {
          select: {
            serviceId: true,
          },
        },
      },
    }),
    prisma.booking.findMany({
      where: {
        status: {
          in: [...ACTIVE_BOOKING_STATUSES],
        },
        scheduledStartsAt: {
          lt: bookingWindowEnd,
        },
        scheduledEndsAt: {
          gt: bookingWindowStart,
        },
      },
      select: {
        scheduledStartsAt: true,
        scheduledEndsAt: true,
      },
    }),
  ]);

  return {
    services: services.map((service) => ({
      id: service.id,
      categoryName: service.category.name,
      name: service.name,
      slug: service.slug,
      shortDescription: service.publicIntro,
      durationMinutes: service.durationMinutes,
      priceFromCzk: service.priceFromCzk,
    })),
    slots: buildMergedPublicCatalogSlots(
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
        endsAt: booking.scheduledEndsAt,
      })),
    ),
  };
}
