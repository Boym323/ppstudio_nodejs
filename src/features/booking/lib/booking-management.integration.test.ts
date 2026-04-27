import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { describe } from "node:test";

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

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

type SeedContext = {
  actorUserId: string;
  categoryId: string;
  serviceId: string;
  primaryClientId: string;
  secondaryClientId: string;
  manageableBookingId: string;
  manageableBookingUpdatedAt: string;
  manageableStartAt: string;
  manageableCurrentSlotId: string;
  replacementSlotId: string;
  replacementStartAt: string;
  otherBookingId: string;
  otherManageTokenRaw: string;
  manageTokenRaw: string;
  completedManageTokenRaw: string;
  cancelledManageTokenRaw: string;
  cancelTokenRaw: string;
  secondaryCancelTokenRaw: string;
  deadlineCancelTokenRaw: string;
  noShowCancelTokenRaw: string;
  tooLateManageTokenRaw: string;
  conflictSlotId: string;
  conflictStartAt: string;
  tooLateSlotId: string;
  tooLateBookingId: string;
  tooLateStartAt: string;
  outsideWindowSlotId: string;
  outsideWindowStartAt: string;
  completedBookingId: string;
  cancelledBookingId: string;
  noShowBookingId: string;
  createdBookingIds: string[];
  createdSlotIds: string[];
  createdTokenHashes: string[];
};

async function loadModules() {
  const [{ prisma }, managementModule, cancellationModule, actionTokenModule, prismaClientModule] =
    await Promise.all([
      import("@/lib/prisma"),
      import("./booking-management"),
      import("./booking-cancellation"),
      import("./booking-action-tokens"),
      import("@prisma/client"),
    ]);

  return {
    prisma,
    getPublicBookingManagementPageState: managementModule.getPublicBookingManagementPageState,
    reschedulePublicBookingByToken: managementModule.reschedulePublicBookingByToken,
    cancelPublicBookingByToken: cancellationModule.cancelPublicBookingByToken,
    hashBookingActionToken: actionTokenModule.hashBookingActionToken,
    BookingActionTokenType: prismaClientModule.BookingActionTokenType,
    BookingActorType: prismaClientModule.BookingActorType,
    BookingSource: prismaClientModule.BookingSource,
    BookingStatus: prismaClientModule.BookingStatus,
    EmailLogType: prismaClientModule.EmailLogType,
    AvailabilitySlotStatus: prismaClientModule.AvailabilitySlotStatus,
  };
}

function addHours(base: Date, hours: number) {
  return new Date(base.getTime() + hours * 60 * 60 * 1000);
}

function addDays(base: Date, days: number) {
  return addHours(base, days * 24);
}

async function findFreeStartAt(
  prisma: Awaited<ReturnType<typeof loadModules>>["prisma"],
  {
    earliest,
    latest,
    durationMinutes,
    preferredHour,
    preferredMinute,
  }: {
    earliest: Date;
    latest: Date;
    durationMinutes: number;
    preferredHour: number;
    preferredMinute: number;
  },
) {
  const candidate = new Date(earliest);
  candidate.setUTCSeconds(0, 0);

  if (
    candidate.getUTCHours() > preferredHour ||
    (candidate.getUTCHours() === preferredHour && candidate.getUTCMinutes() > preferredMinute)
  ) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }

  candidate.setUTCHours(preferredHour, preferredMinute, 0, 0);

  while (candidate < earliest) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }

  while (candidate <= latest) {
    const candidateEnd = addHours(candidate, durationMinutes / 60);
    const overlappingCount = await prisma.availabilitySlot.count({
      where: {
        startsAt: {
          lt: candidateEnd,
        },
        endsAt: {
          gt: candidate,
        },
      },
    });

    if (overlappingCount === 0) {
      return new Date(candidate);
    }

    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }

  throw new Error("Could not find a free availability slot window for booking-management integration test.");
}

async function findFreeStartWithin(
  prisma: Awaited<ReturnType<typeof loadModules>>["prisma"],
  {
    earliest,
    latest,
    durationMinutes,
  }: {
    earliest: Date;
    latest: Date;
    durationMinutes: number;
  },
) {
  const candidate = new Date(earliest);
  candidate.setUTCSeconds(0, 0);

  while (candidate <= latest) {
    const candidateEnd = addHours(candidate, durationMinutes / 60);
    const overlappingCount = await prisma.availabilitySlot.count({
      where: {
        startsAt: {
          lt: candidateEnd,
        },
        endsAt: {
          gt: candidate,
        },
      },
    });

    if (overlappingCount === 0) {
      return new Date(candidate);
    }

    candidate.setUTCMinutes(candidate.getUTCMinutes() + 5);
  }

  throw new Error("Could not find a near-term free availability slot window for booking-management integration test.");
}

