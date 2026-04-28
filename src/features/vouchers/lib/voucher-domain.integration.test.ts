import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, afterEach, before, describe } from "node:test";

import {
  AdminRole,
  AvailabilitySlotStatus,
  BookingSource,
  BookingStatus,
  VoucherStatus,
  VoucherType,
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

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

type TestContext = {
  actorUserId: string;
  categoryId: string;
  serviceId: string;
  otherServiceId: string;
  clientId: string;
  slotIds: string[];
  bookingIds: string[];
};

let seed: TestContext | null = null;

async function loadModules() {
  const [
    { prisma },
    voucherCodeModule,
    voucherActionsModule,
    voucherValidationModule,
    voucherRedemptionModule,
    adminBookingModule,
  ] = await Promise.all([
    import("@/lib/prisma"),
    import("./voucher-code"),
    import("@/features/vouchers/actions/voucher-actions"),
    import("./voucher-validation"),
    import("./voucher-redemption"),
    import("@/features/admin/lib/admin-booking"),
  ]);

  return {
    prisma,
    normalizeVoucherCode: voucherCodeModule.normalizeVoucherCode,
    createVoucher: voucherActionsModule.createVoucher,
    validateVoucherForBookingInput: voucherValidationModule.validateVoucherForBookingInput,
    redeemVoucherForBooking: voucherRedemptionModule.redeemVoucherForBooking,
    VoucherRedemptionError: voucherRedemptionModule.VoucherRedemptionError,
    getAdminBookingDetailData: adminBookingModule.getAdminBookingDetailData,
  };
}

async function createSeed(): Promise<TestContext> {
  const { prisma } = await loadModules();
  const suffix = randomUUID().slice(0, 8);
  const startsAt = new Date("2026-06-01T09:00:00.000Z");
  const endsAt = new Date("2026-06-01T10:00:00.000Z");

  const actor = await prisma.adminUser.create({
    data: {
      email: `voucher-${suffix}@example.com`,
      name: "Voucher Tester",
      role: AdminRole.OWNER,
    },
  });
  const category = await prisma.serviceCategory.create({
    data: {
      name: `Voucher kategorie ${suffix}`,
      slug: `voucher-kategorie-${suffix}`,
    },
  });
  const [service, otherService] = await Promise.all([
    prisma.service.create({
      data: {
        categoryId: category.id,
        name: "Lash lifting",
        publicName: "Lash lifting public",
        slug: `voucher-lash-${suffix}`,
        durationMinutes: 60,
        priceFromCzk: 1200,
      },
    }),
    prisma.service.create({
      data: {
        categoryId: category.id,
        name: "Obočí",
        publicName: "Úprava obočí",
        slug: `voucher-brow-${suffix}`,
        durationMinutes: 45,
        priceFromCzk: 900,
      },
    }),
  ]);
  const client = await prisma.client.create({
    data: {
      fullName: "Jana Voucherová",
      email: `jana-voucher-${suffix}@example.com`,
      phone: "+420777111222",
    },
  });

  const slots = await Promise.all(
    [0, 1, 2, 3].map((index) =>
      prisma.availabilitySlot.create({
        data: {
          startsAt: new Date(startsAt.getTime() + index * 90 * 60 * 1000),
          endsAt: new Date(endsAt.getTime() + index * 90 * 60 * 1000),
          status: AvailabilitySlotStatus.PUBLISHED,
          publishedAt: new Date("2026-05-01T09:00:00.000Z"),
        },
      }),
    ),
  );

  const bookings = await Promise.all(
    slots.map((slot, index) =>
      prisma.booking.create({
        data: {
          clientId: client.id,
          slotId: slot.id,
          serviceId: service.id,
          source: BookingSource.WEB,
          status: BookingStatus.CONFIRMED,
          clientNameSnapshot: client.fullName,
          clientEmailSnapshot: client.email ?? "",
          clientPhoneSnapshot: client.phone,
          serviceNameSnapshot: service.publicName ?? service.name,
          serviceDurationMinutes: service.durationMinutes,
          servicePriceFromCzk: service.priceFromCzk,
          scheduledStartsAt: slot.startsAt,
          scheduledEndsAt: slot.endsAt,
          internalNote: `voucher-test-${index}`,
        },
      }),
    ),
  );

  return {
    actorUserId: actor.id,
    categoryId: category.id,
    serviceId: service.id,
    otherServiceId: otherService.id,
    clientId: client.id,
    slotIds: slots.map((slot) => slot.id),
    bookingIds: bookings.map((booking) => booking.id),
  };
}

async function cleanupSeed(context: TestContext) {
  const { prisma } = await loadModules();

  await prisma.voucherRedemption.deleteMany({
    where: {
      OR: [
        { bookingId: { in: context.bookingIds } },
        { redeemedByUserId: context.actorUserId },
      ],
    },
  });
  await prisma.voucher.deleteMany({ where: { createdByUserId: context.actorUserId } });
  await prisma.booking.deleteMany({ where: { id: { in: context.bookingIds } } });
  await prisma.availabilitySlot.deleteMany({ where: { id: { in: context.slotIds } } });
  await prisma.client.deleteMany({ where: { id: context.clientId } });
  await prisma.service.deleteMany({ where: { id: { in: [context.serviceId, context.otherServiceId] } } });
  await prisma.serviceCategory.deleteMany({ where: { id: context.categoryId } });
  await prisma.adminUser.deleteMany({ where: { id: context.actorUserId } });
}

before(async () => {
  if (process.env.RUN_DB_INTEGRATION_TESTS === "1") {
    seed = await createSeed();
  }
});

afterEach(async () => {
  if (seed) {
    const { prisma } = await loadModules();

    await prisma.voucherRedemption.deleteMany({
      where: {
        OR: [
          { bookingId: { in: seed.bookingIds } },
          { redeemedByUserId: seed.actorUserId },
        ],
      },
    });
  }
});

after(async () => {
  if (seed) {
    await cleanupSeed(seed);
  }
});

describe("voucher domain", () => {
  test("normalizes voucher codes", async () => {
    const { normalizeVoucherCode } = await loadModules();

    assert.equal(normalizeVoucherCode(" pp–2026 – a7k9x2 "), "PP-2026-A7K9X2");
  });

  dbTest("creates VALUE voucher with remaining value", async () => {
    assert.ok(seed);
    const { createVoucher } = await loadModules();

    const voucher = await createVoucher(
      {
        type: VoucherType.VALUE,
        originalValueCzk: 1500,
      },
      seed.actorUserId,
    );

    assert.equal(voucher.status, VoucherStatus.ACTIVE);
    assert.equal(voucher.originalValueCzk, 1500);
    assert.equal(voucher.remainingValueCzk, 1500);
    assert.match(voucher.code, /^PP-\d{4}-[A-Z2-9]{6}$/);
  });

  dbTest("creates voucher with purchaser, recipient and message", async () => {
    assert.ok(seed);
    const { createVoucher } = await loadModules();

    const voucher = await createVoucher(
      {
        type: VoucherType.VALUE,
        originalValueCzk: 900,
        purchaserName: "Marie Kupující",
        purchaserEmail: "marie@example.com",
        recipientName: "Jana Obdarovaná",
        message: "Krásnou péči v PP Studiu.",
      },
      seed.actorUserId,
    );

    assert.equal(voucher.purchaserName, "Marie Kupující");
    assert.equal(voucher.purchaserEmail, "marie@example.com");
    assert.equal(voucher.recipientName, "Jana Obdarovaná");
    assert.equal(voucher.message, "Krásnou péči v PP Studiu.");
  });

  dbTest("creates SERVICE voucher with service snapshot", async () => {
    assert.ok(seed);
    const { createVoucher } = await loadModules();

    const voucher = await createVoucher(
      {
        type: VoucherType.SERVICE,
        serviceId: seed.serviceId,
      },
      seed.actorUserId,
    );

    assert.equal(voucher.status, VoucherStatus.ACTIVE);
    assert.equal(voucher.serviceId, seed.serviceId);
    assert.equal(voucher.serviceNameSnapshot, "Lash lifting public");
    assert.equal(voucher.servicePriceSnapshotCzk, 1200);
    assert.equal(voucher.serviceDurationSnapshot, 60);
    assert.equal(voucher.remainingValueCzk, null);
  });

  dbTest("validates VALUE voucher for booking", async () => {
    assert.ok(seed);
    const { createVoucher, validateVoucherForBookingInput } = await loadModules();
    const voucher = await createVoucher(
      {
        type: VoucherType.VALUE,
        originalValueCzk: 800,
      },
      seed.actorUserId,
    );

    const result = await validateVoucherForBookingInput({
      code: voucher.code,
      serviceId: seed.serviceId,
    });

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.remainingValueCzk, 800);
  });

  dbTest("validates SERVICE voucher for matching service", async () => {
    assert.ok(seed);
    const { createVoucher, validateVoucherForBookingInput } = await loadModules();
    const voucher = await createVoucher(
      {
        type: VoucherType.SERVICE,
        serviceId: seed.serviceId,
      },
      seed.actorUserId,
    );

    const result = await validateVoucherForBookingInput({
      code: voucher.code,
      serviceId: seed.serviceId,
    });

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.serviceNameSnapshot, "Lash lifting public");
  });

  dbTest("rejects SERVICE voucher for different service", async () => {
    assert.ok(seed);
    const { createVoucher, validateVoucherForBookingInput } = await loadModules();
    const voucher = await createVoucher(
      {
        type: VoucherType.SERVICE,
        serviceId: seed.serviceId,
      },
      seed.actorUserId,
    );

    const result = await validateVoucherForBookingInput({
      code: voucher.code,
      serviceId: seed.otherServiceId,
    });

    assert.deepEqual(result, { ok: false, reason: "SERVICE_MISMATCH" });
  });

  dbTest("redeems VALUE voucher partially and then to zero", async () => {
    assert.ok(seed);
    const { createVoucher, redeemVoucherForBooking } = await loadModules();
    const voucher = await createVoucher(
      {
        type: VoucherType.VALUE,
        originalValueCzk: 1000,
      },
      seed.actorUserId,
    );

    const partial = await redeemVoucherForBooking({
      voucherCode: voucher.code,
      bookingId: seed.bookingIds[0],
      amountCzk: 400,
      redeemedByUserId: seed.actorUserId,
    });

    assert.equal(partial.voucher.remainingValueCzk, 600);
    assert.equal(partial.voucher.status, VoucherStatus.PARTIALLY_REDEEMED);
    assert.equal(partial.redemption.amountCzk, 400);

    const final = await redeemVoucherForBooking({
      voucherCode: voucher.code,
      bookingId: seed.bookingIds[1],
      amountCzk: 600,
      redeemedByUserId: seed.actorUserId,
    });

    assert.equal(final.voucher.remainingValueCzk, 0);
    assert.equal(final.voucher.status, VoucherStatus.REDEEMED);
  });

  dbTest("redeems VALUE voucher with a single full amount", async () => {
    assert.ok(seed);
    const { createVoucher, redeemVoucherForBooking } = await loadModules();
    const voucher = await createVoucher(
      {
        type: VoucherType.VALUE,
        originalValueCzk: 1200,
      },
      seed.actorUserId,
    );

    const result = await redeemVoucherForBooking({
      voucherCode: voucher.code,
      bookingId: seed.bookingIds[0],
      amountCzk: 1200,
      redeemedByUserId: seed.actorUserId,
    });

    assert.equal(result.voucher.remainingValueCzk, 0);
    assert.equal(result.voucher.status, VoucherStatus.REDEEMED);
    assert.equal(result.redemption.amountCzk, 1200);
  });

  dbTest("redeems remaining VALUE balance when requested amount is higher", async () => {
    assert.ok(seed);
    const { createVoucher, redeemVoucherForBooking } = await loadModules();
    const voucher = await createVoucher(
      {
        type: VoucherType.VALUE,
        originalValueCzk: 500,
      },
      seed.actorUserId,
    );

    const result = await redeemVoucherForBooking({
      voucherCode: voucher.code,
      bookingId: seed.bookingIds[0],
      amountCzk: 1200,
      redeemedByUserId: seed.actorUserId,
    });

    assert.equal(result.voucher.remainingValueCzk, 0);
    assert.equal(result.voucher.status, VoucherStatus.REDEEMED);
    assert.equal(result.redemption.amountCzk, 500);
  });

  dbTest("blocks another voucher redemption on an already paid booking", async () => {
    assert.ok(seed);
    const { createVoucher, redeemVoucherForBooking, VoucherRedemptionError } = await loadModules();
    const firstVoucher = await createVoucher(
      {
        type: VoucherType.VALUE,
        originalValueCzk: 500,
      },
      seed.actorUserId,
    );
    const secondVoucher = await createVoucher(
      {
        type: VoucherType.VALUE,
        originalValueCzk: 500,
      },
      seed.actorUserId,
    );

    await redeemVoucherForBooking({
      voucherCode: firstVoucher.code,
      bookingId: seed.bookingIds[0],
      amountCzk: 500,
      redeemedByUserId: seed.actorUserId,
    });

    await assert.rejects(
      () =>
        redeemVoucherForBooking({
          voucherCode: secondVoucher.code,
          bookingId: seed.bookingIds[0],
          amountCzk: 500,
          redeemedByUserId: seed.actorUserId,
        }),
      (error) => error instanceof VoucherRedemptionError && error.code === "BOOKING_ALREADY_REDEEMED",
    );
  });

  dbTest("redeems SERVICE voucher and blocks second redemption", async () => {
    assert.ok(seed);
    const { createVoucher, redeemVoucherForBooking, VoucherRedemptionError } = await loadModules();
    const voucher = await createVoucher(
      {
        type: VoucherType.SERVICE,
        serviceId: seed.serviceId,
      },
      seed.actorUserId,
    );

    const result = await redeemVoucherForBooking({
      voucherCode: voucher.code,
      bookingId: seed.bookingIds[2],
      redeemedByUserId: seed.actorUserId,
    });

    assert.equal(result.voucher.status, VoucherStatus.REDEEMED);
    assert.equal(result.redemption.amountCzk, 1200);
    assert.equal(result.redemption.serviceNameSnapshot, "Lash lifting public");

    await assert.rejects(
      () =>
        redeemVoucherForBooking({
          voucherCode: voucher.code,
          bookingId: seed.bookingIds[3],
          redeemedByUserId: seed.actorUserId,
        }),
      (error) => error instanceof VoucherRedemptionError && error.code === "VOUCHER_NOT_REDEEMABLE",
    );
  });

  dbTest("rejects SERVICE voucher redemption for different service", async () => {
    assert.ok(seed);
    const { prisma, createVoucher, redeemVoucherForBooking, VoucherRedemptionError } = await loadModules();
    const otherSlot = await prisma.availabilitySlot.create({
      data: {
        startsAt: new Date("2026-06-02T09:00:00.000Z"),
        endsAt: new Date("2026-06-02T09:45:00.000Z"),
        status: AvailabilitySlotStatus.PUBLISHED,
        publishedAt: new Date("2026-05-01T09:00:00.000Z"),
      },
    });
    const otherBooking = await prisma.booking.create({
      data: {
        clientId: seed.clientId,
        slotId: otherSlot.id,
        serviceId: seed.otherServiceId,
        source: BookingSource.WEB,
        status: BookingStatus.CONFIRMED,
        clientNameSnapshot: "Jana Voucherová",
        clientEmailSnapshot: "jana-voucher@example.com",
        clientPhoneSnapshot: "+420777111222",
        serviceNameSnapshot: "Úprava obočí",
        serviceDurationMinutes: 45,
        servicePriceFromCzk: 900,
        scheduledStartsAt: otherSlot.startsAt,
        scheduledEndsAt: otherSlot.endsAt,
      },
    });
    const voucher = await createVoucher(
      {
        type: VoucherType.SERVICE,
        serviceId: seed.serviceId,
      },
      seed.actorUserId,
    );

    try {
      await assert.rejects(
        () =>
          redeemVoucherForBooking({
            voucherCode: voucher.code,
            bookingId: otherBooking.id,
            redeemedByUserId: seed.actorUserId,
          }),
        (error) => error instanceof VoucherRedemptionError && error.code === "SERVICE_MISMATCH",
      );
    } finally {
      await prisma.voucherRedemption.deleteMany({ where: { bookingId: otherBooking.id } });
      await prisma.booking.delete({ where: { id: otherBooking.id } });
      await prisma.availabilitySlot.delete({ where: { id: otherSlot.id } });
    }
  });

  dbTest("blocks already redeemed VALUE voucher from a second use", async () => {
    assert.ok(seed);
    const { createVoucher, redeemVoucherForBooking, VoucherRedemptionError } = await loadModules();
    const voucher = await createVoucher(
      {
        type: VoucherType.VALUE,
        originalValueCzk: 500,
      },
      seed.actorUserId,
    );

    await redeemVoucherForBooking({
      voucherCode: voucher.code,
      bookingId: seed.bookingIds[0],
      amountCzk: 500,
      redeemedByUserId: seed.actorUserId,
    });

    await assert.rejects(
      () =>
        redeemVoucherForBooking({
          voucherCode: voucher.code,
          bookingId: seed.bookingIds[1],
          amountCzk: 1,
          redeemedByUserId: seed.actorUserId,
        }),
      (error) => error instanceof VoucherRedemptionError && error.code === "VOUCHER_NOT_REDEEMABLE",
    );
  });

  dbTest("keeps admin booking detail usable without voucher", async () => {
    assert.ok(seed);
    const { getAdminBookingDetailData } = await loadModules();

    const detail = await getAdminBookingDetailData("owner", seed.bookingIds[0]);

    assert.ok(detail);
    assert.equal(detail.voucher.intendedVoucher, null);
    assert.equal(detail.voucher.intendedVoucherCodeSnapshot, null);
    assert.ok(Array.isArray(detail.voucher.redemptions));
    assert.equal(detail.voucher.paymentSummary.totalPriceCzk, 1200);
    assert.equal(detail.voucher.paymentSummary.voucherPaidCzk, 0);
    assert.equal(detail.voucher.paymentSummary.paidAmountCzk, 0);
    assert.equal(detail.voucher.paymentSummary.remainingAmountCzk, 1200);
    assert.equal(detail.voucher.paymentSummary.paymentStatus, "UNPAID");
  });

  dbTest("shows partially paid admin booking detail after VALUE voucher redemption", async () => {
    assert.ok(seed);
    const { createVoucher, redeemVoucherForBooking, getAdminBookingDetailData } = await loadModules();
    const voucher = await createVoucher(
      {
        type: VoucherType.VALUE,
        originalValueCzk: 500,
      },
      seed.actorUserId,
    );

    await redeemVoucherForBooking({
      voucherCode: voucher.code,
      bookingId: seed.bookingIds[0],
      amountCzk: 500,
      redeemedByUserId: seed.actorUserId,
    });

    const detail = await getAdminBookingDetailData("owner", seed.bookingIds[0]);

    assert.ok(detail);
    assert.equal(detail.voucher.paymentSummary.totalPriceCzk, 1200);
    assert.equal(detail.voucher.paymentSummary.voucherPaidCzk, 500);
    assert.equal(detail.voucher.paymentSummary.paidAmountCzk, 500);
    assert.equal(detail.voucher.paymentSummary.remainingAmountCzk, 700);
    assert.equal(detail.voucher.paymentSummary.paymentStatus, "PARTIALLY_PAID");
  });

  dbTest("shows paid admin booking detail after full VALUE voucher redemption", async () => {
    assert.ok(seed);
    const { createVoucher, redeemVoucherForBooking, getAdminBookingDetailData } = await loadModules();
    const voucher = await createVoucher(
      {
        type: VoucherType.VALUE,
        originalValueCzk: 1200,
      },
      seed.actorUserId,
    );

    await redeemVoucherForBooking({
      voucherCode: voucher.code,
      bookingId: seed.bookingIds[1],
      amountCzk: 1200,
      redeemedByUserId: seed.actorUserId,
    });

    const detail = await getAdminBookingDetailData("owner", seed.bookingIds[1]);

    assert.ok(detail);
    assert.equal(detail.voucher.paymentSummary.totalPriceCzk, 1200);
    assert.equal(detail.voucher.paymentSummary.voucherPaidCzk, 1200);
    assert.equal(detail.voucher.paymentSummary.paidAmountCzk, 1200);
    assert.equal(detail.voucher.paymentSummary.remainingAmountCzk, 0);
    assert.equal(detail.voucher.paymentSummary.paymentStatus, "PAID");
  });

  dbTest("shows paid admin booking detail after SERVICE voucher redemption matching service price", async () => {
    assert.ok(seed);
    const { createVoucher, redeemVoucherForBooking, getAdminBookingDetailData } = await loadModules();
    const voucher = await createVoucher(
      {
        type: VoucherType.SERVICE,
        serviceId: seed.serviceId,
      },
      seed.actorUserId,
    );

    await redeemVoucherForBooking({
      voucherCode: voucher.code,
      bookingId: seed.bookingIds[2],
      redeemedByUserId: seed.actorUserId,
    });

    const detail = await getAdminBookingDetailData("owner", seed.bookingIds[2]);

    assert.ok(detail);
    assert.equal(detail.voucher.paymentSummary.totalPriceCzk, 1200);
    assert.equal(detail.voucher.paymentSummary.voucherPaidCzk, 1200);
    assert.equal(detail.voucher.paymentSummary.paidAmountCzk, 1200);
    assert.equal(detail.voucher.paymentSummary.remainingAmountCzk, 0);
    assert.equal(detail.voucher.paymentSummary.paymentStatus, "PAID");
  });
});
