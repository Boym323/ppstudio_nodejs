import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { BookingActorType, BookingActionTokenType, BookingStatus, EmailLogType } from "@/generated/prisma/browser";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "change-me-owner";
process.env.ADMIN_STAFF_EMAIL ??= "staff@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "change-me-staff";
process.env.EMAIL_DELIVERY_MODE ??= "log";

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

async function findIsolatedAdminWindow(
  prisma: Awaited<typeof import("@/lib/prisma")>["prisma"],
  seed: string,
  durationMinutes: number,
) {
  const daySeed = Number.parseInt(seed.slice(0, 4), 16);
  const hourSeed = Number.parseInt(seed.slice(4, 6), 16);
  const minuteSeed = Number.parseInt(seed.slice(6, 8), 16);
  const hourCandidates = [7, 8, 9, 10, 11, 12, 13, 14].map(
    (hour, index, list) => list[(index + hourSeed) % list.length] ?? hour,
  );
  const minuteCandidates = [0, 15, 30].map(
    (minute, index, list) => list[(index + minuteSeed) % list.length] ?? minute,
  );

  for (let dayStep = 0; dayStep < 45; dayStep += 1) {
    const dayOffset = 14 + ((daySeed + dayStep) % 45);

    for (const hour of hourCandidates) {
      for (const minute of minuteCandidates) {
        const startsAt = new Date();
        startsAt.setUTCSeconds(0, 0);
        startsAt.setUTCDate(startsAt.getUTCDate() + dayOffset);
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

  throw new Error("Nepodařilo se najít izolované okno pro admin booking integrační test.");
}

dbTest("applyAdminBookingStatusChange confirms pending booking and writes side effects", async () => {
  const [{ prisma }, { applyAdminBookingStatusChange }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-booking"),
  ]);

  const suffix = randomUUID().slice(0, 8);
  const { startsAt, endsAt } = await findIsolatedAdminWindow(prisma, suffix, 60);

  const owner = await prisma.adminUser.create({
    data: {
      email: `owner-booking-int-${suffix}@example.com`,
      name: `Owner ${suffix}`,
      role: "OWNER",
      isActive: true,
    },
    select: { id: true },
  });

  const category = await prisma.serviceCategory.create({
    data: {
      name: `Kategorie ${suffix}`,
      slug: `kategorie-${suffix}`,
      isActive: true,
    },
    select: { id: true },
  });

  const service = await prisma.service.create({
    data: {
      categoryId: category.id,
      name: `Služba ${suffix}`,
      slug: `sluzba-${suffix}`,
      durationMinutes: 60,
      priceFromCzk: 1200,
      isActive: true,
      isPubliclyBookable: true,
    },
    select: { id: true },
  });

  const slot = await prisma.availabilitySlot.create({
    data: {
      startsAt,
      endsAt,
      status: "PUBLISHED",
      capacity: 1,
    },
    select: { id: true },
  });

  const client = await prisma.client.create({
    data: {
      fullName: `Klientka ${suffix}`,
      email: `client-booking-int-${suffix}@example.com`,
      phone: "+420777123456",
      isActive: true,
    },
    select: { id: true },
  });

  const booking = await prisma.booking.create({
    data: {
      clientId: client.id,
      slotId: slot.id,
      serviceId: service.id,
      status: BookingStatus.PENDING,
      source: "WEB",
      clientNameSnapshot: `Klientka ${suffix}`,
      clientEmailSnapshot: `client-booking-int-${suffix}@example.com`,
      clientPhoneSnapshot: "+420777123456",
      serviceNameSnapshot: `Služba ${suffix}`,
      serviceDurationMinutes: 60,
      servicePriceFromCzk: 1200,
      scheduledStartsAt: startsAt,
      scheduledEndsAt: endsAt,
    },
    select: { id: true },
  });

  try {
    const result = await applyAdminBookingStatusChange({
      bookingId: booking.id,
      targetStatus: BookingStatus.CONFIRMED,
      actorUserId: owner.id,
      reason: "Integration confirmation",
      internalNote: "Potvrzeno z integračního testu",
    });

    assert.equal(result.status, "success");

    const updatedBooking = await prisma.booking.findUnique({
      where: { id: booking.id },
      select: {
        status: true,
        confirmedAt: true,
        internalNote: true,
      },
    });

    assert.ok(updatedBooking);
    assert.equal(updatedBooking.status, BookingStatus.CONFIRMED);
    assert.ok(updatedBooking.confirmedAt);
    assert.equal(updatedBooking.internalNote, "Potvrzeno z integračního testu");

    const history = await prisma.bookingStatusHistory.findMany({
      where: { bookingId: booking.id },
      orderBy: { createdAt: "desc" },
      take: 1,
      select: {
        status: true,
        actorType: true,
        actorUserId: true,
        reason: true,
        note: true,
      },
    });

    assert.equal(history.length, 1);
    assert.equal(history[0]?.status, BookingStatus.CONFIRMED);
    assert.equal(history[0]?.actorType, BookingActorType.USER);
    assert.equal(history[0]?.actorUserId, owner.id);
    assert.equal(history[0]?.reason, "Integration confirmation");
    assert.equal(history[0]?.note, "Potvrzeno z integračního testu");

    const actionTokens = await prisma.bookingActionToken.findMany({
      where: { bookingId: booking.id },
      select: { type: true, tokenHash: true },
    });

    assert.equal(actionTokens.length, 2);
    assert.ok(actionTokens.some((token) => token.type === BookingActionTokenType.RESCHEDULE));
    assert.ok(actionTokens.some((token) => token.type === BookingActionTokenType.CANCEL));
    assert.ok(actionTokens.every((token) => token.tokenHash.length > 0));

    const emailLog = await prisma.emailLog.findFirst({
      where: {
        bookingId: booking.id,
        type: EmailLogType.BOOKING_CONFIRMED,
      },
      select: {
        templateKey: true,
        recipientEmail: true,
      },
    });

    assert.ok(emailLog);
    assert.equal(emailLog.templateKey, "booking-approved-v1");
    assert.equal(emailLog.recipientEmail, `client-booking-int-${suffix}@example.com`);
  } finally {
    await prisma.bookingActionToken.deleteMany({
      where: { bookingId: booking.id },
    });
    await prisma.emailLog.deleteMany({
      where: { bookingId: booking.id },
    });
    await prisma.bookingStatusHistory.deleteMany({
      where: { bookingId: booking.id },
    });
    await prisma.booking.deleteMany({
      where: { id: booking.id },
    });
    await prisma.client.deleteMany({
      where: { id: client.id },
    });
    await prisma.availabilitySlot.deleteMany({
      where: { id: slot.id },
    });
    await prisma.service.deleteMany({
      where: { id: service.id },
    });
    await prisma.serviceCategory.deleteMany({
      where: { id: category.id },
    });
    await prisma.adminUser.deleteMany({
      where: { id: owner.id },
    });
  }
});

dbTest("applyAdminBookingStatusChange serverově odmítne předčasné no-show a po grace period uvolní availability", async () => {
  const [{ prisma }, { applyAdminBookingStatusChange }, { getBookingAvailabilityCatalog }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-booking"),
    import("@/features/booking/lib/booking-availability-core"),
  ]);
  const suffix = randomUUID().slice(0, 8);
  const { startsAt, endsAt } = await findIsolatedAdminWindow(prisma, suffix, 60);

  const [owner, category, client] = await Promise.all([
    prisma.adminUser.create({ data: { email: `owner-no-show-${suffix}@example.com`, name: `Owner ${suffix}`, role: "OWNER", isActive: true }, select: { id: true } }),
    prisma.serviceCategory.create({ data: { name: `Kategorie no-show ${suffix}`, slug: `kategorie-no-show-${suffix}`, isActive: true }, select: { id: true } }),
    prisma.client.create({ data: { fullName: `Klientka no-show ${suffix}`, email: `client-no-show-${suffix}@example.com`, phone: "+420777123456", isActive: true }, select: { id: true } }),
  ]);
  const service = await prisma.service.create({
    data: { categoryId: category.id, name: `Služba no-show ${suffix}`, slug: `sluzba-no-show-${suffix}`, durationMinutes: 60, priceFromCzk: 1200, isActive: true, isPubliclyBookable: true },
    select: { id: true },
  });
  const slot = await prisma.availabilitySlot.create({
    data: { startsAt, endsAt, status: "PUBLISHED", capacity: 1 },
    select: { id: true },
  });
  const booking = await prisma.booking.create({
    data: {
      clientId: client.id, slotId: slot.id, serviceId: service.id, status: BookingStatus.CONFIRMED, source: "WEB",
      clientNameSnapshot: `Klientka no-show ${suffix}`, clientEmailSnapshot: `client-no-show-${suffix}@example.com`, clientPhoneSnapshot: "+420777123456",
      serviceNameSnapshot: `Služba no-show ${suffix}`, serviceDurationMinutes: 60, servicePriceFromCzk: 1200,
      scheduledStartsAt: startsAt, scheduledEndsAt: endsAt,
    },
    select: { id: true },
  });
  const getAvailability = () => getBookingAvailabilityCatalog({
    includeServices: false,
    bookingWindowStart: startsAt,
    bookingWindowEnd: endsAt,
    availabilitySlotStatus: "PUBLISHED",
    serviceWhere: { id: service.id },
  });

  try {
    const earlyResult = await applyAdminBookingStatusChange({
      bookingId: booking.id, targetStatus: BookingStatus.NO_SHOW, actorUserId: owner.id,
      now: new Date(startsAt.getTime() - 16 * 60 * 1000),
    });
    assert.equal(earlyResult.status, "no-show-too-early");
    assert.equal((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id }, select: { status: true } })).status, BookingStatus.CONFIRMED);
    assert.equal((await getAvailability()).scheduleOptimization.bookedIntervals.length, 1);

    const validResult = await applyAdminBookingStatusChange({
      bookingId: booking.id, targetStatus: BookingStatus.NO_SHOW, actorUserId: owner.id,
      now: new Date(startsAt.getTime() + 15 * 60 * 1000),
    });
    assert.equal(validResult.status, "success");
    assert.equal((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id }, select: { status: true } })).status, BookingStatus.NO_SHOW);
    assert.equal((await getAvailability()).scheduleOptimization.bookedIntervals.length, 0);
    assert.equal(await prisma.bookingStatusHistory.count({ where: { bookingId: booking.id, status: BookingStatus.NO_SHOW } }), 1);
  } finally {
    await prisma.bookingStatusHistory.deleteMany({ where: { bookingId: booking.id } });
    await prisma.booking.deleteMany({ where: { id: booking.id } });
    await prisma.client.deleteMany({ where: { id: client.id } });
    await prisma.availabilitySlot.deleteMany({ where: { id: slot.id } });
    await prisma.service.deleteMany({ where: { id: service.id } });
    await prisma.serviceCategory.deleteMany({ where: { id: category.id } });
    await prisma.adminUser.deleteMany({ where: { id: owner.id } });
  }
});