async function createSeed() {
  const {
    prisma,
    hashBookingActionToken,
    BookingActionTokenType,
    BookingStatus,
    AvailabilitySlotStatus,
  } = await loadModules();

  const suffix = randomUUID().slice(0, 8);
  const now = new Date();
  const manageableStartAt = await findFreeStartAt(prisma, {
    earliest: addDays(now, 6),
    latest: addDays(now, 30),
    durationMinutes: 60,
    preferredHour: 2,
    preferredMinute: 11,
  });
  const manageableEndAt = addHours(manageableStartAt, 1);
  const replacementStartAt = await findFreeStartAt(prisma, {
    earliest: addDays(manageableStartAt, 2),
    latest: addDays(manageableStartAt, 20),
    durationMinutes: 60,
    preferredHour: 3,
    preferredMinute: 17,
  });
  const replacementEndAt = addHours(replacementStartAt, 1);
  const conflictStartAt = await findFreeStartAt(prisma, {
    earliest: addDays(replacementStartAt, 1),
    latest: addDays(replacementStartAt, 20),
    durationMinutes: 60,
    preferredHour: 4,
    preferredMinute: 23,
  });
  const conflictEndAt = addHours(conflictStartAt, 1);
  const tooLateStartAt = await findFreeStartAt(prisma, {
    earliest: addHours(now, 3),
    latest: addHours(now, 42),
    durationMinutes: 60,
    preferredHour: 22,
    preferredMinute: 29,
  });
  const tooLateEndAt = addHours(tooLateStartAt, 1);
  const outsideWindowStartAt = await findFreeStartWithin(prisma, {
    earliest: addHours(now, 0.1),
    latest: addHours(now, 1.5),
    durationMinutes: 60,
  });
  const outsideWindowEndAt = addHours(outsideWindowStartAt, 1);
  const completedStartAt = await findFreeStartAt(prisma, {
    earliest: addDays(now, 5),
    latest: addDays(now, 30),
    durationMinutes: 60,
    preferredHour: 5,
    preferredMinute: 31,
  });
  const completedEndAt = addHours(completedStartAt, 1);
  const cancelledStartAt = await findFreeStartAt(prisma, {
    earliest: addDays(now, 7),
    latest: addDays(now, 30),
    durationMinutes: 60,
    preferredHour: 6,
    preferredMinute: 37,
  });
  const cancelledEndAt = addHours(cancelledStartAt, 1);
  const noShowStartAt = await findFreeStartAt(prisma, {
    earliest: addDays(now, 4),
    latest: addDays(now, 30),
    durationMinutes: 60,
    preferredHour: 7,
    preferredMinute: 43,
  });
  const noShowEndAt = addHours(noShowStartAt, 1);
  const otherBookingStartAt = await findFreeStartAt(prisma, {
    earliest: addDays(now, 10),
    latest: addDays(now, 35),
    durationMinutes: 60,
    preferredHour: 8,
    preferredMinute: 49,
  });
  const otherBookingEndAt = addHours(otherBookingStartAt, 1);

  const actor = await prisma.adminUser.create({
    data: {
      email: `booking-manage-${suffix}@example.com`,
      name: `Booking Manage Test ${suffix}`,
      role: "OWNER",
      isActive: true,
    },
    select: { id: true },
  });

  const category = await prisma.serviceCategory.create({
    data: {
      name: `Manage category ${suffix}`,
      slug: `manage-category-${suffix}`,
      isActive: true,
    },
    select: { id: true },
  });

  const service = await prisma.service.create({
    data: {
      categoryId: category.id,
      name: `Manage service ${suffix}`,
      slug: `manage-service-${suffix}`,
      durationMinutes: 60,
      isActive: true,
      isPubliclyBookable: true,
    },
    select: { id: true },
  });

  const [primaryClient, secondaryClient] = await Promise.all([
    prisma.client.create({
      data: {
        fullName: `Klientka Manage ${suffix}`,
        email: `client-manage-${suffix}@example.com`,
        phone: "+420777123456",
        isActive: true,
      },
      select: { id: true },
    }),
    prisma.client.create({
      data: {
        fullName: `Kolize Manage ${suffix}`,
        email: `client-collision-${suffix}@example.com`,
        phone: "+420777654321",
        isActive: true,
      },
      select: { id: true },
    }),
  ]);

  const slots = await prisma.$transaction([
    prisma.availabilitySlot.create({
      data: {
        startsAt: manageableStartAt,
        endsAt: manageableEndAt,
        capacity: 1,
        status: AvailabilitySlotStatus.PUBLISHED,
        serviceRestrictionMode: "ANY",
        publishedAt: addDays(now, -1),
        createdByUserId: actor.id,
      },
      select: { id: true },
    }),
    prisma.availabilitySlot.create({
      data: {
        startsAt: replacementStartAt,
        endsAt: replacementEndAt,
        capacity: 1,
        status: AvailabilitySlotStatus.PUBLISHED,
        serviceRestrictionMode: "ANY",
        publishedAt: addDays(now, -1),
        createdByUserId: actor.id,
      },
      select: { id: true },
    }),
    prisma.availabilitySlot.create({
      data: {
        startsAt: conflictStartAt,
        endsAt: conflictEndAt,
        capacity: 1,
        status: AvailabilitySlotStatus.PUBLISHED,
        serviceRestrictionMode: "ANY",
        publishedAt: addDays(now, -1),
        createdByUserId: actor.id,
      },
      select: { id: true },
    }),
    prisma.availabilitySlot.create({
      data: {
        startsAt: tooLateStartAt,
        endsAt: tooLateEndAt,
        capacity: 1,
        status: AvailabilitySlotStatus.PUBLISHED,
        serviceRestrictionMode: "ANY",
        publishedAt: addDays(now, -1),
        createdByUserId: actor.id,
      },
      select: { id: true },
    }),
    prisma.availabilitySlot.create({
      data: {
        startsAt: outsideWindowStartAt,
        endsAt: outsideWindowEndAt,
        capacity: 1,
        status: AvailabilitySlotStatus.PUBLISHED,
        serviceRestrictionMode: "ANY",
        publishedAt: addDays(now, -1),
        createdByUserId: actor.id,
      },
      select: { id: true },
    }),
    prisma.availabilitySlot.create({
      data: {
        startsAt: completedStartAt,
        endsAt: completedEndAt,
        capacity: 1,
        status: AvailabilitySlotStatus.PUBLISHED,
        serviceRestrictionMode: "ANY",
        publishedAt: addDays(now, -1),
        createdByUserId: actor.id,
      },
      select: { id: true },
    }),
    prisma.availabilitySlot.create({
      data: {
        startsAt: cancelledStartAt,
        endsAt: cancelledEndAt,
        capacity: 1,
        status: AvailabilitySlotStatus.PUBLISHED,
        serviceRestrictionMode: "ANY",
        publishedAt: addDays(now, -1),
        createdByUserId: actor.id,
      },
      select: { id: true },
    }),
    prisma.availabilitySlot.create({
      data: {
        startsAt: noShowStartAt,
        endsAt: noShowEndAt,
        capacity: 1,
        status: AvailabilitySlotStatus.PUBLISHED,
        serviceRestrictionMode: "ANY",
        publishedAt: addDays(now, -1),
        createdByUserId: actor.id,
      },
      select: { id: true },
    }),
    prisma.availabilitySlot.create({
      data: {
        startsAt: otherBookingStartAt,
        endsAt: otherBookingEndAt,
        capacity: 1,
        status: AvailabilitySlotStatus.PUBLISHED,
        serviceRestrictionMode: "ANY",
        publishedAt: addDays(now, -1),
        createdByUserId: actor.id,
      },
      select: { id: true },
    }),
  ]);

  const [
    manageableBooking,
    otherBooking,
    conflictingBooking,
    tooLateBooking,
    completedBooking,
    cancelledBooking,
    noShowBooking,
  ] = await prisma.$transaction([
    prisma.booking.create({
      data: {
        clientId: primaryClient.id,
        slotId: slots[0].id,
        serviceId: service.id,
        source: "WEB",
        status: BookingStatus.CONFIRMED,
        clientNameSnapshot: `Klientka Manage ${suffix}`,
        clientEmailSnapshot: `client-manage-${suffix}@example.com`,
        clientPhoneSnapshot: "+420777123456",
        serviceNameSnapshot: `Manage service ${suffix}`,
        serviceDurationMinutes: 60,
        scheduledStartsAt: manageableStartAt,
        scheduledEndsAt: manageableEndAt,
        confirmedAt: addDays(now, -1),
        reminder24hQueuedAt: addHours(manageableStartAt, -24),
        reminder24hSentAt: addHours(manageableStartAt, -23),
      },
      select: { id: true, updatedAt: true },
    }),
    prisma.booking.create({
      data: {
        clientId: primaryClient.id,
        slotId: slots[8].id,
        serviceId: service.id,
        source: "WEB",
        status: BookingStatus.CONFIRMED,
        clientNameSnapshot: `Klientka Manage ${suffix}`,
        clientEmailSnapshot: `client-manage-${suffix}@example.com`,
        clientPhoneSnapshot: "+420777123456",
        serviceNameSnapshot: `Manage service ${suffix}`,
        serviceDurationMinutes: 60,
        scheduledStartsAt: otherBookingStartAt,
        scheduledEndsAt: otherBookingEndAt,
        confirmedAt: addDays(now, -1),
      },
      select: { id: true },
    }),
    prisma.booking.create({
      data: {
        clientId: secondaryClient.id,
        slotId: slots[2].id,
        serviceId: service.id,
        source: "WEB",
        status: BookingStatus.CONFIRMED,
        clientNameSnapshot: `Kolize Manage ${suffix}`,
        clientEmailSnapshot: `client-collision-${suffix}@example.com`,
        clientPhoneSnapshot: "+420777654321",
        serviceNameSnapshot: `Manage service ${suffix}`,
        serviceDurationMinutes: 60,
        scheduledStartsAt: conflictStartAt,
        scheduledEndsAt: conflictEndAt,
        confirmedAt: addDays(now, -1),
      },
      select: { id: true },
    }),
    prisma.booking.create({
      data: {
        clientId: primaryClient.id,
        slotId: slots[3].id,
        serviceId: service.id,
        source: "WEB",
        status: BookingStatus.CONFIRMED,
        clientNameSnapshot: `Klientka Manage ${suffix}`,
        clientEmailSnapshot: `client-manage-${suffix}@example.com`,
        clientPhoneSnapshot: "+420777123456",
        serviceNameSnapshot: `Manage service ${suffix}`,
        serviceDurationMinutes: 60,
        scheduledStartsAt: tooLateStartAt,
        scheduledEndsAt: tooLateEndAt,
        confirmedAt: addDays(now, -1),
      },
      select: { id: true },
    }),
    prisma.booking.create({
      data: {
        clientId: primaryClient.id,
        slotId: slots[5].id,
        serviceId: service.id,
        source: "WEB",
        status: BookingStatus.COMPLETED,
        clientNameSnapshot: `Klientka Manage ${suffix}`,
        clientEmailSnapshot: `client-manage-${suffix}@example.com`,
        clientPhoneSnapshot: "+420777123456",
        serviceNameSnapshot: `Manage service ${suffix}`,
        serviceDurationMinutes: 60,
        scheduledStartsAt: completedStartAt,
        scheduledEndsAt: completedEndAt,
        confirmedAt: addDays(now, -2),
        completedAt: addDays(now, -1),
      },
      select: { id: true },
    }),
    prisma.booking.create({
      data: {
        clientId: primaryClient.id,
        slotId: slots[6].id,
        serviceId: service.id,
        source: "WEB",
        status: BookingStatus.CANCELLED,
        clientNameSnapshot: `Klientka Manage ${suffix}`,
        clientEmailSnapshot: `client-manage-${suffix}@example.com`,
        clientPhoneSnapshot: "+420777123456",
        serviceNameSnapshot: `Manage service ${suffix}`,
        serviceDurationMinutes: 60,
        scheduledStartsAt: cancelledStartAt,
        scheduledEndsAt: cancelledEndAt,
        confirmedAt: addDays(now, -2),
        cancelledAt: addDays(now, -1),
      },
      select: { id: true },
    }),
    prisma.booking.create({
      data: {
        clientId: primaryClient.id,
        slotId: slots[7].id,
        serviceId: service.id,
        source: "WEB",
        status: BookingStatus.NO_SHOW,
        clientNameSnapshot: `Klientka Manage ${suffix}`,
        clientEmailSnapshot: `client-manage-${suffix}@example.com`,
        clientPhoneSnapshot: "+420777123456",
        serviceNameSnapshot: `Manage service ${suffix}`,
        serviceDurationMinutes: 60,
        scheduledStartsAt: noShowStartAt,
        scheduledEndsAt: noShowEndAt,
        confirmedAt: addDays(now, -2),
      },
      select: { id: true },
    }),
  ]);

  const tokenFixtures = [
    {
      rawToken: `manage-${suffix}`,
      bookingId: manageableBooking.id,
      type: BookingActionTokenType.RESCHEDULE,
    },
    {
      rawToken: `manage-other-${suffix}`,
      bookingId: otherBooking.id,
      type: BookingActionTokenType.RESCHEDULE,
    },
    {
      rawToken: `manage-completed-${suffix}`,
      bookingId: completedBooking.id,
      type: BookingActionTokenType.RESCHEDULE,
    },
    {
      rawToken: `manage-cancelled-${suffix}`,
      bookingId: cancelledBooking.id,
      type: BookingActionTokenType.RESCHEDULE,
    },
    {
      rawToken: `manage-too-late-${suffix}`,
      bookingId: tooLateBooking.id,
      type: BookingActionTokenType.RESCHEDULE,
    },
    {
      rawToken: `cancel-${suffix}`,
      bookingId: manageableBooking.id,
      type: BookingActionTokenType.CANCEL,
    },
    {
      rawToken: `cancel-secondary-${suffix}`,
      bookingId: manageableBooking.id,
      type: BookingActionTokenType.CANCEL,
    },
    {
      rawToken: `cancel-deadline-${suffix}`,
      bookingId: tooLateBooking.id,
      type: BookingActionTokenType.CANCEL,
    },
    {
      rawToken: `cancel-no-show-${suffix}`,
      bookingId: noShowBooking.id,
      type: BookingActionTokenType.CANCEL,
    },
  ];

  await prisma.bookingActionToken.createMany({
    data: tokenFixtures.map((fixture) => ({
      bookingId: fixture.bookingId,
      type: fixture.type,
      tokenHash: hashBookingActionToken(fixture.rawToken),
      expiresAt: addDays(now, 30),
      lastSentAt: now,
    })),
  });

  return {
    actorUserId: actor.id,
    categoryId: category.id,
    serviceId: service.id,
    primaryClientId: primaryClient.id,
    secondaryClientId: secondaryClient.id,
    manageableBookingId: manageableBooking.id,
    manageableBookingUpdatedAt: manageableBooking.updatedAt.toISOString(),
    manageableStartAt: manageableStartAt.toISOString(),
    manageableCurrentSlotId: slots[0].id,
    replacementSlotId: slots[1].id,
    replacementStartAt: replacementStartAt.toISOString(),
    otherBookingId: otherBooking.id,
    otherManageTokenRaw: `manage-other-${suffix}`,
    manageTokenRaw: `manage-${suffix}`,
    completedManageTokenRaw: `manage-completed-${suffix}`,
    cancelledManageTokenRaw: `manage-cancelled-${suffix}`,
    cancelTokenRaw: `cancel-${suffix}`,
    secondaryCancelTokenRaw: `cancel-secondary-${suffix}`,
    deadlineCancelTokenRaw: `cancel-deadline-${suffix}`,
    noShowCancelTokenRaw: `cancel-no-show-${suffix}`,
    tooLateManageTokenRaw: `manage-too-late-${suffix}`,
    conflictSlotId: slots[2].id,
    conflictStartAt: conflictStartAt.toISOString(),
    tooLateSlotId: slots[3].id,
    tooLateBookingId: tooLateBooking.id,
    tooLateStartAt: tooLateStartAt.toISOString(),
    outsideWindowSlotId: slots[4].id,
    outsideWindowStartAt: outsideWindowStartAt.toISOString(),
    completedBookingId: completedBooking.id,
    cancelledBookingId: cancelledBooking.id,
    noShowBookingId: noShowBooking.id,
    createdBookingIds: [
      manageableBooking.id,
      otherBooking.id,
      conflictingBooking.id,
      tooLateBooking.id,
      completedBooking.id,
      cancelledBooking.id,
      noShowBooking.id,
    ],
    createdSlotIds: slots.map((slot) => slot.id),
    createdTokenHashes: tokenFixtures.map((fixture) => hashBookingActionToken(fixture.rawToken)),
  } satisfies SeedContext;
}

