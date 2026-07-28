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

dbTest("payment audit records manual creation and deletion metadata", async () => {
  const [{ prisma }, actions, prismaClient] = await Promise.all([
    import("@/lib/prisma"),
    import("./booking-payment-actions"),
    import("@prisma/client"),
  ]);
  const suffix = randomUUID().slice(0, 8);
  const deletedAt = new Date("2026-05-10T10:00:00.000Z");

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
    const creation = await actions.createBookingPaymentWithAudit({
      bookingId: booking.id,
      amountCzk: 700,
      method: prismaClient.BookingPaymentMethod.CASH,
      paidAt,
      note: "Doplatek po službě",
      createdByUserId: actor.id,
    });

    assert.equal(creation.status, "created");

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
      paymentId: creation.paymentId,
      amount: 700,
      method: "CASH",
      paidAt: paidAt.toISOString(),
      createdByUserId: actor.id,
    });

    const result = await actions.deleteBookingPaymentWithAudit({
      bookingId: booking.id,
      paymentId: creation.paymentId,
      deletedByUserId: actor.id,
      deletedAt,
    });

    assert.equal(result.status, "deleted");
    assert.equal(await prisma.bookingPayment.count({ where: { id: creation.paymentId } }), 0);

    const history = await prisma.bookingStatusHistory.findFirst({
      where: {
        bookingId: booking.id,
        reason: "Platba odstraněna",
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
      source: "admin-booking-payment-delete-v1",
      bookingId: booking.id,
      paymentId: creation.paymentId,
      amount: 700,
      method: "CASH",
      deletedByUserId: actor.id,
      deletedAt: deletedAt.toISOString(),
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
