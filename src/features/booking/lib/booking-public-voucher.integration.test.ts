import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { describe } from "node:test";

import {
  AvailabilitySlotStatus,
  BookingAcquisitionSource,
  BookingStatus,
  EmailLogType,
  VoucherStatus,
  VoucherType,
} from "@/generated/prisma/browser";
import {
  getNextCalendarDate,
  getPragueLocalDate,
  resolvePragueLocalDateTime,
} from "./booking-local-time";

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

type SeedContext = {
  suffix: string;
  categoryId: string;
  serviceId: string;
  otherServiceId: string;
  createdBookingIds: string[];
  createdSlotIds: string[];
  cleanupSlotWindows: Array<{ startsAt: Date; endsAt: Date }>;
  createdVoucherIds: string[];
};

async function loadModules() {
  const [{ prisma }, bookingModule, adminBookingModule] = await Promise.all([
    import("@/lib/prisma"),
    import("./booking-public"),
    import("@/features/admin/lib/admin-booking"),
  ]);

  return {
    prisma,
    createPublicBooking: bookingModule.createPublicBooking,
    PublicBookingError: bookingModule.PublicBookingError,
    publicBookingErrorCodes: bookingModule.publicBookingErrorCodes,
    getAdminBookingDetailData: adminBookingModule.getAdminBookingDetailData,
  };
}

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

async function findIsolatedSlotStart(
  context: SeedContext,
  durationMinutes: number,
  minimumDayOffset = 14,
) {
  const { prisma } = await loadModules();
  const { getBookingPolicySettings } = await import("@/lib/site-settings");
  const { maxAdvanceDays } = await getBookingPolicySettings();
  const activeStatuses = [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.COMPLETED];
  const daySeed = parseInt(context.suffix.slice(0, 4), 16);
  const hourSeed = parseInt(context.suffix.slice(4, 6), 16);
  const minuteSeed = parseInt(context.suffix.slice(6, 8), 16);
  const hourCandidates = [18, 19, 20, 21].map((hour, index, list) => list[(index + hourSeed) % list.length] ?? hour);
  const minuteCandidates = [0, 15, 30, 45].map(
    (minute, index, list) => list[(index + minuteSeed) % list.length] ?? minute,
  );

  const dayOffsetRange = maxAdvanceDays - minimumDayOffset;

  if (dayOffsetRange < 1) {
    throw new Error("Booking policy neposkytuje dostatecne testovaci okno pro verejnou rezervaci.");
  }

  for (let dayStep = 0; dayStep < dayOffsetRange; dayStep += 1) {
    const dayOffset = minimumDayOffset + ((daySeed + dayStep) % dayOffsetRange);

    for (const hour of hourCandidates) {
      for (const minute of minuteCandidates) {
        const startsAt = addDays(new Date(), dayOffset);
        startsAt.setUTCHours(hour, minute, 0, 0);
        const localDate = getPragueLocalDate(startsAt);
        const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);
        const endLocalDate = getPragueLocalDate(new Date(endsAt.getTime() - 1));
        const nextLocalDate = getNextCalendarDate(endLocalDate);
        const dayStartsAt = resolvePragueLocalDateTime(localDate, "00:00");
        const dayEndsAt = nextLocalDate ? resolvePragueLocalDateTime(nextLocalDate, "00:00") : null;

        if (!dayStartsAt || !dayEndsAt) {
          continue;
        }

        const [overlappingSlots, overlappingBookings] = await Promise.all([
          prisma.availabilitySlot.count({
            where: {
              startsAt: { lt: dayEndsAt },
              endsAt: { gt: dayStartsAt },
            },
          }),
          prisma.booking.count({
            where: {
              status: {
                in: activeStatuses,
              },
              scheduledStartsAt: {
                lt: dayEndsAt,
              },
              OR: [
                {
                  blockedUntil: {
                    gt: dayStartsAt,
                  },
                },
                {
                  blockedUntil: null,
                  scheduledEndsAt: {
                    gt: dayStartsAt,
                  },
                },
              ],
            },
          }),
        ]);

        if (overlappingSlots === 0 && overlappingBookings === 0) {
          return startsAt;
        }
      }
    }
  }

  throw new Error("Nepodařilo se najít izolované testovací okno pro veřejnou rezervaci.");
}