async function cleanupSeed(seed: SeedContext) {
  const { prisma } = await loadModules();

  await prisma.emailLog.deleteMany({
    where: {
      bookingId: {
        in: seed.createdBookingIds,
      },
    },
  });
  await prisma.bookingStatusHistory.deleteMany({
    where: {
      bookingId: {
        in: seed.createdBookingIds,
      },
    },
  });
  await prisma.bookingRescheduleLog.deleteMany({
    where: {
      bookingId: {
        in: seed.createdBookingIds,
      },
    },
  });
  await prisma.bookingActionToken.deleteMany({
    where: {
      OR: [
        {
          bookingId: {
            in: seed.createdBookingIds,
          },
        },
        {
          tokenHash: {
            in: seed.createdTokenHashes,
          },
        },
      ],
    },
  });
  await prisma.booking.deleteMany({
    where: {
      id: {
        in: seed.createdBookingIds,
      },
    },
  });
  await prisma.availabilitySlot.deleteMany({
    where: {
      id: {
        in: seed.createdSlotIds,
      },
    },
  });
  await prisma.client.deleteMany({
    where: {
      id: {
        in: [seed.primaryClientId, seed.secondaryClientId],
      },
    },
  });
  await prisma.service.deleteMany({ where: { id: seed.serviceId } });
  await prisma.serviceCategory.deleteMany({ where: { id: seed.categoryId } });
  await prisma.adminUser.deleteMany({ where: { id: seed.actorUserId } });
}

