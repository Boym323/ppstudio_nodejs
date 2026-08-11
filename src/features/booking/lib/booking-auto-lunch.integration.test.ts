import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  AvailabilitySlotStatus,
  BookingActorType,
  BookingSource,
  BookingStatus,
} from "@prisma/client";

import { getPragueLocalDate, resolvePragueLocalDateTime } from "./booking-local-time";
import {
  buildSlotTimeOptions,
  filterTimeOptionsForAutoLunch,
} from "./booking-time-slots";
import {
  findBestAutoLunch,
  generateLunchCandidates,
} from "./booking-schedule-optimization";

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
  const [{ prisma }, bookingModule, engineModule] = await Promise.all([
    import("@/lib/prisma"),
    import("./booking-public"),
    import("./booking-public/engine"),
  ]);

  return {
    prisma,
    getPublicBookingCatalog: bookingModule.getPublicBookingCatalog,
    PublicBookingError: bookingModule.PublicBookingError,
    publicBookingErrorCodes: bookingModule.publicBookingErrorCodes,
    createBookingWithEngine: engineModule.createBookingWithEngine,
  };
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

function at(localDate: string, time: string) {
  const value = resolvePragueLocalDateTime(localDate, time);
  assert.ok(value);
  return value;
}

type Seed = {
  suffix: string;
  localDate: string;
  categoryId: string;
  serviceId: string;
  slotId: string;
  bookingIds: string[];
};

async function findIsolatedLocalDate() {
  const { prisma } = await loadModules();
  const today = getPragueLocalDate(new Date());

  for (let offset = 14; offset < 75; offset += 1) {
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

    if (slots === 0 && bookings === 0) {
      return localDate;
    }
  }

  throw new Error("Nepodařilo se najít izolovaný den pro test automatického oběda.");
}

async function createSeed(durationMinutes: number, cleanupMinutes = 0): Promise<Seed> {
  const { prisma } = await loadModules();
  const suffix = randomUUID().slice(0, 8);
  const localDate = await findIsolatedLocalDate();
  const category = await prisma.serviceCategory.create({
    data: { name: `Auto lunch ${suffix}`, slug: `auto-lunch-${suffix}` },
    select: { id: true },
  });
  const service = await prisma.service.create({
    data: {
      categoryId: category.id,
      name: `Auto lunch service ${suffix}`,
      publicName: `Auto lunch service ${suffix}`,
      slug: `auto-lunch-service-${suffix}`,
      durationMinutes,
      cleanupMinutes,
      isActive: true,
      isPubliclyBookable: true,
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

  return {
    suffix,
    localDate,
    categoryId: category.id,
    serviceId: service.id,
    slotId: slot.id,
    bookingIds: [],
  };
}

async function seedExistingBooking(seed: Seed, start: string, end: string) {
  const { prisma } = await loadModules();
  const client = await prisma.client.create({
    data: {
      fullName: `Auto lunch existing ${seed.suffix}`,
      email: `auto-lunch-existing-${seed.suffix}-${start.replace(":", "")}@example.com`,
      phone: "+420777123456",
    },
    select: { id: true },
  });
  const booking = await prisma.booking.create({
    data: {
      clientId: client.id,
      slotId: seed.slotId,
      serviceId: seed.serviceId,
      status: BookingStatus.CONFIRMED,
      clientNameSnapshot: `Auto lunch existing ${seed.suffix}`,
      clientEmailSnapshot: `auto-lunch-existing-${seed.suffix}@example.com`,
      clientPhoneSnapshot: "+420777123456",
      serviceNameSnapshot: `Auto lunch service ${seed.suffix}`,
      serviceDurationMinutes: (at(seed.localDate, end).getTime() - at(seed.localDate, start).getTime()) / 60_000,
      scheduledStartsAt: at(seed.localDate, start),
      scheduledEndsAt: at(seed.localDate, end),
      blockedUntil: at(seed.localDate, end),
      confirmedAt: new Date(),
    },
    select: { id: true },
  });
  seed.bookingIds.push(booking.id);
}

function bookingInput(seed: Seed, start: string, slotId = seed.slotId) {
  const unique = randomUUID().slice(0, 8);
  return {
    serviceId: seed.serviceId,
    slotId,
    startsAt: at(seed.localDate, start).toISOString(),
    client: {
      fullName: `Auto lunch client ${unique}`,
      email: `auto-lunch-${seed.suffix}-${unique}@example.com`,
      phone: `+42077${String(Number.parseInt(unique.slice(0, 6), 16) % 1_000_000).padStart(6, "0")}`,
    },
    source: BookingSource.WEB,
    status: BookingStatus.PENDING,
    isManual: false,
    allowManualOverride: false,
    actorType: BookingActorType.CLIENT,
    historyReason: "Test ochrany automatického oběda",
    sendClientEmail: false,
    includeCalendarAttachment: false,
    sendAdminNotification: false,
  } as const;
}

async function cleanupSeed(seed: Seed) {
  const { prisma } = await loadModules();
  await prisma.booking.deleteMany({
    where: { OR: [{ id: { in: seed.bookingIds } }, { serviceId: seed.serviceId }] },
  });
  await prisma.availabilitySlot.deleteMany({
    where: {
      startsAt: { gte: at(seed.localDate, "00:00"), lt: at(addCalendarDays(seed.localDate, 1), "00:00") },
    },
  });
  await prisma.client.deleteMany({ where: { email: { contains: `auto-lunch-${seed.suffix}` } } });
  await prisma.service.deleteMany({ where: { id: seed.serviceId } });
  await prisma.serviceCategory.deleteMany({ where: { id: seed.categoryId } });
}

async function withSeed(
  durationMinutes: number,
  cleanupMinutes: number,
  run: (seed: Seed) => Promise<void>,
) {
  const seed = await createSeed(durationMinutes, cleanupMinutes);
  try {
    await run(seed);
  } finally {
    await cleanupSeed(seed);
  }
}

async function expectSlotUnavailable(run: () => Promise<unknown>) {
  const { PublicBookingError, publicBookingErrorCodes } = await loadModules();
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof PublicBookingError);
    assert.equal(error.code, publicBookingErrorCodes.slotUnavailable);
    return true;
  });
}