function buildBookingInput(context: SeedContext, slot: { id: string; startsAt: Date }, voucherCode?: string) {
  const unique = randomUUID().slice(0, 8);
  const uniquePhoneSuffix = String(parseInt(unique.slice(0, 6), 16) % 1_000_000).padStart(6, "0");

  return {
    serviceId: context.serviceId,
    slotId: slot.id,
    startsAt: slot.startsAt.toISOString(),
    fullName: `Voucher Klientka ${unique}`,
    email: `booking-voucher-${context.suffix}-${unique}@example.com`,
    phone: `+42077${uniquePhoneSuffix}`,
    clientNote: undefined,
    voucherCode,
    acquisition: {
      source: BookingAcquisitionSource.DIRECT,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      referrerHost: null,
    },
  };
}

async function createSeed(): Promise<SeedContext> {
  const { prisma } = await loadModules();
  const suffix = randomUUID().slice(0, 8);
  const category = await prisma.serviceCategory.create({
    data: {
      name: `Booking voucher ${suffix}`,
      slug: `booking-voucher-${suffix}`,
    },
  });
  const [service, otherService] = await Promise.all([
    prisma.service.create({
      data: {
        categoryId: category.id,
        name: "Veřejná služba voucher",
        publicName: "Veřejná služba voucher",
        slug: `booking-voucher-service-${suffix}`,
        durationMinutes: 60,
        priceFromCzk: 1200,
      },
    }),
    prisma.service.create({
      data: {
        categoryId: category.id,
        name: "Jiná služba voucher",
        publicName: "Jiná služba voucher",
        slug: `booking-voucher-other-${suffix}`,
        durationMinutes: 45,
        priceFromCzk: 900,
      },
    }),
  ]);

  return {
    suffix,
    categoryId: category.id,
    serviceId: service.id,
    otherServiceId: otherService.id,
    createdBookingIds: [],
    createdSlotIds: [],
    cleanupSlotWindows: [],
    createdVoucherIds: [],
  };
}

async function cleanupSeed(context: SeedContext) {
  const { prisma } = await loadModules();

  await prisma.voucherRedemption.deleteMany({
    where: {
      OR: [
        { voucherId: { in: context.createdVoucherIds } },
        { bookingId: { in: context.createdBookingIds } },
      ],
    },
  });
  await prisma.emailLog.deleteMany({ where: { bookingId: { in: context.createdBookingIds } } });
  await prisma.booking.deleteMany({ where: { id: { in: context.createdBookingIds } } });
  await prisma.voucher.deleteMany({ where: { id: { in: context.createdVoucherIds } } });
  await prisma.availabilitySlot.deleteMany({ where: { id: { in: context.createdSlotIds } } });
  if (context.cleanupSlotWindows.length > 0) {
    await prisma.availabilitySlot.deleteMany({
      where: {
        OR: context.cleanupSlotWindows.map((window) => ({
          startsAt: { gte: window.startsAt, lt: window.endsAt },
        })),
      },
    });
  }
  await prisma.client.deleteMany({
    where: {
      email: {
        contains: `booking-voucher-${context.suffix}`,
      },
    },
  });
  await prisma.service.deleteMany({ where: { id: { in: [context.serviceId, context.otherServiceId] } } });
  await prisma.serviceCategory.deleteMany({ where: { id: context.categoryId } });
}

async function withSeed(run: (context: SeedContext) => Promise<void>) {
  const context = await createSeed();

  try {
    await run(context);
  } finally {
    await cleanupSeed(context);
  }
}

async function createSlot(context: SeedContext, offsetDays = context.createdSlotIds.length + 3) {
  const { prisma } = await loadModules();
  const startsAt = await findIsolatedSlotStart(context, 60, Math.max(offsetDays, 14));
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
  const slot = await prisma.availabilitySlot.create({
    data: {
      startsAt,
      endsAt,
      status: AvailabilitySlotStatus.PUBLISHED,
      publishedAt: new Date(),
    },
  });

  context.createdSlotIds.push(slot.id);

  return slot;
}

