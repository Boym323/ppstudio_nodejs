import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { BookingAcquisitionSource } from "@prisma/client";

(process.env as Record<string, string | undefined>).NODE_ENV = "test";
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
    createPublicBooking: bookingModule.createPublicBooking,
    getPublicBookingCatalog: bookingModule.getPublicBookingCatalog,
    PublicBookingError: bookingModule.PublicBookingError,
    publicBookingErrorCodes: bookingModule.publicBookingErrorCodes,
  };
}

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

async function findIsolatedPublicQuerySlotStart(
  prisma: Awaited<typeof import("@/lib/prisma")>["prisma"],
  seed: string,
  durationMinutes: number,
  minimumDayOffset = 5,
) {
  const daySeed = Number.parseInt(seed.slice(0, 4), 16);
  const hourSeed = Number.parseInt(seed.slice(4, 6), 16);
  const minuteSeed = Number.parseInt(seed.slice(6, 8), 16);
  const hourCandidates = [9, 10, 11, 12, 13].map(
    (hour, index, list) => list[(index + hourSeed) % list.length] ?? hour,
  );
  const minuteCandidates = [0, 15, 30].map(
    (minute, index, list) => list[(index + minuteSeed) % list.length] ?? minute,
  );

  for (let dayStep = 0; dayStep < 45; dayStep += 1) {
    const dayOffset = minimumDayOffset + ((daySeed + dayStep) % 45);

    for (const hour of hourCandidates) {
      for (const minute of minuteCandidates) {
        const startsAt = addDays(new Date(), dayOffset);
        startsAt.setUTCSeconds(0, 0);
        startsAt.setUTCHours(hour, minute, 0, 0);
        const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);

        const overlappingSlots = await prisma.availabilitySlot.count({
          where: {
            startsAt: { lt: endsAt },
            endsAt: { gt: startsAt },
          },
        });

        if (overlappingSlots === 0) {
          return { startsAt, endsAt };
        }
      }
    }
  }

  throw new Error("Nepodařilo se najít izolované testovací okno pro booking-public-query integrační test.");
}

dbTest("getPublicBookingCatalog exposes only active publicly bookable services", async () => {
  const { prisma, getPublicBookingCatalog } = await loadModules();
  const suffix = randomUUID().slice(0, 8);

  const category = await prisma.serviceCategory.create({
    data: {
      name: `Booking query category ${suffix}`,
      slug: `booking-query-category-${suffix}`,
      isActive: true,
    },
    select: { id: true },
  });

  const createdServices = await prisma.service.createManyAndReturn({
    data: [
      {
        categoryId: category.id,
        name: `Booking query public ${suffix}`,
        publicName: `Booking query public ${suffix}`,
        slug: `booking-query-public-${suffix}`,
        durationMinutes: 60,
        priceFromCzk: 1200,
        isActive: true,
        isPubliclyBookable: true,
      },
      {
        categoryId: category.id,
        name: `Booking query inactive ${suffix}`,
        publicName: `Booking query inactive ${suffix}`,
        slug: `booking-query-inactive-${suffix}`,
        durationMinutes: 60,
        priceFromCzk: 1200,
        isActive: false,
        isPubliclyBookable: true,
      },
      {
        categoryId: category.id,
        name: `Booking query private ${suffix}`,
        publicName: `Booking query private ${suffix}`,
        slug: `booking-query-private-${suffix}`,
        durationMinutes: 60,
        priceFromCzk: 1200,
        isActive: true,
        isPubliclyBookable: false,
      },
    ],
    select: { id: true, slug: true },
  });

  try {
    const catalog = await getPublicBookingCatalog();
    const serviceSlugs = catalog.services.map((service) => service.slug);

    assert.deepEqual(serviceSlugs.filter((slug) => slug.includes(suffix)), [
      `booking-query-public-${suffix}`,
    ]);
  } finally {
    await prisma.service.deleteMany({
      where: {
        id: {
          in: createdServices.map((service) => service.id),
        },
      },
    });
    await prisma.serviceCategory.delete({ where: { id: category.id } });
  }
});