dbTest("applyAdminBookingStatusChange compacts adjacent editable slot fragments on cancellation", async () => {
  const [{ prisma }, { applyAdminBookingStatusChange }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-booking"),
  ]);

  const suffix = randomUUID().slice(0, 8);
  const { startsAt: baseStartAt } = await findIsolatedAdminWindow(prisma, suffix, 120);
  const beforeEndsAt = new Date(baseStartAt.getTime() + 30 * 60 * 1000);
  const bookingEndsAt = new Date(baseStartAt.getTime() + 105 * 60 * 1000);
  const fullEndsAt = new Date(baseStartAt.getTime() + 120 * 60 * 1000);

  const owner = await prisma.adminUser.create({
    data: {
      email: `owner-booking-cancel-${suffix}@example.com`,
      name: `Owner Cancel ${suffix}`,
      role: "OWNER",
      isActive: true,
    },
    select: { id: true },
  });

  const category = await prisma.serviceCategory.create({
    data: {
      name: `Kategorie cancel ${suffix}`,
      slug: `kategorie-cancel-${suffix}`,
      isActive: true,
    },
    select: { id: true },
  });

  const service = await prisma.service.create({
    data: {
      categoryId: category.id,
      name: `Služba cancel ${suffix}`,
      slug: `sluzba-cancel-${suffix}`,
      durationMinutes: 75,
      priceFromCzk: 1200,
      isActive: true,
      isPubliclyBookable: true,
    },
    select: { id: true },
  });

  const [, bookedSlot] = await prisma.$transaction([
    prisma.availabilitySlot.create({
      data: {
        startsAt: baseStartAt,
        endsAt: beforeEndsAt,
        status: "PUBLISHED",
        capacity: 1,
        serviceRestrictionMode: "ANY",
        publishedAt: new Date(baseStartAt.getTime() - 24 * 60 * 60 * 1000),
        createdByUserId: owner.id,
      },
      select: { id: true },
    }),
    prisma.availabilitySlot.create({
      data: {
        startsAt: beforeEndsAt,
        endsAt: bookingEndsAt,
        status: "PUBLISHED",
        capacity: 1,
        serviceRestrictionMode: "ANY",
        publishedAt: new Date(baseStartAt.getTime() - 24 * 60 * 60 * 1000),
        createdByUserId: owner.id,
      },
      select: { id: true },
    }),
    prisma.availabilitySlot.create({
      data: {
        startsAt: bookingEndsAt,
        endsAt: fullEndsAt,
        status: "PUBLISHED",
        capacity: 1,
        serviceRestrictionMode: "ANY",
        publishedAt: new Date(baseStartAt.getTime() - 24 * 60 * 60 * 1000),
        createdByUserId: owner.id,
      },
      select: { id: true },
    }),
  ]);

  const client = await prisma.client.create({
    data: {
      fullName: `Klientka cancel ${suffix}`,
      email: `client-booking-cancel-${suffix}@example.com`,
      phone: "+420777123456",
      isActive: true,
    },
    select: { id: true },
  });

  const booking = await prisma.booking.create({
    data: {
      clientId: client.id,
      slotId: bookedSlot.id,
      serviceId: service.id,
      status: BookingStatus.CONFIRMED,
      source: "WEB",
      clientNameSnapshot: `Klientka cancel ${suffix}`,
      clientEmailSnapshot: `client-booking-cancel-${suffix}@example.com`,
      clientPhoneSnapshot: "+420777123456",
      serviceNameSnapshot: `Služba cancel ${suffix}`,
      serviceDurationMinutes: 75,
      servicePriceFromCzk: 1200,
      scheduledStartsAt: beforeEndsAt,
      scheduledEndsAt: bookingEndsAt,
    },
    select: { id: true },
  });

  try {
    const result = await applyAdminBookingStatusChange({
      bookingId: booking.id,
      targetStatus: BookingStatus.CANCELLED,
      actorUserId: owner.id,
      reason: "Integration cancellation",
    });

    assert.equal(result.status, "success");

    const updatedBooking = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
      select: {
        status: true,
        slotId: true,
        cancelledAt: true,
      },
    });

    assert.equal(updatedBooking.status, BookingStatus.CANCELLED);
    assert.ok(updatedBooking.cancelledAt);
    assert.equal(updatedBooking.slotId, bookedSlot.id);

    const slots = await prisma.availabilitySlot.findMany({
      where: {
        createdByUserId: owner.id,
      },
      orderBy: {
        startsAt: "asc",
      },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
      },
    });

    assert.deepEqual(
      slots.map((slot) => ({
        id: slot.id,
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
      })),
      [{
        id: bookedSlot.id,
        startsAt: baseStartAt.toISOString(),
        endsAt: fullEndsAt.toISOString(),
      }],
    );
  } finally {
    await prisma.bookingActionToken.deleteMany({
      where: { bookingId: booking.id },
    });
    await prisma.emailLog.deleteMany({
      where: { bookingId: booking.id },
    });
    await prisma.bookingStatusHistory.deleteMany({
      where: { bookingId: booking.id },
    });
    await prisma.booking.deleteMany({
      where: { id: booking.id },
    });
    await prisma.client.deleteMany({
      where: { id: client.id },
    });
    await prisma.availabilitySlot.deleteMany({
      where: { createdByUserId: owner.id },
    });
    await prisma.service.deleteMany({
      where: { id: service.id },
    });
    await prisma.serviceCategory.deleteMany({
      where: { id: category.id },
    });
    await prisma.adminUser.deleteMany({
      where: { id: owner.id },
    });
  }
});

