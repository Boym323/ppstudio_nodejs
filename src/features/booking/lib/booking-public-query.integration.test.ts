import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  AvailabilitySlotStatus,
  BookingAcquisitionSource,
  BookingActorType,
  BookingSource,
} from "@/generated/prisma/browser";

import { getPragueLocalDate, resolvePragueLocalDateTime } from "./booking-local-time";
import {
  buildSlotTimeOptions,
  filterTimeOptionsForAutoLunch,
} from "./booking-time-slots";

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
  const [{ prisma }, bookingModule, availabilityCore, engineModule] = await Promise.all([
    import("@/lib/prisma"),
    import("./booking-public"),
    import("./booking-availability-core"),
    import("./booking-public/engine"),
  ]);

  return {
    prisma,
    createPublicBooking: bookingModule.createPublicBooking,
    getPublicBookingCatalog: bookingModule.getPublicBookingCatalog,
    getBookingAvailabilityCatalog: availabilityCore.getBookingAvailabilityCatalog,
    createBookingWithEngine: engineModule.createBookingWithEngine,
    PublicBookingError: bookingModule.PublicBookingError,
    publicBookingErrorCodes: bookingModule.publicBookingErrorCodes,
  };
}

function at(localDate: string, time: string) {
  const value = resolvePragueLocalDateTime(localDate, time);
  assert.ok(value);
  return value;
}

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

function addCalendarDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return [
    String(value.getUTCFullYear()).padStart(4, "0"),
    String(value.getUTCMonth() + 1).padStart(2, "0"),
    String(value.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

async function findIsolatedPublicQueryLocalDate(
  prisma: Awaited<typeof import("@/lib/prisma")>["prisma"],
  minimumDayOffset = 14,
) {
  const today = getPragueLocalDate(new Date());

  for (let offset = minimumDayOffset; offset < minimumDayOffset + 75; offset += 1) {
    const localDate = addCalendarDays(today, offset);
    const startsAt = at(localDate, "00:00");
    const endsAt = at(addCalendarDays(localDate, 1), "00:00");
    const [slots, bookings] = await Promise.all([
      prisma.availabilitySlot.count({
        where: { startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
      }),
      prisma.booking.count({
        where: {
          scheduledStartsAt: { lt: endsAt },
          OR: [
            { blockedUntil: { gt: startsAt } },
            { blockedUntil: null, scheduledEndsAt: { gt: startsAt } },
          ],
        },
      }),
    ]);

    if (slots === 0 && bookings === 0) return localDate;
  }

  throw new Error("Nepodařilo se najít izolovaný den pro booking availability integrační test.");
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
    assert.ok(regularCatalog.scheduleOptimization.publishedAvailability.some(
      (interval) => interval.startsAt === startsAt.toISOString() && interval.endsAt === endsAt.toISOString(),
    ));
    assert.ok(regularCatalog.scheduleOptimization.bookedIntervals.some(
      (interval) => interval.startsAt === bookingStartsAt.toISOString() && interval.endsAt === bookingEndsAt.toISOString(),
    ));
    assert.equal(excludedCatalog.scheduleOptimization.bookedIntervals.some(
      (interval) => interval.startsAt === bookingStartsAt.toISOString() && interval.endsAt === bookingEndsAt.toISOString(),
    ), false);
  } finally {
    await prisma.booking.deleteMany({ where: { id: booking.id } });
    await prisma.availabilitySlot.deleteMany({ where: { id: slot.id } });
    await prisma.client.deleteMany({ where: { id: client.id } });
    await prisma.service.deleteMany({ where: { id: service.id } });
    await prisma.serviceCategory.deleteMany({ where: { id: category.id } });
  }
});

dbTest("catalog odděluje booking-window kandidáty od full-day optimization dostupnosti přes více pražských dnů", async () => {
  const { prisma, getBookingAvailabilityCatalog } = await loadModules();
  const suffix = randomUUID().slice(0, 8);
  const firstDate = "2027-01-15";
  const secondDate = "2027-01-16";
  const intervals = [
    { date: firstDate, start: "06:00", end: "09:00" },
    { date: firstDate, start: "09:30", end: "14:00" },
    { date: secondDate, start: "06:00", end: "09:00" },
    { date: secondDate, start: "09:30", end: "14:00" },
  ];
  const category = await prisma.serviceCategory.create({
    data: {
      name: `Booking optimization days category ${suffix}`,
      slug: `booking-optimization-days-category-${suffix}`,
      isActive: true,
    },
    select: { id: true },
  });
  const service = await prisma.service.create({
    data: {
      categoryId: category.id,
      name: `Booking optimization days service ${suffix}`,
      slug: `booking-optimization-days-service-${suffix}`,
      durationMinutes: 60,
      isActive: true,
      isPubliclyBookable: true,
    },
    select: { id: true },
  });
  const client = await prisma.client.create({
    data: {
      fullName: `Klientka optimization days ${suffix}`,
      email: `booking-optimization-days-${suffix}@example.com`,
      phone: "+420777123456",
    },
    select: { id: true },
  });
  const createdSlots = await prisma.availabilitySlot.createManyAndReturn({
    data: intervals.map((interval) => ({
      startsAt: at(interval.date, interval.start),
      endsAt: at(interval.date, interval.end),
      status: AvailabilitySlotStatus.PUBLISHED,
      publishedAt: new Date(),
    })),
    select: { id: true, startsAt: true, endsAt: true },
  });
  const createdBookings = await prisma.booking.createManyAndReturn({
    data: [firstDate, secondDate].map((date, index) => ({
      clientId: client.id,
      slotId: createdSlots[index * 2]?.id ?? "",
      serviceId: service.id,
      status: "CONFIRMED" as const,
      clientNameSnapshot: `Klientka optimization days ${suffix}`,
      clientEmailSnapshot: `booking-optimization-days-${suffix}@example.com`,
      clientPhoneSnapshot: "+420777123456",
      serviceNameSnapshot: `Booking optimization days service ${suffix}`,
      serviceDurationMinutes: 60,
      scheduledStartsAt: at(date, "07:00"),
      scheduledEndsAt: at(date, "08:00"),
      blockedUntil: at(date, "08:00"),
      confirmedAt: new Date(),
    })),
    select: { id: true, scheduledStartsAt: true, scheduledEndsAt: true },
  });

  try {
    const catalog = await getBookingAvailabilityCatalog({
      includeServices: false,
      bookingWindowStart: at(firstDate, "09:11"),
      bookingWindowEnd: at(secondDate, "10:31"),
      availabilitySlotStatus: AvailabilitySlotStatus.PUBLISHED,
      serviceWhere: {
        isActive: true,
        isPubliclyBookable: true,
        category: { is: { isActive: true } },
      },
    });
    const catalogSlotIds = new Set(catalog.slots.flatMap((slot) => [
      slot.id,
      ...(slot.segments?.map((segment) => segment.id) ?? []),
    ]));
    const optimizationIntervals = new Set(
      catalog.scheduleOptimization.publishedAvailability.map((interval) => `${interval.startsAt}/${interval.endsAt}`),
    );

    assert.equal(catalogSlotIds.has(createdSlots[0]?.id ?? ""), false);
    assert.equal(catalogSlotIds.has(createdSlots[1]?.id ?? ""), true);
    assert.equal(catalogSlotIds.has(createdSlots[2]?.id ?? ""), true);
    assert.equal(catalogSlotIds.has(createdSlots[3]?.id ?? ""), true);
    for (const slot of createdSlots) {
      assert.equal(optimizationIntervals.has(`${slot.startsAt.toISOString()}/${slot.endsAt.toISOString()}`), true);
    }
    assert.deepEqual(
      catalog.scheduleOptimization.bookedIntervals
        .map((interval) => `${interval.startsAt}/${interval.endsAt}`)
        .sort(),
      createdBookings
        .map((booking) => `${booking.scheduledStartsAt.toISOString()}/${booking.scheduledEndsAt.toISOString()}`)
        .sort(),
    );
    const [firstBooking, secondBooking] = [...createdBookings]
      .sort((left, right) => left.scheduledStartsAt.getTime() - right.scheduledStartsAt.getTime());
    assert.ok(firstBooking);
    assert.ok(secondBooking);
    assert.equal(catalog.slots.some((slot) => slot.bookedIntervals.some(
      (interval) => interval.startsAt === firstBooking.scheduledStartsAt.toISOString(),
    )), false);
    assert.equal(catalog.slots.some((slot) => slot.bookedIntervals.some(
      (interval) => interval.startsAt === secondBooking.scheduledStartsAt.toISOString(),
    )), true);
  } finally {
    await prisma.booking.deleteMany({ where: { id: { in: createdBookings.map((booking) => booking.id) } } });
    await prisma.availabilitySlot.deleteMany({ where: { id: { in: createdSlots.map((slot) => slot.id) } } });
    await prisma.client.delete({ where: { id: client.id } });
    await prisma.service.delete({ where: { id: service.id } });
    await prisma.serviceCategory.delete({ where: { id: category.id } });
  }
});

dbTest("schedule optimization zachová full-day aktivní booking včetně cleanup blokace", async () => {
  const {
    prisma,
    getBookingAvailabilityCatalog,
    createBookingWithEngine,
    PublicBookingError,
    publicBookingErrorCodes,
  } = await loadModules();
  const suffix = randomUUID().slice(0, 8);
  const localDate = await findIsolatedPublicQueryLocalDate(prisma);
  const category = await prisma.serviceCategory.create({
    data: {
      name: `Booking optimization category ${suffix}`,
      slug: `booking-optimization-category-${suffix}`,
      isActive: true,
    },
    select: { id: true },
  });
  const service = await prisma.service.create({
    data: {
      categoryId: category.id,
      name: `Booking optimization service ${suffix}`,
      slug: `booking-optimization-service-${suffix}`,
      durationMinutes: 120,
      isActive: true,
      isPubliclyBookable: true,
    },
    select: { id: true },
  });
  const client = await prisma.client.create({
    data: {
      fullName: `Klientka optimization ${suffix}`,
      email: `booking-optimization-${suffix}@example.com`,
      phone: "+420777123456",
    },
    select: { id: true },
  });
  const slot = await prisma.availabilitySlot.create({
    data: {
      startsAt: at(localDate, "09:00"),
      endsAt: at(localDate, "17:00"),
      status: AvailabilitySlotStatus.PUBLISHED,
      publishedAt: new Date(),
    },
    select: { id: true },
  });
  const activeBooking = await prisma.booking.create({
    data: {
      clientId: client.id,
      slotId: slot.id,
      serviceId: service.id,
      status: "CONFIRMED",
      clientNameSnapshot: `Klientka optimization ${suffix}`,
      clientEmailSnapshot: `booking-optimization-${suffix}@example.com`,
      clientPhoneSnapshot: "+420777123456",
      serviceNameSnapshot: `Booking optimization service ${suffix}`,
      serviceDurationMinutes: 45,
      scheduledStartsAt: at(localDate, "11:00"),
      scheduledEndsAt: at(localDate, "11:45"),
      blockedUntil: at(localDate, "12:00"),
      confirmedAt: new Date(),
    },
    select: { id: true },
  });
  const cancelledBooking = await prisma.booking.create({
    data: {
      clientId: client.id,
      slotId: slot.id,
      serviceId: service.id,
      status: "CANCELLED",
      clientNameSnapshot: `Klientka optimization cancelled ${suffix}`,
      clientEmailSnapshot: `booking-optimization-cancelled-${suffix}@example.com`,
      clientPhoneSnapshot: "+420777123456",
      serviceNameSnapshot: `Booking optimization service ${suffix}`,
      serviceDurationMinutes: 60,
      scheduledStartsAt: at(localDate, "10:00"),
      scheduledEndsAt: at(localDate, "11:00"),
      cancelledAt: new Date(),
    },
    select: { id: true },
  });
  const serverClientPhone = `+420777${String(Number.parseInt(suffix, 16) % 1_000_000).padStart(6, "0")}`;

  try {
    const catalog = await getBookingAvailabilityCatalog({
      includeServices: false,
      bookingWindowStart: at(localDate, "12:00"),
      bookingWindowEnd: at(localDate, "13:00"),
      availabilitySlotStatus: AvailabilitySlotStatus.PUBLISHED,
      serviceWhere: {
        isActive: true,
        isPubliclyBookable: true,
        category: { is: { isActive: true } },
      },
    });
    const catalogSlot = catalog.slots.find((item) => item.id === slot.id);
    assert.ok(catalogSlot);

    assert.equal(catalogSlot.bookedIntervals.some(
      (interval) => interval.startsAt === at(localDate, "11:00").toISOString(),
    ), false);
    assert.deepEqual(catalog.scheduleOptimization.bookedIntervals, [{
      startsAt: at(localDate, "11:00").toISOString(),
      endsAt: at(localDate, "12:00").toISOString(),
    }]);
    assert.equal(catalog.scheduleOptimization.bookedIntervals.some(
      (interval) => interval.startsAt === at(localDate, "10:00").toISOString(),
    ), false);

    const candidate = buildSlotTimeOptions(catalogSlot, 120).find(
      (option) => option.startsAt === at(localDate, "12:00").toISOString(),
    );
    assert.ok(candidate);
    assert.deepEqual(
      filterTimeOptionsForAutoLunch([candidate], {
        serviceDurationMinutes: 120,
        cleanupBlockMinutes: 0,
        capacity: 1,
        scheduleOptimization: catalog.scheduleOptimization,
      }),
      [],
    );
    await assert.rejects(
      () => createBookingWithEngine({
        serviceId: service.id,
        slotId: slot.id,
        startsAt: candidate.startsAt,
        client: {
          fullName: `Klientka optimization server ${suffix}`,
          email: `booking-optimization-server-${suffix}@example.com`,
          phone: serverClientPhone,
        },
        source: BookingSource.WEB,
        status: "PENDING",
        isManual: false,
        allowManualOverride: false,
        actorType: BookingActorType.CLIENT,
        historyReason: "Regrese full-day booking contextu automatického oběda",
        sendClientEmail: false,
        includeCalendarAttachment: false,
        sendAdminNotification: false,
      }),
      (error: unknown) => {
        assert.ok(error instanceof PublicBookingError);
        assert.equal(error.code, publicBookingErrorCodes.slotUnavailable);
        return true;
      },
    );
  } finally {
    await prisma.booking.deleteMany({ where: { id: { in: [activeBooking.id, cancelledBooking.id] } } });
    await prisma.availabilitySlot.delete({ where: { id: slot.id } });
    await prisma.client.delete({ where: { id: client.id } });
    await prisma.service.delete({ where: { id: service.id } });
    await prisma.serviceCategory.delete({ where: { id: category.id } });
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

dbTest("createPublicBooking rejects DRAFT, ARCHIVED and CANCELLED requested slots", async () => {
  const { prisma, createPublicBooking, PublicBookingError, publicBookingErrorCodes } = await loadModules();
  const suffix = randomUUID().slice(0, 8);
  const category = await prisma.serviceCategory.create({
    data: {
      name: `Booking rejected slot category ${suffix}`,
      slug: `booking-rejected-slot-category-${suffix}`,
      isActive: true,
    },
    select: { id: true },
  });
  const service = await prisma.service.create({
    data: {
      categoryId: category.id,
      name: `Booking rejected slot ${suffix}`,
      publicName: `Booking rejected slot ${suffix}`,
      slug: `booking-rejected-slot-${suffix}`,
      durationMinutes: 30,
      priceFromCzk: 1200,
      isActive: true,
      isPubliclyBookable: true,
    },
    select: { id: true },
  });
  const { startsAt, endsAt } = await findIsolatedPublicQuerySlotStart(prisma, suffix, 30, 5);
  const slots = await Promise.all(
    [AvailabilitySlotStatus.DRAFT, AvailabilitySlotStatus.ARCHIVED, AvailabilitySlotStatus.CANCELLED].map(
      (status, index) => prisma.availabilitySlot.create({
        data: {
          startsAt: new Date(startsAt.getTime() + index * 60 * 60 * 1000),
          endsAt: new Date(endsAt.getTime() + index * 60 * 60 * 1000),
          status,
          cancelledAt: status === AvailabilitySlotStatus.CANCELLED ? new Date() : null,
        },
        select: { id: true, startsAt: true },
      }),
    ),
  );

  try {
    for (const slot of slots) {
      await assert.rejects(
        createPublicBooking({
          serviceId: service.id,
          slotId: slot.id,
          startsAt: slot.startsAt.toISOString(),
          fullName: `Klientka ${suffix}`,
          email: `booking-rejected-slot-${slot.id}@example.com`,
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
          assert.equal(error.code, publicBookingErrorCodes.slotUnavailable);
          return true;
        },
      );
    }
  } finally {
    await prisma.availabilitySlot.deleteMany({ where: { id: { in: slots.map((slot) => slot.id) } } });
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
  const phone = `+4207${String(Number.parseInt(suffix, 16) % 100_000_000).padStart(8, "0")}`;

  try {
    const booking = await createPublicBooking({
      serviceId: service.id,
      slotId: publishedSlot.id,
      startsAt: startsAt.toISOString(),
      fullName: `Klientka ${suffix}`,
      email,
      phone,
      acquisition: {
        source: BookingAcquisitionSource.DIRECT,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        referrerHost: null,
      },
    });

    assert.ok(booking.bookingId);
    const storedBooking = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.bookingId },
      select: { originalAvailabilityEndsAt: true },
    });
    assert.equal(storedBooking.originalAvailabilityEndsAt?.toISOString(), endsAt.toISOString());
  } finally {
    await prisma.emailLog.deleteMany({ where: { recipientEmail: email } });
    await prisma.booking.deleteMany({ where: { clientEmailSnapshot: email } });
    await prisma.client.deleteMany({ where: { email } });
    await prisma.availabilitySlot.deleteMany({
      where: { id: { in: [publishedSlot.id, archivedSlot.id] } },
    });
    await prisma.service.delete({ where: { id: service.id } });
    await prisma.serviceCategory.delete({ where: { id: category.id } });
  }
});
