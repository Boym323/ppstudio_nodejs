import { AvailabilitySlotStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getBookingPolicySettings } from "@/lib/site-settings";

import {
  ACTIVE_BOOKING_STATUSES,
  type PublicBookingCatalog,
} from "./shared";

export async function getPublicBookingCatalog(): Promise<PublicBookingCatalog> {
  const now = new Date();
  const bookingPolicy = await getBookingPolicySettings();
  const bookingWindowStart = new Date(
    now.getTime() + bookingPolicy.minAdvanceHours * 60 * 60 * 1000,
  );
  const bookingWindowEnd = new Date(
    now.getTime() + bookingPolicy.maxAdvanceDays * 24 * 60 * 60 * 1000,
  );

  const [services, slots] = await Promise.all([
    prisma.service.findMany({
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
    }),
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
        bookings: {
          where: {
            status: {
              in: [...ACTIVE_BOOKING_STATUSES],
            },
          },
          select: {
            scheduledStartsAt: true,
            scheduledEndsAt: true,
          },
        },
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
    slots: slots
      .map((slot) => ({
        id: slot.id,
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        publicNote: slot.publicNote,
        capacity: slot.capacity,
        serviceRestrictionMode: slot.serviceRestrictionMode,
        allowedServiceIds: slot.allowedServices.map((allowedService) => allowedService.serviceId),
        bookedIntervals: slot.bookings.map((booking) => ({
          startsAt: booking.scheduledStartsAt.toISOString(),
          endsAt: booking.scheduledEndsAt.toISOString(),
        })),
      }))
      .filter((slot) => slot.capacity > 0),
  };
}
