import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { BookingActorType, BookingActionTokenType, BookingStatus, EmailLogType } from "@prisma/client";

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

dbTest("applyAdminBookingStatusChange confirms pending booking and writes side effects", async () => {
  const [{ prisma }, { applyAdminBookingStatusChange }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-booking"),
  ]);

  const suffix = randomUUID().slice(0, 8);
  const startsAt = new Date("2027-03-10T09:00:00.000Z");
  const endsAt = new Date("2027-03-10T10:00:00.000Z");

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

dbTest("updateAdminBookingService rewrites booking snapshot and audit history", async () => {
  const [{ prisma }, { updateAdminBookingService }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-booking"),
  ]);

  const suffix = randomUUID().slice(0, 8);
  const startsAt = new Date("2027-03-11T09:00:00.000Z");
  const endsAt = new Date("2027-03-11T10:00:00.000Z");

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
    assert.equal(updatedBooking.scheduledEndsAt.toISOString(), "2027-03-11T09:45:00.000Z");
    assert.equal(updatedBooking.blockedUntil?.toISOString(), "2027-03-11T10:00:00.000Z");

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