async function createPublishedSlot(
  context: SeedContext,
  startsAt: Date,
  durationMinutes: number,
) {
  const { prisma } = await loadModules();
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);
  const slot = await prisma.availabilitySlot.create({
    data: {
      startsAt,
      endsAt,
      status: AvailabilitySlotStatus.PUBLISHED,
      publishedAt: new Date(),
    },
  });

  context.createdSlotIds.push(slot.id);

  return slot;
}

async function createVoucher(
  context: SeedContext,
  data: {
    code: string;
    type: VoucherType;
    status?: VoucherStatus;
    remainingValueCzk?: number | null;
    serviceId?: string | null;
    validFrom?: Date;
  },
) {
  const { prisma } = await loadModules();
  const voucher = await prisma.voucher.create({
    data: {
      code: data.code,
      type: data.type,
      status: data.status ?? VoucherStatus.ACTIVE,
      originalValueCzk: data.type === VoucherType.VALUE ? data.remainingValueCzk ?? 1200 : null,
      remainingValueCzk: data.type === VoucherType.VALUE ? data.remainingValueCzk ?? 1200 : null,
      serviceId: data.type === VoucherType.SERVICE ? data.serviceId ?? context.serviceId : null,
      serviceNameSnapshot: data.type === VoucherType.SERVICE ? "Veřejná služba voucher" : null,
      servicePriceSnapshotCzk: data.type === VoucherType.SERVICE ? 1200 : null,
      serviceDurationSnapshot: data.type === VoucherType.SERVICE ? 60 : null,
      validFrom: data.validFrom,
      issuedAt: new Date(),
    },
  });

  context.createdVoucherIds.push(voucher.id);

  return voucher;
}

