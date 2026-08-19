import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

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

async function findIsolatedPaymentWindow(
  prisma: Awaited<typeof import("@/lib/prisma")>["prisma"],
  seed: string,
  durationMinutes: number,
) {
  const daySeed = Number.parseInt(seed.slice(0, 4), 16);
  const hourSeed = Number.parseInt(seed.slice(4, 6), 16);

  for (let dayStep = 0; dayStep < 45; dayStep += 1) {
    const dayOffset = 14 + ((daySeed + dayStep) % 45);
    const startsAt = new Date();
    startsAt.setUTCSeconds(0, 0);
    startsAt.setUTCDate(startsAt.getUTCDate() + dayOffset);
    startsAt.setUTCHours(9 + (hourSeed % 6), 0, 0, 0);
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

  throw new Error("Nepodařilo se najít izolované okno pro payment integrační test.");
}

dbTest("direct payment domain handles manual and completion flows idempotently", async () => {
  const [{ prisma }, paymentMutations, paymentDomain, prismaClient] = await Promise.all([
    import("@/lib/prisma"),
    import("../lib/booking-payment-mutations"),
    import("../lib/booking-payment"),
    import("@/generated/prisma/browser"),
  ]);
  const suffix = randomUUID().slice(0, 8);
  const voidedAt = new Date("2026-05-10T10:00:00.000Z");

  const actor = await prisma.adminUser.create({
    data: {
      email: `payment-audit-${suffix}@example.com`,
      name: `Payment Audit ${suffix}`,
      role: prismaClient.AdminRole.OWNER,
      isActive: true,
    },
    select: { id: true },
  });
  const category = await prisma.serviceCategory.create({
    data: {
      name: `Payment category ${suffix}`,
      slug: `payment-category-${suffix}`,
      isActive: true,
    },
    select: { id: true },
  });
  const service = await prisma.service.create({
    data: {
      categoryId: category.id,
      name: `Payment service ${suffix}`,
      slug: `payment-service-${suffix}`,
      durationMinutes: 60,
      priceFromCzk: 1200,
      isActive: true,
      isPubliclyBookable: true,
    },
    select: { id: true },
  });
  const client = await prisma.client.create({
    data: {
      fullName: `Payment Client ${suffix}`,
      email: `payment-client-${suffix}@example.com`,
    },
    select: { id: true, email: true },
  });
  assert.ok(client.email);
  const { startsAt, endsAt } = await findIsolatedPaymentWindow(prisma, suffix, 60);
  const slot = await prisma.availabilitySlot.create({
    data: {
      startsAt,
      endsAt,
      status: prismaClient.AvailabilitySlotStatus.PUBLISHED,
      capacity: 1,
    },
    select: { id: true },
  });
  const booking = await prisma.booking.create({
    data: {
      clientId: client.id,
      serviceId: service.id,
      slotId: slot.id,
      source: prismaClient.BookingSource.WEB,
      status: prismaClient.BookingStatus.CONFIRMED,
      clientNameSnapshot: "Payment Client",
      clientEmailSnapshot: client.email,
      serviceNameSnapshot: "Payment service",
      serviceDurationMinutes: 60,
      scheduledStartsAt: startsAt,
      scheduledEndsAt: endsAt,
    },
    select: { id: true },
  });
  try {
    const paidAt = new Date("2026-05-10T09:45:00.000Z");
    const manualIdempotencyKey = randomUUID();
    const creation = await prisma.$transaction((tx) => paymentDomain.createDirectBookingPayment(tx, {
      bookingId: booking.id,
      amountCzk: 700,
      method: prismaClient.BookingPaymentMethod.CASH,
      paidAt,
      note: "  Doplatek po službě  ",
      idempotencyKey: manualIdempotencyKey,
      actor: { area: "owner", email: `payment-audit-${suffix}@example.com`, role: prismaClient.AdminRole.OWNER },
      audit: { reason: "Platba zapsána", source: "admin-booking-payment-create-v1" },
    }));

    assert.equal(creation.status, "created");
    assert.ok("payment" in creation);

    const repeatedCreation = await prisma.$transaction((tx) => paymentDomain.createDirectBookingPayment(tx, {
      bookingId: booking.id,
      amountCzk: 700,
      method: prismaClient.BookingPaymentMethod.CASH,
      paidAt,
      note: "Doplatek po službě",
      idempotencyKey: manualIdempotencyKey,
      actor: { area: "owner", email: `payment-audit-${suffix}@example.com`, role: prismaClient.AdminRole.OWNER },
      audit: { reason: "Platba zapsána", source: "admin-booking-payment-create-v1" },
    }));
    assert.equal(repeatedCreation.status, "existing");
    assert.ok("payment" in repeatedCreation);
    assert.equal(repeatedCreation.payment.id, creation.payment.id);

    const similarPayment = await paymentDomain.findSimilarActiveBookingPayment(prisma, {
      bookingId: booking.id, amountCzk: 700, method: prismaClient.BookingPaymentMethod.CASH, paidAt,
    });
    assert.equal(similarPayment?.id, creation.payment.id);

    const completionCreation = await prisma.$transaction((tx) => paymentDomain.createDirectBookingPayment(tx, {
      bookingId: booking.id,
      amountCzk: 700,
      method: prismaClient.BookingPaymentMethod.CASH,
      paidAt,
      note: "Doplatek po službě",
      idempotencyKey: randomUUID(),
      actor: { area: "owner", email: `payment-audit-${suffix}@example.com`, role: prismaClient.AdminRole.OWNER },
      audit: { reason: "Platba zapsána při dokončení návštěvy", source: "admin-booking-complete-flow-v1" },
    }));
    assert.equal(completionCreation.status, "created");
    assert.equal(await prisma.bookingPayment.count({ where: { bookingId: booking.id } }), 2);

    const invalidCreation = await prisma.$transaction((tx) => paymentDomain.createDirectBookingPayment(tx, {
      bookingId: booking.id,
      amountCzk: 0,
      method: prismaClient.BookingPaymentMethod.CASH,
      paidAt,
      note: null,
      idempotencyKey: randomUUID(),
      actor: { area: "owner", email: `payment-audit-${suffix}@example.com`, role: prismaClient.AdminRole.OWNER },
      audit: { reason: "Platba zapsána", source: "admin-booking-payment-create-v1" },
    }));
    assert.equal(invalidCreation.status, "invalid");

    const createdHistory = await prisma.bookingStatusHistory.findFirst({
      where: {
        bookingId: booking.id,
        reason: "Platba zapsána",
      },
      orderBy: { createdAt: "desc" },
      select: {
        actorUserId: true,
        metadata: true,
      },
    });

    assert.ok(createdHistory);
    assert.equal(createdHistory.actorUserId, actor.id);
    assert.deepEqual(createdHistory.metadata, {
      source: "admin-booking-payment-create-v1",
      bookingId: booking.id,
      paymentId: creation.payment.id,
      amount: 700,
      method: "CASH",
      paidAt: paidAt.toISOString(),
      createdByUserId: actor.id,
      idempotencyKey: manualIdempotencyKey,
    });

    const originalPayment = await prisma.bookingPayment.findUniqueOrThrow({ where: { id: creation.payment.id } });
    const editResult = await prisma.$transaction((tx) => paymentDomain.updateDirectBookingPayment(tx, {
      bookingId: booking.id, paymentId: creation.payment.id, expectedUpdatedAt: originalPayment.updatedAt.toISOString(),
      amountCzk: 900, method: prismaClient.BookingPaymentMethod.BANK_TRANSFER,
      paidAt: new Date("2026-05-10T10:15:00.000Z"), note: " Upravený doplatek ",
      actor: { area: "owner", email: `payment-audit-${suffix}@example.com`, role: prismaClient.AdminRole.OWNER },
    }));
    assert.equal(editResult.status, "updated");
    const editedPayment = await prisma.bookingPayment.findUniqueOrThrow({ where: { id: creation.payment.id } });
    assert.equal(editedPayment.amountCzk, 900);
    assert.equal(editedPayment.method, prismaClient.BookingPaymentMethod.BANK_TRANSFER);
    assert.equal(editedPayment.paidAt.toISOString(), "2026-05-10T10:15:00.000Z");
    assert.equal(editedPayment.note, "Upravený doplatek");

    const editAudit = await prisma.bookingStatusHistory.findFirst({ where: { bookingId: booking.id, reason: "Platba upravena" }, orderBy: { createdAt: "desc" } });
    assert.ok(editAudit);
    assert.deepEqual(editAudit.metadata, {
      source: "admin-booking-payment-update-v1", bookingId: booking.id, paymentId: creation.payment.id,
      before: { amountCzk: 700, method: "CASH", paidAt: paidAt.toISOString(), note: "Doplatek po službě" },
      after: { amountCzk: 900, method: "BANK_TRANSFER", paidAt: "2026-05-10T10:15:00.000Z", note: "Upravený doplatek" },
      changedByUserId: actor.id,
      changedAt: (editAudit.metadata as { changedAt: string }).changedAt,
    });

    const staleEdit = await prisma.$transaction((tx) => paymentDomain.updateDirectBookingPayment(tx, {
      bookingId: booking.id, paymentId: creation.payment.id, expectedUpdatedAt: originalPayment.updatedAt.toISOString(),
      amountCzk: 901, method: prismaClient.BookingPaymentMethod.CASH, paidAt, note: null,
      actor: { area: "owner", email: `payment-audit-${suffix}@example.com`, role: prismaClient.AdminRole.OWNER },
    }));
    assert.equal(staleEdit.status, "conflict");

    const result = await paymentMutations.voidBookingPaymentWithAudit({
      bookingId: booking.id,
      paymentId: creation.payment.id,
      voidedByUserId: actor.id,
      voidedAt,
      voidReason: "Chybně zapsaná hotovost.",
    });

    assert.equal(result.status, "voided");
    const voidedPayment = await prisma.bookingPayment.findUniqueOrThrow({ where: { id: creation.payment.id } });
    assert.equal(voidedPayment.status, prismaClient.BookingPaymentStatus.VOIDED);
    assert.equal(voidedPayment.voidedByUserId, actor.id);
    assert.equal(voidedPayment.voidedAt?.toISOString(), voidedAt.toISOString());
    assert.equal(voidedPayment.voidReason, "Chybně zapsaná hotovost.");
    assert.equal(await prisma.bookingPayment.count({ where: { id: creation.payment.id } }), 1);

    const voidedEdit = await prisma.$transaction((tx) => paymentDomain.updateDirectBookingPayment(tx, {
      bookingId: booking.id, paymentId: creation.payment.id, expectedUpdatedAt: editedPayment.updatedAt.toISOString(),
      amountCzk: 901, method: prismaClient.BookingPaymentMethod.CASH, paidAt, note: null,
      actor: { area: "owner", email: `payment-audit-${suffix}@example.com`, role: prismaClient.AdminRole.OWNER },
    }));
    assert.equal(voidedEdit.status, "voided");

    const repeatedVoid = await paymentMutations.voidBookingPaymentWithAudit({
      bookingId: booking.id,
      paymentId: creation.payment.id,
      voidedByUserId: actor.id,
      voidReason: "Druhý pokus.",
    });
    assert.equal(repeatedVoid.status, "already-voided");

    const history = await prisma.bookingStatusHistory.findFirst({
      where: {
        bookingId: booking.id,
        reason: "Platba stornována",
      },
      orderBy: { createdAt: "desc" },
      select: {
        actorUserId: true,
        metadata: true,
      },
    });

    assert.ok(history);
    assert.equal(history.actorUserId, actor.id);
    assert.deepEqual(history.metadata, {
      source: "admin-booking-payment-void-v1",
      bookingId: booking.id,
      paymentId: creation.payment.id,
      originalAmountCzk: 900,
      originalMethod: "BANK_TRANSFER",
      originalPaidAt: "2026-05-10T10:15:00.000Z",
      originalNote: "Upravený doplatek",
      originalCreatedByUserId: actor.id,
      voidedByUserId: actor.id,
      voidedAt: voidedAt.toISOString(),
      voidReason: "Chybně zapsaná hotovost.",
    });
  } finally {
    await prisma.bookingStatusHistory.deleteMany({ where: { bookingId: booking.id } });
    await prisma.bookingPayment.deleteMany({ where: { bookingId: booking.id } });
    await prisma.booking.deleteMany({ where: { id: booking.id } });
    await prisma.availabilitySlot.deleteMany({ where: { id: slot.id } });
    await prisma.client.deleteMany({ where: { id: client.id } });
    await prisma.service.deleteMany({ where: { id: service.id } });
    await prisma.serviceCategory.deleteMany({ where: { id: category.id } });
    await prisma.adminUser.deleteMany({ where: { id: actor.id } });
  }
});