dbTest("applyAdminBookingStatusChange archives only its orphaned manual-override DRAFT slot", async () => {
  const [{ prisma }, { applyAdminBookingStatusChange }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-booking"),
  ]);

  const suffix = randomUUID().slice(0, 8);
  const { startsAt, endsAt } = await findIsolatedAdminWindow(prisma, suffix, 60);
  const owner = await prisma.adminUser.create({
    data: { email: `owner-override-cancel-${suffix}@example.com`, name: `Owner ${suffix}`, role: "OWNER", isActive: true },
    select: { id: true },
  });
  const category = await prisma.serviceCategory.create({
    data: { name: `Kategorie override ${suffix}`, slug: `kategorie-override-${suffix}`, isActive: true },
    select: { id: true },
  });
  const service = await prisma.service.create({
    data: {
      categoryId: category.id, name: `Služba override ${suffix}`, slug: `sluzba-override-${suffix}`,
      durationMinutes: 60, priceFromCzk: 1200, isActive: true, isPubliclyBookable: true,
    },
    select: { id: true },
  });
  const client = await prisma.client.create({
    data: { fullName: `Klientka override ${suffix}`, email: `override-${suffix}@example.com`, phone: "+420777123456", isActive: true },
    select: { id: true },
  });
  const manualOverrideSlot = await prisma.availabilitySlot.create({
    data: {
      startsAt, endsAt, capacity: 1, status: "DRAFT", serviceRestrictionMode: "ANY",
      internalNote: "Dočasná ruční výjimka", createdByUserId: owner.id,
    },
    select: { id: true },
  });
  const archivedOriginalSlot = await prisma.availabilitySlot.create({
    data: {
      startsAt, endsAt, capacity: 1, status: "ARCHIVED", serviceRestrictionMode: "ANY",
      createdByUserId: owner.id,
    },
    select: { id: true },
  });
  const adminDraftSlot = await prisma.availabilitySlot.create({
    data: {
      startsAt: new Date(endsAt.getTime() + 60 * 60 * 1000),
      endsAt: new Date(endsAt.getTime() + 2 * 60 * 60 * 1000),
      capacity: 1, status: "DRAFT", serviceRestrictionMode: "ANY",
      internalNote: "Skutečná administrativní blokace", createdByUserId: owner.id,
    },
    select: { id: true },
  });
  const booking = await prisma.booking.create({
    data: {
      clientId: client.id, slotId: manualOverrideSlot.id, serviceId: service.id,
      status: BookingStatus.CONFIRMED, source: "PHONE", manualOverride: true,
      clientNameSnapshot: `Klientka override ${suffix}`, clientEmailSnapshot: `override-${suffix}@example.com`,
      clientPhoneSnapshot: "+420777123456", serviceNameSnapshot: `Služba override ${suffix}`,
      serviceDurationMinutes: 60, servicePriceFromCzk: 1200, scheduledStartsAt: startsAt, scheduledEndsAt: endsAt,
    },
    select: { id: true },
  });

  try {
    const result = await applyAdminBookingStatusChange({
      bookingId: booking.id,
      targetStatus: BookingStatus.CANCELLED,
      actorUserId: owner.id,
      reason: "Integration manual override cancellation",
    });

    assert.equal(result.status, "success");
    const [updatedBooking, manualOverrideSlotAfterCancellation, archivedOriginalSlotAfterCancellation, adminDraftSlotAfterCancellation] = await Promise.all([
      prisma.booking.findUniqueOrThrow({ where: { id: booking.id }, select: { status: true } }),
      prisma.availabilitySlot.findUniqueOrThrow({ where: { id: manualOverrideSlot.id }, select: { status: true } }),
      prisma.availabilitySlot.findUniqueOrThrow({ where: { id: archivedOriginalSlot.id }, select: { status: true } }),
      prisma.availabilitySlot.findUniqueOrThrow({ where: { id: adminDraftSlot.id }, select: { status: true } }),
    ]);

    assert.equal(updatedBooking.status, BookingStatus.CANCELLED);
    assert.equal(manualOverrideSlotAfterCancellation.status, "ARCHIVED");
    assert.equal(archivedOriginalSlotAfterCancellation.status, "PUBLISHED");
    assert.equal(adminDraftSlotAfterCancellation.status, "DRAFT");
  } finally {
    await prisma.bookingStatusHistory.deleteMany({ where: { bookingId: booking.id } });
    await prisma.booking.deleteMany({ where: { id: booking.id } });
    await prisma.client.deleteMany({ where: { id: client.id } });
    await prisma.availabilitySlot.deleteMany({ where: { id: { in: [manualOverrideSlot.id, archivedOriginalSlot.id, adminDraftSlot.id] } } });
    await prisma.service.deleteMany({ where: { id: service.id } });
    await prisma.serviceCategory.deleteMany({ where: { id: category.id } });
    await prisma.adminUser.deleteMany({ where: { id: owner.id } });
  }
});