dbTest("platná rezervace změní nejlepší čas oběda a vznikne", async () => {
  await withSeed(60, 0, async (seed) => {
    const { createBookingWithEngine } = await loadModules();
    await seedExistingBooking(seed, "11:00", "12:00");
    const availability = [{
      startsAt: at(seed.localDate, "09:00").getTime(),
      endsAt: at(seed.localDate, "17:00").getTime(),
    }];
    const lunchCandidates = generateLunchCandidates({ localDate: seed.localDate, availability });
    const before = findBestAutoLunch({
      active: true,
      availability,
      lunchCandidates,
      bookedBlocks: [{
        startsAt: at(seed.localDate, "11:00").getTime(),
        endsAt: at(seed.localDate, "12:00").getTime(),
      }],
    });
    const result = await createBookingWithEngine(bookingInput(seed, "12:00"));
    seed.bookingIds.push(result.bookingId);
    const after = findBestAutoLunch({
      active: true,
      availability,
      lunchCandidates,
      bookedBlocks: [{
        startsAt: at(seed.localDate, "11:00").getTime(),
        endsAt: at(seed.localDate, "13:00").getTime(),
      }],
    });
    assert.equal(result.scheduledStartsAt, at(seed.localDate, "12:00").toISOString());
    assert.equal(before?.startsAt, at(seed.localDate, "12:00").getTime());
    assert.equal(after?.startsAt, at(seed.localDate, "13:00").getTime());
  });
});

dbTest("rezervace spotřebující poslední lunch candidate vrátí SLOT_UNAVAILABLE", async () => {
  await withSeed(45, 0, async (seed) => {
    const { createBookingWithEngine } = await loadModules();
    await seedExistingBooking(seed, "11:00", "13:00");
    await expectSlotUnavailable(() => createBookingWithEngine(bookingInput(seed, "13:00")));
  });
});

dbTest("cleanup znemožňující poslední oběd vrátí SLOT_UNAVAILABLE", async () => {
  await withSeed(30, 15, async (seed) => {
    const { createBookingWithEngine } = await loadModules();
    await seedExistingBooking(seed, "11:45", "13:45");
    await expectSlotUnavailable(() => createBookingWithEngine(bookingInput(seed, "10:30")));
  });
});

dbTest("stale klientovi server odmítne dříve selectable termín", async () => {
  await withSeed(45, 0, async (seed) => {
    const { createBookingWithEngine, getPublicBookingCatalog } = await loadModules();
    const catalog = await getPublicBookingCatalog();
    const slot = catalog.slots.find((item) => item.id === seed.slotId);
    assert.ok(slot);
    const candidate = filterTimeOptionsForAutoLunch(
      buildSlotTimeOptions(slot, 45),
      { serviceDurationMinutes: 45, cleanupBlockMinutes: 0, capacity: 1, scheduleOptimization: catalog.scheduleOptimization },
    ).find((item) => item.startsAt === at(seed.localDate, "13:00").toISOString());
    assert.ok(candidate);

    await seedExistingBooking(seed, "11:00", "13:00");
    await expectSlotUnavailable(() => createBookingWithEngine(bookingInput(seed, "13:00")));
  });
});

dbTest("souběžné rezervace nikdy nespotřebují všechny možnosti oběda", async () => {
  await withSeed(45, 0, async (seed) => {
    const { prisma, createBookingWithEngine, publicBookingErrorCodes } = await loadModules();
    await prisma.availabilitySlot.update({
      where: { id: seed.slotId },
      data: { endsAt: at(seed.localDate, "12:00") },
    });
    const afternoonSlot = await prisma.availabilitySlot.create({
      data: {
        startsAt: at(seed.localDate, "12:00"),
        endsAt: at(seed.localDate, "17:00"),
        status: AvailabilitySlotStatus.PUBLISHED,
        publishedAt: new Date(),
      },
      select: { id: true },
    });
    await seedExistingBooking(seed, "11:45", "12:45");
    const results = await Promise.allSettled([
      createBookingWithEngine(bookingInput(seed, "11:00")),
      createBookingWithEngine(bookingInput(seed, "12:45", afternoonSlot.id)),
    ]);
    const fulfilled = results.filter(
      (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof createBookingWithEngine>>> =>
        result.status === "fulfilled",
    );
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    seed.bookingIds.push(...fulfilled.map((result) => result.value.bookingId));

    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.ok(rejected[0].reason instanceof Error);
    assert.ok("code" in rejected[0].reason);
    assert.equal(rejected[0].reason.code, publicBookingErrorCodes.slotUnavailable);
    assert.equal(await prisma.booking.count({ where: { serviceId: seed.serviceId } }), 2);
  });
});