describe("public booking access", () => {
  dbTest("returns booking detail for valid management token", async () => {
    const seed = await createSeed();
    const {
      prisma,
      getPublicBookingManagementPageState,
      hashBookingActionToken,
      BookingActionTokenType,
    } = await loadModules();

    try {
      const result = await getPublicBookingManagementPageState(seed.manageTokenRaw);

      assert.equal(result.status, "ready");
      if (result.status !== "ready") {
        throw new Error("Expected ready booking-management state.");
      }

      assert.equal(result.bookingId, seed.manageableBookingId);
      assert.equal(result.serviceId, seed.serviceId);
      assert.equal(result.serviceDurationMinutes, 60);
      assert.match(result.statusLabel, /Potvrzená/i);
      assert.equal(result.scheduledStartsAt, seed.manageableStartAt);
      assert.ok(result.slots.some((slot) => slot.id === seed.replacementSlotId));
      assert.match(result.cancellationUrl, /\/rezervace\/storno\//);

      const issuedRawToken = result.cancellationUrl.split("/").at(-1);
      assert.ok(issuedRawToken);

      const issuedCancellationToken = await prisma.bookingActionToken.findUnique({
        where: {
          tokenHash: hashBookingActionToken(issuedRawToken ?? ""),
        },
        select: {
          bookingId: true,
          type: true,
        },
      });

      assert.deepEqual(issuedCancellationToken, {
        bookingId: seed.manageableBookingId,
        type: BookingActionTokenType.CANCEL,
      });
    } finally {
      await cleanupSeed(seed);
    }
  });

  dbTest("rejects booking detail for invalid token", async () => {
    const seed = await createSeed();
    const { getPublicBookingManagementPageState } = await loadModules();

    try {
      const result = await getPublicBookingManagementPageState(`missing-${randomUUID()}`);

      assert.equal(result.status, "invalid");
      assert.match(result.message, /neplatný nebo už neexistuje/i);
    } finally {
      await cleanupSeed(seed);
    }
  });

  dbTest("does not allow managing booking with token of another booking", async () => {
    const seed = await createSeed();
    const { getPublicBookingManagementPageState } = await loadModules();

    try {
      const ownBooking = await getPublicBookingManagementPageState(seed.manageTokenRaw);
      const otherBooking = await getPublicBookingManagementPageState(seed.otherManageTokenRaw);

      assert.equal(ownBooking.status, "ready");
      assert.equal(otherBooking.status, "ready");

      if (ownBooking.status !== "ready" || otherBooking.status !== "ready") {
        throw new Error("Expected both management tokens to resolve to ready state.");
      }

      assert.equal(ownBooking.bookingId, seed.manageableBookingId);
      assert.equal(otherBooking.bookingId, seed.otherBookingId);
      assert.notEqual(ownBooking.bookingId, otherBooking.bookingId);
    } finally {
      await cleanupSeed(seed);
    }
  });

  dbTest("returns blocked state for bookings that public management no longer supports", async () => {
    const seed = await createSeed();
    const { getPublicBookingManagementPageState } = await loadModules();

    try {
      const cancelled = await getPublicBookingManagementPageState(seed.cancelledManageTokenRaw);
      const completed = await getPublicBookingManagementPageState(seed.completedManageTokenRaw);
      const deadlineBlocked = await getPublicBookingManagementPageState(seed.tooLateManageTokenRaw);

      assert.equal(cancelled.status, "already_cancelled");
      assert.equal(completed.status, "not_reschedulable");
      assert.equal(deadlineBlocked.status, "not_reschedulable");
      assert.match(deadlineBlocked.message, /méně než 48 hodin/i);
    } finally {
      await cleanupSeed(seed);
    }
  });
});

describe("cancel booking flow", () => {
  dbTest("cancels confirmed booking when token is valid", async () => {
    const seed = await createSeed();
    const {
      prisma,
      cancelPublicBookingByToken,
      hashBookingActionToken,
      BookingActorType,
      BookingSource,
      BookingStatus,
      EmailLogType,
    } = await loadModules();

    try {
      const result = await cancelPublicBookingByToken(seed.cancelTokenRaw);

      assert.equal(result.status, "cancelled");
      if (result.status !== "cancelled") {
        throw new Error("Expected booking cancellation to succeed.");
      }

      const booking = await prisma.booking.findUniqueOrThrow({
        where: { id: seed.manageableBookingId },
        select: {
          status: true,
          cancelledAt: true,
        },
      });

      assert.equal(booking.status, BookingStatus.CANCELLED);
      assert.ok(booking.cancelledAt);

      const statusHistory = await prisma.bookingStatusHistory.findFirstOrThrow({
        where: {
          bookingId: seed.manageableBookingId,
          reason: "public-cancellation-flow-v1",
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      assert.equal(statusHistory.actorType, BookingActorType.CLIENT);
      assert.equal(statusHistory.status, BookingStatus.CANCELLED);
      assert.deepEqual(statusHistory.metadata, {
        source: BookingSource.WEB,
        via: "cancellation-token",
      });

      const primaryToken = await prisma.bookingActionToken.findUniqueOrThrow({
        where: {
          tokenHash: hashBookingActionToken(seed.cancelTokenRaw),
        },
        select: {
          usedAt: true,
          revokedAt: true,
        },
      });
      const siblingToken = await prisma.bookingActionToken.findUniqueOrThrow({
        where: {
          tokenHash: hashBookingActionToken(seed.secondaryCancelTokenRaw),
        },
        select: {
          usedAt: true,
          revokedAt: true,
        },
      });

      assert.ok(primaryToken.usedAt);
      assert.equal(primaryToken.revokedAt, null);
      assert.equal(siblingToken.usedAt, null);
      assert.ok(siblingToken.revokedAt);

      const emailLogs = await prisma.emailLog.findMany({
        where: {
          bookingId: seed.manageableBookingId,
          type: EmailLogType.BOOKING_CANCELLED,
        },
        orderBy: {
          recipientEmail: "asc",
        },
        select: {
          recipientEmail: true,
          templateKey: true,
        },
      });

      assert.deepEqual(
        emailLogs.map((emailLog) => emailLog.templateKey).sort(),
        ["admin-booking-cancelled-v1", "booking-cancelled-v1"],
      );
      assert.equal(emailLogs.length, 2);
    } finally {
      await cleanupSeed(seed);
    }
  });

  dbTest("rejects cancellation after deadline and leaves booking unchanged", async () => {
    const seed = await createSeed();
    const { prisma, cancelPublicBookingByToken, BookingStatus, EmailLogType } = await loadModules();

    try {
      const result = await cancelPublicBookingByToken(seed.deadlineCancelTokenRaw);

      assert.equal(result.status, "not_cancellable");
      assert.match(result.message, /méně než 48 hodin/i);

      const deadlineBooking = await prisma.booking.findUniqueOrThrow({
        where: { id: seed.tooLateBookingId },
        select: {
          status: true,
          cancelledAt: true,
        },
      });

      assert.equal(deadlineBooking.status, BookingStatus.CONFIRMED);
      assert.equal(deadlineBooking.cancelledAt, null);

      const historyCount = await prisma.bookingStatusHistory.count({
        where: {
          bookingId: seed.tooLateBookingId,
          reason: "public-cancellation-flow-v1",
        },
      });
      const emailCount = await prisma.emailLog.count({
        where: {
          bookingId: seed.tooLateBookingId,
          type: EmailLogType.BOOKING_CANCELLED,
        },
      });

      assert.equal(historyCount, 0);
      assert.equal(emailCount, 0);
    } finally {
      await cleanupSeed(seed);
    }
  });

  dbTest("rejects cancellation for terminal booking states", async () => {
    const seed = await createSeed();
    const { prisma, cancelPublicBookingByToken, BookingStatus } = await loadModules();

    try {
      const result = await cancelPublicBookingByToken(seed.noShowCancelTokenRaw);

      assert.equal(result.status, "not_cancellable");
      assert.match(result.message, /už nejde přes storno odkaz upravit/i);

      const booking = await prisma.booking.findUniqueOrThrow({
        where: { id: seed.noShowBookingId },
        select: {
          status: true,
        },
      });

      assert.equal(booking.status, BookingStatus.NO_SHOW);
    } finally {
      await cleanupSeed(seed);
    }
  });
});

describe("reschedule booking flow", () => {
  dbTest("reschedules confirmed booking to a valid free slot", async () => {
    const seed = await createSeed();
    const {
      prisma,
      reschedulePublicBookingByToken,
      BookingActionTokenType,
      EmailLogType,
    } = await loadModules();

    try {
      const result = await reschedulePublicBookingByToken({
        token: seed.manageTokenRaw,
        slotId: seed.replacementSlotId,
        newStartAt: seed.replacementStartAt,
        expectedUpdatedAt: seed.manageableBookingUpdatedAt,
      });

      assert.equal(result.status, "rescheduled");
      if (result.status !== "rescheduled") {
        throw new Error("Expected public reschedule to succeed.");
      }

      const booking = await prisma.booking.findUniqueOrThrow({
        where: { id: seed.manageableBookingId },
        select: {
          slotId: true,
          scheduledStartsAt: true,
          scheduledEndsAt: true,
          rescheduleCount: true,
          reminder24hQueuedAt: true,
          reminder24hSentAt: true,
        },
      });

      assert.equal(booking.slotId, seed.replacementSlotId);
      assert.equal(booking.scheduledStartsAt.toISOString(), seed.replacementStartAt);
      assert.equal(booking.scheduledEndsAt.toISOString(), addHours(new Date(seed.replacementStartAt), 1).toISOString());
      assert.equal(booking.rescheduleCount, 1);
      assert.equal(booking.reminder24hQueuedAt, null);
      assert.equal(booking.reminder24hSentAt, null);

      const rescheduleLog = await prisma.bookingRescheduleLog.findFirstOrThrow({
        where: { bookingId: seed.manageableBookingId },
        orderBy: { createdAt: "desc" },
      });

      assert.equal(rescheduleLog.changedByUserId, null);
      assert.equal(rescheduleLog.changedByClient, true);
      assert.equal(rescheduleLog.newStartAt.toISOString(), seed.replacementStartAt);

      const emailLog = await prisma.emailLog.findFirstOrThrow({
        where: {
          bookingId: seed.manageableBookingId,
          type: EmailLogType.BOOKING_RESCHEDULED,
        },
        orderBy: { createdAt: "desc" },
        select: {
          templateKey: true,
          payload: true,
          actionTokenId: true,
        },
      });

      assert.equal(emailLog.templateKey, "booking-rescheduled-v1");
      assert.equal(typeof emailLog.payload, "object");
      assert.ok(emailLog.payload && typeof emailLog.payload === "object" && !Array.isArray(emailLog.payload));
      const payload = emailLog.payload as Record<string, unknown>;
      assert.ok("manageReservationUrl" in payload);
      assert.ok("cancellationUrl" in payload);
      assert.ok("includeCalendarAttachment" in payload);
      assert.equal(
        (payload as { includeCalendarAttachment: boolean }).includeCalendarAttachment,
        true,
      );

      const newActionTokens = await prisma.bookingActionToken.findMany({
        where: {
          bookingId: seed.manageableBookingId,
          type: {
            in: [BookingActionTokenType.RESCHEDULE, BookingActionTokenType.CANCEL],
          },
        },
        select: {
          type: true,
        },
      });

      const tokenTypes = newActionTokens.map((token) => token.type);
      assert.ok(tokenTypes.filter((type) => type === BookingActionTokenType.RESCHEDULE).length >= 2);
      assert.ok(tokenTypes.filter((type) => type === BookingActionTokenType.CANCEL).length >= 3);
    } finally {
      await cleanupSeed(seed);
    }
  });

  dbTest("rejects reschedule when new slot collides and keeps state unchanged", async () => {
    const seed = await createSeed();
    const {
      prisma,
      reschedulePublicBookingByToken,
      BookingStatus,
      EmailLogType,
    } = await loadModules();

    try {
      await assert.rejects(
        reschedulePublicBookingByToken({
          token: seed.manageTokenRaw,
          slotId: seed.conflictSlotId,
          newStartAt: seed.conflictStartAt,
          expectedUpdatedAt: seed.manageableBookingUpdatedAt,
        }),
        (error: unknown) =>
          typeof error === "object"
          && error !== null
          && "code" in error
          && (error as { code: string }).code === "CONFLICT",
      );

      const booking = await prisma.booking.findUniqueOrThrow({
        where: { id: seed.manageableBookingId },
        select: {
          slotId: true,
          status: true,
          scheduledStartsAt: true,
        },
      });

      assert.equal(booking.slotId, seed.manageableCurrentSlotId);
      assert.equal(booking.status, BookingStatus.CONFIRMED);

      const historyCount = await prisma.bookingRescheduleLog.count({
        where: {
          bookingId: seed.manageableBookingId,
        },
      });
      const emailCount = await prisma.emailLog.count({
        where: {
          bookingId: seed.manageableBookingId,
          type: EmailLogType.BOOKING_RESCHEDULED,
        },
      });

      assert.equal(historyCount, 0);
      assert.equal(emailCount, 0);
    } finally {
      await cleanupSeed(seed);
    }
  });

  dbTest("rejects reschedule to the same term and keeps state unchanged", async () => {
    const seed = await createSeed();
    const { prisma, reschedulePublicBookingByToken, EmailLogType } = await loadModules();

    try {
      await assert.rejects(
        reschedulePublicBookingByToken({
          token: seed.manageTokenRaw,
          slotId: seed.manageableCurrentSlotId,
          newStartAt: seed.manageableStartAt,
          expectedUpdatedAt: seed.manageableBookingUpdatedAt,
        }),
        (error: unknown) =>
          typeof error === "object"
          && error !== null
          && "code" in error
          && (error as { code: string }).code === "SAME_TERM",
      );

      const historyCount = await prisma.bookingRescheduleLog.count({
        where: {
          bookingId: seed.manageableBookingId,
        },
      });
      const emailCount = await prisma.emailLog.count({
        where: {
          bookingId: seed.manageableBookingId,
          type: EmailLogType.BOOKING_RESCHEDULED,
        },
      });

      assert.equal(historyCount, 0);
      assert.equal(emailCount, 0);
    } finally {
      await cleanupSeed(seed);
    }
  });

  dbTest("rejects reschedule outside the public online window", async () => {
    const seed = await createSeed();
    const { prisma, reschedulePublicBookingByToken, EmailLogType } = await loadModules();

    try {
      await assert.rejects(
        reschedulePublicBookingByToken({
          token: seed.manageTokenRaw,
          slotId: seed.outsideWindowSlotId,
          newStartAt: seed.outsideWindowStartAt,
          expectedUpdatedAt: seed.manageableBookingUpdatedAt,
        }),
        (error: unknown) =>
          typeof error === "object"
          && error !== null
          && "code" in error
          && (error as { code: string }).code === "SLOT_NOT_ALLOWED",
      );

      const booking = await prisma.booking.findUniqueOrThrow({
        where: { id: seed.manageableBookingId },
        select: {
          slotId: true,
          scheduledStartsAt: true,
        },
      });

      assert.equal(booking.slotId, seed.manageableCurrentSlotId);
      assert.notEqual(booking.scheduledStartsAt.toISOString(), seed.outsideWindowStartAt);

      const historyCount = await prisma.bookingRescheduleLog.count({
        where: {
          bookingId: seed.manageableBookingId,
        },
      });
      const emailCount = await prisma.emailLog.count({
        where: {
          bookingId: seed.manageableBookingId,
          type: EmailLogType.BOOKING_RESCHEDULED,
        },
      });

      assert.equal(historyCount, 0);
      assert.equal(emailCount, 0);
    } finally {
      await cleanupSeed(seed);
    }
  });

  dbTest("rejects reschedule for bookings in terminal states", async () => {
    const seed = await createSeed();
    const { reschedulePublicBookingByToken } = await loadModules();

    try {
      const result = await reschedulePublicBookingByToken({
        token: seed.completedManageTokenRaw,
        slotId: seed.replacementSlotId,
        newStartAt: seed.replacementStartAt,
        expectedUpdatedAt: seed.manageableBookingUpdatedAt,
      });

      assert.equal(result.status, "not_reschedulable");
    } finally {
      await cleanupSeed(seed);
    }
  });
});