dbTest("updateAdminBookingService rewrites booking snapshot and audit history", async () => {
  const [{ prisma }, { updateAdminBookingService }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-booking"),
  ]);

  const suffix = randomUUID().slice(0, 8);
  const { startsAt, endsAt } = await findIsolatedAdminWindow(prisma, suffix, 60);
  const expectedServiceEndsAt = new Date(startsAt.getTime() + 45 * 60 * 1000);

  const owner = await prisma.adminUser.create({
    data: {
      email: `owner-booking-service-${suffix}@example.com`,
      name: `Owner Service ${suffix}`,
      role: "OWNER",
      isActive: true,
    },
    select: { id: true },
  });

  const category = await prisma.serviceCategory.create({
    data: {
      name: `Kategorie služby ${suffix}`,
      slug: `kategorie-sluzby-${suffix}`,
      isActive: true,
    },
    select: { id: true },
  });

  const [originalService, replacementService] = await Promise.all([
    prisma.service.create({
      data: {
        categoryId: category.id,
        name: `Původní služba ${suffix}`,
        slug: `puvodni-sluzba-${suffix}`,
        durationMinutes: 60,
        priceFromCzk: 1200,
        isActive: true,
        isPubliclyBookable: true,
      },
      select: { id: true },
    }),
    prisma.service.create({
      data: {
        categoryId: category.id,
        name: `Nová služba ${suffix}`,
        slug: `nova-sluzba-${suffix}`,
        durationMinutes: 45,
        cleanupMinutes: 10,
        priceFromCzk: 1500,
        isActive: true,
        isPubliclyBookable: true,
      },
      select: { id: true },
    }),
  ]);

  const slot = await prisma.availabilitySlot.create({
    data: {
      startsAt,
      endsAt,
      status: "PUBLISHED",
      capacity: 1,
      serviceRestrictionMode: "ANY",
    },
    select: { id: true },
  });

  const client = await prisma.client.create({
    data: {
      fullName: `Klientka změny služby ${suffix}`,
      email: `client-booking-service-${suffix}@example.com`,
      phone: "+420777123456",
      isActive: true,
    },
    select: { id: true },
  });

  const booking = await prisma.booking.create({
    data: {
      clientId: client.id,
      slotId: slot.id,
      serviceId: originalService.id,
      status: BookingStatus.CONFIRMED,
      source: "WEB",
      clientNameSnapshot: `Klientka změny služby ${suffix}`,
      clientEmailSnapshot: `client-booking-service-${suffix}@example.com`,
      clientPhoneSnapshot: "+420777123456",
      serviceNameSnapshot: `Původní služba ${suffix}`,
      serviceDurationMinutes: 60,
      servicePriceFromCzk: 1200,
      scheduledStartsAt: startsAt,
      scheduledEndsAt: endsAt,
      blockedUntil: endsAt,
    },
    select: { id: true, updatedAt: true },
  });

  try {
    const result = await updateAdminBookingService({
      bookingId: booking.id,
      serviceId: replacementService.id,
      actorUserId: owner.id,
      expectedUpdatedAt: booking.updatedAt.toISOString(),
      reason: "Klientka si na místě zvolila jinou péči",
    });

    assert.equal(result.status, "success");

    const updatedBooking = await prisma.booking.findUnique({
      where: { id: booking.id },
      select: {
        serviceId: true,
        serviceNameSnapshot: true,
        serviceDurationMinutes: true,
        cleanupMinutes: true,
        cleanupBlockMinutes: true,
        servicePriceFromCzk: true,
        scheduledEndsAt: true,
        blockedUntil: true,
      },
    });

    assert.ok(updatedBooking);
    assert.equal(updatedBooking.serviceId, replacementService.id);
    assert.equal(updatedBooking.serviceNameSnapshot, `Nová služba ${suffix}`);
    assert.equal(updatedBooking.serviceDurationMinutes, 45);
    assert.equal(updatedBooking.cleanupMinutes, 10);
    assert.equal(updatedBooking.cleanupBlockMinutes, 15);
    assert.equal(updatedBooking.servicePriceFromCzk, 1500);
    assert.equal(updatedBooking.scheduledEndsAt.toISOString(), expectedServiceEndsAt.toISOString());
    assert.equal(updatedBooking.blockedUntil?.toISOString(), endsAt.toISOString());

    const history = await prisma.bookingStatusHistory.findMany({
      where: { bookingId: booking.id },
      orderBy: { createdAt: "desc" },
      take: 1,
      select: {
        status: true,
        actorType: true,
        actorUserId: true,
        reason: true,
        metadata: true,
      },
    });

    assert.equal(history.length, 1);
    assert.equal(history[0]?.status, BookingStatus.CONFIRMED);
    assert.equal(history[0]?.actorType, BookingActorType.USER);
    assert.equal(history[0]?.actorUserId, owner.id);
    assert.match(history[0]?.reason ?? "", /Klientka si na místě zvolila jinou péči/);

    const metadata = history[0]?.metadata as Record<string, unknown> | null;
    assert.equal(metadata?.source, "admin-booking-service-change-v1");
    assert.equal(metadata?.previousServiceId, originalService.id);
    assert.equal(metadata?.nextServiceId, replacementService.id);
  } finally {
    await prisma.bookingStatusHistory.deleteMany({
      where: { bookingId: booking.id },
    });
    await prisma.booking.deleteMany({
      where: { id: booking.id },
    });
    await prisma.client.deleteMany({
      where: { id: client.id },
    });
    await prisma.availabilitySlot.deleteMany({
      where: { id: slot.id },
    });
    await prisma.service.deleteMany({
      where: { id: { in: [originalService.id, replacementService.id] } },
    });
    await prisma.serviceCategory.deleteMany({
      where: { id: category.id },
    });
    await prisma.adminUser.deleteMany({
      where: { id: owner.id },
    });
  }
});
