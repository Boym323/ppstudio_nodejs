import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  AvailabilitySlotStatus,
  BookingSource,
  BookingStatus,
} from "@prisma/client";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "change-me-owner";
process.env.ADMIN_STAFF_EMAIL ??= "staff@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "change-me-staff";
process.env.EMAIL_DELIVERY_MODE ??= "log";
process.env.PUSHOVER_ENABLED ??= "false";

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

async function loadModules() {
  const [{ prisma }, bookingModule] = await Promise.all([
    import("@/lib/prisma"),
    import("./booking-public"),
  ]);

  return {
    prisma,
    createManualBooking: bookingModule.createManualBooking,
    PublicBookingError: bookingModule.PublicBookingError,
    publicBookingErrorCodes: bookingModule.publicBookingErrorCodes,
  };
}

dbTest("createManualBooking rejects stale slot-mode booking instead of silently creating manual override", async () => {
  const {
    prisma,
    createManualBooking,
    PublicBookingError,
    publicBookingErrorCodes,
  } = await loadModules();

  const suffix = randomUUID().slice(0, 8);
  const startsAt = new Date("2027-05-12T09:30:00.000Z");
  const slotStartsAt = new Date("2027-05-12T09:00:00.000Z");
  const slotEndsAt = new Date("2027-05-12T10:00:00.000Z");

  const category = await prisma.serviceCategory.create({
    data: {
      name: `Manual booking category ${suffix}`,
      slug: `manual-booking-category-${suffix}`,
      isActive: true,
    },
    select: { id: true },
  });

  const service = await prisma.service.create({
    data: {
      categoryId: category.id,
      name: `Manual booking service ${suffix}`,
      slug: `manual-booking-service-${suffix}`,
      durationMinutes: 60,
      priceFromCzk: 1200,
      isActive: true,
      isPubliclyBookable: true,
    },
    select: { id: true },
  });

  const slot = await prisma.availabilitySlot.create({
    data: {
      startsAt: slotStartsAt,
      endsAt: slotEndsAt,
      status: AvailabilitySlotStatus.PUBLISHED,
      capacity: 1,
      serviceRestrictionMode: "ANY",
      publishedAt: new Date("2027-05-01T08:00:00.000Z"),
    },
    select: { id: true },
  });

  try {
    await assert.rejects(
      createManualBooking({
        serviceId: service.id,
        slotId: slot.id,
        allowManualOverride: false,
        startsAt: startsAt.toISOString(),
        fullName: `Klientka ${suffix}`,
        email: `manual-slot-${suffix}@example.com`,
        phone: "+420777123456",
        source: BookingSource.PHONE,
        status: BookingStatus.CONFIRMED,
        actorUserId: null,
        sendClientEmail: false,
        includeCalendarAttachment: false,
      }),
      (error: unknown) => {
        assert.ok(error instanceof PublicBookingError);
        assert.equal(error.code, publicBookingErrorCodes.slotTooShort);
        return true;
      },
    );

    const bookings = await prisma.booking.count({
      where: {
        serviceId: service.id,
      },
    });

    assert.equal(bookings, 0);
  } finally {
    await prisma.bookingActionToken.deleteMany({
      where: {
        booking: {
          serviceId: service.id,
        },
      },
    });
    await prisma.emailLog.deleteMany({
      where: {
        booking: {
          serviceId: service.id,
        },
      },
    });
    await prisma.bookingStatusHistory.deleteMany({
      where: {
        booking: {
          serviceId: service.id,
        },
      },
    });
    await prisma.booking.deleteMany({
      where: {
        serviceId: service.id,
      },
    });
    await prisma.availabilitySlot.deleteMany({
      where: {
        id: slot.id,
      },
    });
    await prisma.service.deleteMany({
      where: {
        id: service.id,
      },
    });
    await prisma.serviceCategory.deleteMany({
      where: {
        id: category.id,
      },
    });
  }
});

dbTest("createManualBooking still allows explicit manual override without slot selection", async () => {
  const { prisma, createManualBooking } = await loadModules();

  const suffix = randomUUID().slice(0, 8);
  const startsAt = new Date("2027-05-13T09:30:00.000Z");

  const category = await prisma.serviceCategory.create({
    data: {
      name: `Manual override category ${suffix}`,
      slug: `manual-override-category-${suffix}`,
      isActive: true,
    },
    select: { id: true },
  });

  const service = await prisma.service.create({
    data: {
      categoryId: category.id,
      name: `Manual override service ${suffix}`,
      slug: `manual-override-service-${suffix}`,
      durationMinutes: 60,
      priceFromCzk: 1200,
      isActive: true,
      isPubliclyBookable: true,
    },
    select: { id: true },
  });

  let bookingId: string | null = null;
  let createdSlotId: string | null = null;

  try {
    const result = await createManualBooking({
      serviceId: service.id,
      allowManualOverride: true,
      startsAt: startsAt.toISOString(),
      fullName: `Klientka override ${suffix}`,
      email: `manual-override-${suffix}@example.com`,
      phone: "+420777123456",
      source: BookingSource.PHONE,
      status: BookingStatus.CONFIRMED,
      actorUserId: null,
      sendClientEmail: false,
      includeCalendarAttachment: false,
    });

    bookingId = result.bookingId;
    assert.equal(result.manualOverride, true);

    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: result.bookingId },
      select: {
        manualOverride: true,
        isManual: true,
        slotId: true,
        slot: {
          select: {
            status: true,
          },
        },
      },
    });

    assert.equal(booking.manualOverride, true);
    assert.equal(booking.isManual, true);
    createdSlotId = booking.slotId;
    assert.equal(booking.slot.status, AvailabilitySlotStatus.DRAFT);
  } finally {
    if (bookingId) {
      await prisma.bookingActionToken.deleteMany({
        where: { bookingId },
      });
      await prisma.emailLog.deleteMany({
        where: { bookingId },
      });
      await prisma.bookingStatusHistory.deleteMany({
        where: { bookingId },
      });
      await prisma.booking.deleteMany({
        where: { id: bookingId },
      });
    }
    if (createdSlotId) {
      await prisma.availabilitySlot.deleteMany({
        where: {
          id: createdSlotId,
        },
      });
    }
    await prisma.service.deleteMany({
      where: {
        id: service.id,
      },
    });
    await prisma.serviceCategory.deleteMany({
      where: {
        id: category.id,
      },
    });
  }
});