dbTest("getPublicBookingCatalog can exclude the managed booking from booked intervals", async () => {
  const { prisma, getPublicBookingCatalog } = await loadModules();
  const suffix = randomUUID().slice(0, 8);

  const category = await prisma.serviceCategory.create({
    data: {
      name: `Booking query exclude category ${suffix}`,
      slug: `booking-query-exclude-category-${suffix}`,
      isActive: true,
    },
    select: { id: true },
  });
  const service = await prisma.service.create({
    data: {
      categoryId: category.id,
      name: `Booking query exclude ${suffix}`,
      slug: `booking-query-exclude-${suffix}`,
      durationMinutes: 60,
      isActive: true,
      isPubliclyBookable: true,
    },
    select: { id: true },
  });
  const client = await prisma.client.create({
    data: {
      fullName: `Klientka exclude ${suffix}`,
      email: `booking-query-exclude-${suffix}@example.com`,
      phone: "+420777123456",
      isActive: true,
    },
    select: { id: true },
  });

  const { startsAt, endsAt } = await findIsolatedPublicQuerySlotStart(prisma, suffix, 120, 6);
  const bookingStartsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
  const bookingEndsAt = new Date(bookingStartsAt.getTime() + 60 * 60 * 1000);

  const slot = await prisma.availabilitySlot.create({
    data: {
      startsAt,
      endsAt,
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
    select: { id: true },
  });
  const booking = await prisma.booking.create({
    data: {
      clientId: client.id,
      slotId: slot.id,
      serviceId: service.id,
      status: "CONFIRMED",
      clientNameSnapshot: `Klientka exclude ${suffix}`,
      clientEmailSnapshot: `booking-query-exclude-${suffix}@example.com`,
      clientPhoneSnapshot: "+420777123456",
      serviceNameSnapshot: `Booking query exclude ${suffix}`,
      serviceDurationMinutes: 60,
      scheduledStartsAt: bookingStartsAt,
      scheduledEndsAt: bookingEndsAt,
      confirmedAt: new Date(),
    },
    select: { id: true },
  });

  try {
    const regularCatalog = await getPublicBookingCatalog({ includeServices: false });
    const excludedCatalog = await getPublicBookingCatalog({
      includeServices: false,
      excludeBookingId: booking.id,
    });

    const regularSlot = regularCatalog.slots.find(
      (catalogSlot) =>
        catalogSlot.id === slot.id
        || catalogSlot.segments?.some((segment) => segment.id === slot.id),
    );
    const excludedSlot = excludedCatalog.slots.find(
      (catalogSlot) =>
        catalogSlot.id === slot.id
        || catalogSlot.segments?.some((segment) => segment.id === slot.id),
    );

    assert.ok(regularSlot?.bookedIntervals.some(
      (interval) =>
        interval.startsAt === bookingStartsAt.toISOString()
        && interval.endsAt === bookingEndsAt.toISOString(),
    ));
    assert.equal(excludedSlot?.bookedIntervals.some(
      (interval) =>
        interval.startsAt === bookingStartsAt.toISOString()
        && interval.endsAt === bookingEndsAt.toISOString(),
    ), false);
  } finally {
    await prisma.booking.deleteMany({ where: { id: booking.id } });
    await prisma.availabilitySlot.deleteMany({ where: { id: slot.id } });
    await prisma.client.deleteMany({ where: { id: client.id } });
    await prisma.service.deleteMany({ where: { id: service.id } });
    await prisma.serviceCategory.deleteMany({ where: { id: category.id } });
  }
});

dbTest("createPublicBooking keeps server-side service availability as source of truth", async () => {
  const { prisma, createPublicBooking, PublicBookingError, publicBookingErrorCodes } = await loadModules();
  const suffix = randomUUID().slice(0, 8);

  const category = await prisma.serviceCategory.create({
    data: {
      name: `Booking query submit category ${suffix}`,
      slug: `booking-query-submit-category-${suffix}`,
      isActive: true,
    },
    select: { id: true },
  });

  const service = await prisma.service.create({
    data: {
      categoryId: category.id,
      name: `Booking query submit ${suffix}`,
      publicName: `Booking query submit ${suffix}`,
      slug: `booking-query-submit-${suffix}`,
      durationMinutes: 60,
      priceFromCzk: 1200,
      isActive: true,
      isPubliclyBookable: true,
    },
    select: { id: true },
  });

  const { startsAt, endsAt } = await findIsolatedPublicQuerySlotStart(prisma, suffix, 60, 5);

  const slot = await prisma.availabilitySlot.create({
    data: {
      startsAt,
      endsAt,
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
    select: { id: true },
  });

  try {
    await prisma.service.update({
      where: { id: service.id },
      data: {
        isPubliclyBookable: false,
      },
    });

    await assert.rejects(
      () =>
        createPublicBooking({
          serviceId: service.id,
          slotId: slot.id,
          startsAt: startsAt.toISOString(),
          fullName: `Klientka ${suffix}`,
          email: `booking-query-${suffix}@example.com`,
          phone: "+420777123456",
          acquisition: {
            source: BookingAcquisitionSource.DIRECT,
            utmSource: null,
            utmMedium: null,
            utmCampaign: null,
            referrerHost: null,
          },
        }),
      (error: unknown) => {
        assert.ok(error instanceof PublicBookingError);
        assert.equal(error.code, publicBookingErrorCodes.serviceUnavailable);
        return true;
      },
    );
  } finally {
    await prisma.booking.deleteMany({
      where: {
        clientEmailSnapshot: `booking-query-${suffix}@example.com`,
      },
    });
    await prisma.client.deleteMany({
      where: {
        email: `booking-query-${suffix}@example.com`,
      },
    });
    await prisma.availabilitySlot.delete({ where: { id: slot.id } });
    await prisma.service.delete({ where: { id: service.id } });
    await prisma.serviceCategory.delete({ where: { id: category.id } });
  }
});

dbTest("createPublicBooking ignores an archived slot left by a cancelled booking", async () => {
  const { prisma, createPublicBooking } = await loadModules();
  const suffix = randomUUID().slice(0, 8);

  const category = await prisma.serviceCategory.create({
    data: {
      name: `Booking archived slot category ${suffix}`,
      slug: `booking-archived-slot-category-${suffix}`,
      isActive: true,
    },
    select: { id: true },
  });
  const service = await prisma.service.create({
    data: {
      categoryId: category.id,
      name: `Booking archived slot ${suffix}`,
      publicName: `Booking archived slot ${suffix}`,
      slug: `booking-archived-slot-${suffix}`,
      durationMinutes: 30,
      priceFromCzk: 1200,
      isActive: true,
      isPubliclyBookable: true,
    },
    select: { id: true },
  });
  const { startsAt, endsAt } = await findIsolatedPublicQuerySlotStart(prisma, suffix, 30, 5);
  const [publishedSlot, archivedSlot] = await prisma.$transaction([
    prisma.availabilitySlot.create({
      data: {
        startsAt,
        endsAt,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
      select: { id: true },
    }),
    prisma.availabilitySlot.create({
      data: {
        startsAt: new Date(startsAt.getTime() - 15 * 60 * 1000),
        endsAt: new Date(endsAt.getTime() + 15 * 60 * 1000),
        status: "ARCHIVED",
      },
      select: { id: true },
    }),
  ]);
  const email = `booking-archived-slot-${suffix}@example.com`;

  try {
    const booking = await createPublicBooking({
      serviceId: service.id,
      slotId: publishedSlot.id,
      startsAt: startsAt.toISOString(),
      fullName: `Klientka ${suffix}`,
      email,
      phone: "+420777123456",
      acquisition: {
        source: BookingAcquisitionSource.DIRECT,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        referrerHost: null,
      },
    });

    assert.ok(booking.bookingId);
  } finally {
    await prisma.booking.deleteMany({ where: { clientEmailSnapshot: email } });
    await prisma.client.deleteMany({ where: { email } });
    await prisma.availabilitySlot.deleteMany({
      where: { id: { in: [publishedSlot.id, archivedSlot.id] } },
    });
    await prisma.service.delete({ where: { id: service.id } });
    await prisma.serviceCategory.delete({ where: { id: category.id } });
  }
});
