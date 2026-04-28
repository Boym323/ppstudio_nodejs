import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before, describe } from "node:test";

import {
  AvailabilitySlotStatus,
  BookingAcquisitionSource,
  BookingStatus,
  EmailLogType,
  VoucherStatus,
  VoucherType,
} from "@prisma/client";

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
  createdVoucherIds: string[];
};

let seed: SeedContext | null = null;

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

async function createSlot(context: SeedContext, offsetDays = context.createdSlotIds.length + 3) {
  const { prisma } = await loadModules();
  const startsAt = addDays(new Date(), offsetDays);
  startsAt.setUTCHours(9 + (context.createdSlotIds.length % 6), 0, 0, 0);
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

async function createVoucher(
  context: SeedContext,
  data: {
    code: string;
    type: VoucherType;
    status?: VoucherStatus;
    remainingValueCzk?: number | null;
    serviceId?: string | null;
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
      issuedAt: new Date(),
    },
  });

  context.createdVoucherIds.push(voucher.id);

  return voucher;
}

before(async () => {
  if (process.env.RUN_DB_INTEGRATION_TESTS === "1") {
    seed = await createSeed();
  }
});

after(async () => {
  if (seed) {
    await cleanupSeed(seed);
  }
});

describe("public booking intended voucher", () => {
  dbTest("creates public booking without voucher", async () => {
    assert.ok(seed);
    const { prisma, createPublicBooking } = await loadModules();
    const slot = await createSlot(seed);

    const result = await createPublicBooking(buildBookingInput(seed, slot));
    seed.createdBookingIds.push(result.bookingId);

    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: result.bookingId } });
    assert.equal(booking.intendedVoucherId, null);
    assert.equal(booking.intendedVoucherCodeSnapshot, null);
    assert.equal(booking.intendedVoucherValidatedAt, null);
  });

  dbTest("stores valid VALUE voucher as intended voucher without redemption or balance changes", async () => {
    assert.ok(seed);
    const { prisma, createPublicBooking } = await loadModules();
    const slot = await createSlot(seed);
    const voucher = await createVoucher(seed, {
      code: `PP-2026-${seed.suffix.toUpperCase().slice(0, 6)}`,
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

  dbTest("accepts partially redeemed VALUE voucher with positive balance below service price", async () => {
    assert.ok(seed);
    const { prisma, createPublicBooking } = await loadModules();
    const slot = await createSlot(seed);
    const voucher = await createVoucher(seed, {
      code: `PP-2026-P${seed.suffix.toUpperCase().slice(0, 5)}`,
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

  dbTest("rejects VALUE voucher with no remaining balance and does not create booking", async () => {
    assert.ok(seed);
    const { prisma, createPublicBooking, publicBookingErrorCodes } = await loadModules();
    const slot = await createSlot(seed);
    const voucher = await createVoucher(seed, {
      code: `PP-2026-Z${seed.suffix.toUpperCase().slice(0, 5)}`,
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

  dbTest("stores valid SERVICE voucher for matching service", async () => {
    assert.ok(seed);
    const { prisma, createPublicBooking } = await loadModules();
    const slot = await createSlot(seed);
    const voucher = await createVoucher(seed, {
      code: `PP-2026-S${seed.suffix.toUpperCase().slice(0, 5)}`,
      type: VoucherType.SERVICE,
      serviceId: seed.serviceId,
    });

    const result = await createPublicBooking(buildBookingInput(seed, slot, voucher.code));
    seed.createdBookingIds.push(result.bookingId);

    const booking = await prisma.booking.findUniqueOrThrow({ where: { id: result.bookingId } });
    assert.equal(booking.intendedVoucherId, voucher.id);
    assert.equal(result.intendedVoucherType, VoucherType.SERVICE);
  });

  dbTest("rejects SERVICE voucher for another service and does not create booking", async () => {
    assert.ok(seed);
    const { prisma, createPublicBooking, publicBookingErrorCodes } = await loadModules();
    const slot = await createSlot(seed);
    const voucher = await createVoucher(seed, {
      code: `PP-2026-M${seed.suffix.toUpperCase().slice(0, 5)}`,
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

  dbTest("admin booking detail exposes intended voucher after public booking", async () => {
    assert.ok(seed);
    const { getAdminBookingDetailData, createPublicBooking } = await loadModules();
    const slot = await createSlot(seed);
    const voucher = await createVoucher(seed, {
      code: `PP-2026-D${seed.suffix.toUpperCase().slice(0, 5)}`,
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

  dbTest("stores safe voucher text in public booking confirmation email payload", async () => {
    assert.ok(seed);
    const { prisma, createPublicBooking } = await loadModules();
    const slot = await createSlot(seed);
    const voucher = await createVoucher(seed, {
      code: `PP-2026-E${seed.suffix.toUpperCase().slice(0, 5)}`,
      type: VoucherType.VALUE,
      remainingValueCzk: 800,
    });

    const result = await createPublicBooking(buildBookingInput(seed, slot, voucher.code));
    seed.createdBookingIds.push(result.bookingId);

    const emailLog = await prisma.emailLog.findFirstOrThrow({
      where: {
        bookingId: result.bookingId,
        type: EmailLogType.BOOKING_CONFIRMED,
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