describe("public booking intended voucher", () => {
  dbTest("creates public booking without voucher", async () => {
    await withSeed(async (seed) => {
      const { prisma, createPublicBooking } = await loadModules();
      const slot = await createSlot(seed);

      const result = await createPublicBooking(buildBookingInput(seed, slot));
      seed.createdBookingIds.push(result.bookingId);

      const booking = await prisma.booking.findUniqueOrThrow({ where: { id: result.bookingId } });
      assert.equal(booking.intendedVoucherId, null);
      assert.equal(booking.intendedVoucherCodeSnapshot, null);
      assert.equal(booking.intendedVoucherValidatedAt, null);
    });
  });

  dbTest("stores public booking service snapshot and confirmation payload with service, price and duration", async () => {
    await withSeed(async (seed) => {
      const { prisma, createPublicBooking } = await loadModules();
      const slot = await createSlot(seed);

      const result = await createPublicBooking(buildBookingInput(seed, slot));
      seed.createdBookingIds.push(result.bookingId);

      const [booking, emailLog] = await Promise.all([
        prisma.booking.findUniqueOrThrow({
          where: { id: result.bookingId },
          select: {
            serviceNameSnapshot: true,
            serviceDurationMinutes: true,
            servicePriceFromCzk: true,
            scheduledStartsAt: true,
            scheduledEndsAt: true,
          },
        }),
        prisma.emailLog.findFirstOrThrow({
          where: {
            bookingId: result.bookingId,
            type: EmailLogType.BOOKING_RECEIVED,
            templateKey: "booking-confirmation-v1",
          },
          select: {
            payload: true,
          },
        }),
      ]);

      const payload = emailLog.payload as Record<string, unknown>;

      assert.equal(booking.serviceNameSnapshot, "Veřejná služba voucher");
      assert.equal(booking.serviceDurationMinutes, 60);
      assert.equal(booking.servicePriceFromCzk, 1200);
      assert.equal(payload.serviceName, "Veřejná služba voucher");
      assert.equal(payload.scheduledStartsAt, booking.scheduledStartsAt.toISOString());
      assert.equal(payload.scheduledEndsAt, booking.scheduledEndsAt.toISOString());
    });
  });

  dbTest("rejects second public booking for already occupied slot", async () => {
    await withSeed(async (seed) => {
      const { prisma, createPublicBooking, publicBookingErrorCodes } = await loadModules();
      const slot = await createSlot(seed);

      const firstBooking = await createPublicBooking(buildBookingInput(seed, slot));
      seed.createdBookingIds.push(firstBooking.bookingId);

      const secondInput = buildBookingInput(seed, slot);

      await assert.rejects(
        () => createPublicBooking(secondInput),
        (error) =>
          error instanceof Error &&
          "code" in error &&
          error.code === publicBookingErrorCodes.slotUnavailable &&
          error.message === "Vybraný termín koliduje s jinou rezervací.",
      );

      const bookings = await prisma.booking.count({
        where: {
          slotId: slot.id,
        },
      });

      assert.equal(bookings, 1);
    });
  });

  dbTest("allows exactly one of two concurrent public bookings for the same slot", async () => {
    await withSeed(async (seed) => {
      const { prisma, createPublicBooking, publicBookingErrorCodes } = await loadModules();
      const slot = await createSlot(seed);

      const results = await Promise.allSettled([
        createPublicBooking(buildBookingInput(seed, slot)),
        createPublicBooking(buildBookingInput(seed, slot)),
      ]);
      const fulfilled = results.filter(
        (
          result,
        ): result is PromiseFulfilledResult<Awaited<ReturnType<typeof createPublicBooking>>> =>
          result.status === "fulfilled",
      );
      const rejected = results.filter(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );

      assert.equal(fulfilled.length, 1);
      assert.equal(rejected.length, 1);
      seed.createdBookingIds.push(fulfilled[0].value.bookingId);
      assert.ok(
        rejected[0].reason instanceof Error
          && "code" in rejected[0].reason
          && rejected[0].reason.code === publicBookingErrorCodes.slotUnavailable,
      );
      assert.equal(await prisma.booking.count({ where: { slotId: slot.id } }), 1);
    });
  });

  dbTest("splits chained published coverage so planner keeps free edge fragments editable", async () => {
    await withSeed(async (seed) => {
      const { prisma, createPublicBooking } = await loadModules();

      const service = await prisma.service.update({
        where: { id: seed.serviceId },
        data: { durationMinutes: 90 },
        select: { id: true },
      });

      const firstStart = await findIsolatedSlotStart(seed, 240, 14);
      assert.notEqual(
        getPragueLocalDate(firstStart),
        getPragueLocalDate(new Date(firstStart.getTime() + 240 * 60 * 1000 - 1)),
      );
      seed.cleanupSlotWindows.push({
        startsAt: firstStart,
        endsAt: new Date(firstStart.getTime() + 2 * 60 * 60 * 1000),
      });
      const firstSlot = await createPublishedSlot(seed, firstStart, 60);
      await createPublishedSlot(seed, new Date(firstStart.getTime() + 60 * 60 * 1000), 60);

      const bookingStart = new Date(firstStart.getTime() + 30 * 60 * 1000);
      const result = await createPublicBooking({
        ...buildBookingInput(seed, { id: firstSlot.id, startsAt: bookingStart }),
        serviceId: service.id,
        startsAt: bookingStart.toISOString(),
      });
      seed.createdBookingIds.push(result.bookingId);

      const slots = await prisma.availabilitySlot.findMany({
        where: {
          startsAt: {
            gte: firstStart,
            lt: new Date(firstStart.getTime() + 2 * 60 * 60 * 1000),
          },
        },
        orderBy: { startsAt: "asc" },
        select: {
          id: true,
          startsAt: true,
          endsAt: true,
          status: true,
        },
      });

      assert.deepEqual(
        slots.map((slot) => ({
          startsAt: slot.startsAt.toISOString(),
          endsAt: slot.endsAt.toISOString(),
          status: slot.status,
        })),
        [
          {
            startsAt: firstStart.toISOString(),
            endsAt: bookingStart.toISOString(),
            status: AvailabilitySlotStatus.PUBLISHED,
          },
          {
            startsAt: bookingStart.toISOString(),
            endsAt: new Date(firstStart.getTime() + 60 * 60 * 1000).toISOString(),
            status: AvailabilitySlotStatus.PUBLISHED,
          },
          {
            startsAt: new Date(firstStart.getTime() + 60 * 60 * 1000).toISOString(),
            endsAt: new Date(firstStart.getTime() + 120 * 60 * 1000).toISOString(),
            status: AvailabilitySlotStatus.PUBLISHED,
            },
        ],
      );

      const booking = await prisma.booking.findUniqueOrThrow({
        where: { id: result.bookingId },
        select: { slotId: true },
      });

      assert.equal(booking.slotId, firstSlot.id);
    });
  });

  dbTest("stores valid VALUE voucher as intended voucher without redemption or balance changes", async () => {
    await withSeed(async (seed) => {
      const { prisma, createPublicBooking } = await loadModules();
      const slot = await createSlot(seed);
      const voucher = await createVoucher(seed, {
        code: `PP-2026-${randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
        type: VoucherType.VALUE,
        remainingValueCzk: 1000,
      });

      const result = await createPublicBooking(buildBookingInput(seed, slot, voucher.code));
      seed.createdBookingIds.push(result.bookingId);

      const [booking, unchangedVoucher, redemptionCount] = await Promise.all([
        prisma.booking.findUniqueOrThrow({ where: { id: result.bookingId } }),
        prisma.voucher.findUniqueOrThrow({ where: { id: voucher.id } }),
        prisma.voucherRedemption.count({ where: { voucherId: voucher.id } }),
      ]);

      assert.equal(booking.intendedVoucherId, voucher.id);
      assert.equal(booking.intendedVoucherCodeSnapshot, voucher.code);
      assert.ok(booking.intendedVoucherValidatedAt);
      assert.equal(unchangedVoucher.remainingValueCzk, 1000);
      assert.equal(unchangedVoucher.status, VoucherStatus.ACTIVE);
      assert.equal(redemptionCount, 0);
    });
  });

  dbTest("rejects voucher before validFrom during final public booking creation", async () => {
    await withSeed(async (seed) => {
      const { createPublicBooking, publicBookingErrorCodes } = await loadModules();
      const slot = await createSlot(seed);
      const voucher = await createVoucher(seed, {
        code: `PP-2026-F${randomUUID().replace(/-/g, "").slice(0, 5).toUpperCase()}`,
        type: VoucherType.VALUE,
        validFrom: new Date(Date.now() + 60 * 60 * 1000),
      });
      const input = buildBookingInput(seed, slot, voucher.code);

      await assert.rejects(
        () => createPublicBooking(input),
        (error) => error instanceof Error && "code" in error && error.code === publicBookingErrorCodes.voucherInvalid,
      );
    });
  });

  dbTest("accepts partially redeemed VALUE voucher with positive balance below service price", async () => {
    await withSeed(async (seed) => {
      const { prisma, createPublicBooking } = await loadModules();
      const slot = await createSlot(seed);
      const voucher = await createVoucher(seed, {
        code: `PP-2026-P${randomUUID().replace(/-/g, "").slice(0, 5).toUpperCase()}`,
        type: VoucherType.VALUE,
        status: VoucherStatus.PARTIALLY_REDEEMED,
        remainingValueCzk: 210,
      });

      const result = await createPublicBooking(buildBookingInput(seed, slot, voucher.code));
      seed.createdBookingIds.push(result.bookingId);

      const unchangedVoucher = await prisma.voucher.findUniqueOrThrow({ where: { id: voucher.id } });
      assert.equal(result.intendedVoucherCode, voucher.code);
      assert.equal(result.intendedVoucherType, VoucherType.VALUE);
      assert.equal(unchangedVoucher.remainingValueCzk, 210);
      assert.equal(unchangedVoucher.status, VoucherStatus.PARTIALLY_REDEEMED);
    });
  });

  dbTest("rejects VALUE voucher with no remaining balance and does not create booking", async () => {
    await withSeed(async (seed) => {
      const { prisma, createPublicBooking, publicBookingErrorCodes } = await loadModules();
      const slot = await createSlot(seed);
      const voucher = await createVoucher(seed, {
        code: `PP-2026-Z${randomUUID().replace(/-/g, "").slice(0, 5).toUpperCase()}`,
        type: VoucherType.VALUE,
        status: VoucherStatus.PARTIALLY_REDEEMED,
        remainingValueCzk: 0,
      });
      const input = buildBookingInput(seed, slot, voucher.code);

      await assert.rejects(
        () => createPublicBooking(input),
        (error) =>
          error instanceof Error &&
          "code" in error &&
          error.code === publicBookingErrorCodes.voucherInvalid &&
          error.message === "Voucher už nemá žádný dostupný zůstatek.",
      );

      assert.equal(await prisma.booking.count({ where: { clientEmailSnapshot: input.email } }), 0);
    });
  });

  dbTest("stores valid SERVICE voucher for matching service", async () => {
    await withSeed(async (seed) => {
      const { prisma, createPublicBooking } = await loadModules();
      const slot = await createSlot(seed);
      const voucher = await createVoucher(seed, {
        code: `PP-2026-S${randomUUID().replace(/-/g, "").slice(0, 5).toUpperCase()}`,
        type: VoucherType.SERVICE,
        serviceId: seed.serviceId,
      });

      const result = await createPublicBooking(buildBookingInput(seed, slot, voucher.code));
      seed.createdBookingIds.push(result.bookingId);

      const booking = await prisma.booking.findUniqueOrThrow({ where: { id: result.bookingId } });
      assert.equal(booking.intendedVoucherId, voucher.id);
      assert.equal(result.intendedVoucherType, VoucherType.SERVICE);
    });
  });

  dbTest("rejects SERVICE voucher for another service and does not create booking", async () => {
    await withSeed(async (seed) => {
      const { prisma, createPublicBooking, publicBookingErrorCodes } = await loadModules();
      const slot = await createSlot(seed);
      const voucher = await createVoucher(seed, {
        code: `PP-2026-M${randomUUID().replace(/-/g, "").slice(0, 5).toUpperCase()}`,
        type: VoucherType.SERVICE,
        serviceId: seed.otherServiceId,
      });
      const input = buildBookingInput(seed, slot, voucher.code);

      await assert.rejects(
        () => createPublicBooking(input),
        (error) =>
          error instanceof Error &&
          "code" in error &&
          error.code === publicBookingErrorCodes.voucherInvalid &&
          error.message === "Tento voucher je určený pro jinou službu.",
      );

      assert.equal(await prisma.booking.count({ where: { clientEmailSnapshot: input.email } }), 0);
    });
  });

  dbTest("admin booking detail exposes intended voucher after public booking", async () => {
    await withSeed(async (seed) => {
      const { getAdminBookingDetailData, createPublicBooking } = await loadModules();
      const slot = await createSlot(seed);
      const voucher = await createVoucher(seed, {
        code: `PP-2026-D${randomUUID().replace(/-/g, "").slice(0, 5).toUpperCase()}`,
        type: VoucherType.VALUE,
        remainingValueCzk: 500,
      });

      const result = await createPublicBooking(buildBookingInput(seed, slot, voucher.code));
      seed.createdBookingIds.push(result.bookingId);

      const detail = await getAdminBookingDetailData("owner", result.bookingId);
      assert.ok(detail);
      assert.equal(detail.status, BookingStatus.PENDING);
      assert.equal(detail.voucher.intendedVoucher?.id, voucher.id);
      assert.equal(detail.voucher.intendedVoucherCodeSnapshot, voucher.code);
      assert.ok(detail.voucher.intendedVoucherValidatedAtLabel);
    });
  });

  dbTest("stores safe voucher text in public booking confirmation email payload", async () => {
    await withSeed(async (seed) => {
      const { prisma, createPublicBooking } = await loadModules();
      const slot = await createSlot(seed);
      const voucher = await createVoucher(seed, {
        code: `PP-2026-E${randomUUID().replace(/-/g, "").slice(0, 5).toUpperCase()}`,
        type: VoucherType.VALUE,
        remainingValueCzk: 800,
      });

      const result = await createPublicBooking(buildBookingInput(seed, slot, voucher.code));
      seed.createdBookingIds.push(result.bookingId);

      const emailLog = await prisma.emailLog.findFirstOrThrow({
        where: {
          bookingId: result.bookingId,
          type: EmailLogType.BOOKING_RECEIVED,
          templateKey: "booking-confirmation-v1",
        },
        select: { payload: true },
      });
      const payload = emailLog.payload as Record<string, unknown>;

      assert.equal(payload.intendedVoucherCode, voucher.code);
      assert.equal("remainingValueCzk" in payload, false);
      assert.equal("redeemedByUser" in payload, false);
    });
  });
});
