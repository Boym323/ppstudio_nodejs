import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Module from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

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
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const serverOnlyStubPath = path.join(currentDir, "__test-support__", "server-only-stub.js");
const moduleInternals = Module as typeof Module & {
  _resolveFilename: (
    request: string,
    parent: unknown,
    isMain: boolean,
    options: unknown,
  ) => string;
};
const originalResolveFilename = moduleInternals._resolveFilename.bind(Module);

moduleInternals._resolveFilename = (request, parent, isMain, options) => {
  if (request === "server-only") {
    return serverOnlyStubPath;
  }

  return originalResolveFilename(request, parent, isMain, options);
};

type Seed = {
  actorUserId: string;
  bookingId: string;
  clientId: string;
  slotId: string;
  serviceId: string;
  categoryId: string;
  approveRawToken?: string;
};

async function loadModules() {
  const [{ prisma }, adminBookingModule, bookingEmailActionsModule, actionTokenModule, prismaClientModule] =
    await Promise.all([
      import("@/lib/prisma"),
      import("@/features/admin/lib/admin-booking"),
      import("./booking-email-actions"),
      import("./booking-action-tokens"),
      import("@prisma/client"),
    ]);

  return {
    prisma,
    applyAdminBookingStatusChange: adminBookingModule.applyAdminBookingStatusChange,
    performBookingEmailAction: bookingEmailActionsModule.performBookingEmailAction,
    buildBookingActionExpiry: actionTokenModule.buildBookingActionExpiry,
    buildBookingActionToken: actionTokenModule.buildBookingActionToken,
    AdminRole: prismaClientModule.AdminRole,
    AvailabilitySlotStatus: prismaClientModule.AvailabilitySlotStatus,
    BookingActionTokenType: prismaClientModule.BookingActionTokenType,
    BookingSource: prismaClientModule.BookingSource,
    BookingStatus: prismaClientModule.BookingStatus,
  };
}

async function createSeed(options?: { withApproveToken?: boolean }): Promise<Seed> {
  const {
    prisma,
    buildBookingActionExpiry,
    buildBookingActionToken,
    AdminRole,
    AvailabilitySlotStatus,
    BookingActionTokenType,
    BookingSource,
    BookingStatus,
  } = await loadModules();

  const suffix = randomUUID().slice(0, 8);
  const startsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  startsAt.setUTCSeconds(0, 0);
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);

  const actor = await prisma.adminUser.create({
    data: {
      email: `owner-${suffix}@example.com`,
      name: `Owner ${suffix}`,
      role: AdminRole.OWNER,
    },
    select: { id: true },
  });

  const category = await prisma.serviceCategory.create({
    data: {
      name: `Kategorie ${suffix}`,
      slug: `kategorie-${suffix}`,
    },
    select: { id: true },
  });

  const service = await prisma.service.create({
    data: {
      categoryId: category.id,
      name: `Služba ${suffix}`,
      slug: `sluzba-${suffix}`,
      durationMinutes: 60,
      isActive: true,
      isPubliclyBookable: true,
    },
    select: { id: true },
  });

  const slot = await prisma.availabilitySlot.create({
    data: {
      startsAt,
      endsAt,
      status: AvailabilitySlotStatus.PUBLISHED,
      publishedAt: new Date(),
      capacity: 1,
      createdByUserId: actor.id,
    },
    select: { id: true },
  });

  const client = await prisma.client.create({
    data: {
      fullName: `Klientka ${suffix}`,
      email: `client-${suffix}@example.com`,
      phone: "+420123456789",
    },
    select: { id: true },
  });

  const booking = await prisma.booking.create({
    data: {
      clientId: client.id,
      slotId: slot.id,
      serviceId: service.id,
      source: BookingSource.WEB,
      status: BookingStatus.PENDING,
      clientNameSnapshot: `Klientka ${suffix}`,
      clientEmailSnapshot: `client-${suffix}@example.com`,
      clientPhoneSnapshot: "+420123456789",
      serviceNameSnapshot: `Služba ${suffix}`,
      serviceDurationMinutes: 60,
      scheduledStartsAt: startsAt,
      scheduledEndsAt: endsAt,
    },
    select: { id: true },
  });

  let approveRawToken: string | undefined;

  if (options?.withApproveToken) {
    const approveToken = buildBookingActionToken();
    approveRawToken = approveToken.rawToken;

    await prisma.bookingActionToken.create({
      data: {
        bookingId: booking.id,
        type: BookingActionTokenType.APPROVE,
        tokenHash: approveToken.tokenHash,
        expiresAt: buildBookingActionExpiry(new Date(), 7),
      },
    });
  }

  return {
    actorUserId: actor.id,
    bookingId: booking.id,
    clientId: client.id,
    slotId: slot.id,
    serviceId: service.id,
    categoryId: category.id,
    approveRawToken,
  };
}

async function cleanupSeed(seed: Seed) {
  const { prisma } = await loadModules();

  await prisma.emailLog.deleteMany({ where: { bookingId: seed.bookingId } });
  await prisma.bookingStatusHistory.deleteMany({ where: { bookingId: seed.bookingId } });
  await prisma.bookingActionToken.deleteMany({ where: { bookingId: seed.bookingId } });
  await prisma.booking.deleteMany({ where: { id: seed.bookingId } });
  await prisma.client.deleteMany({ where: { id: seed.clientId } });
  await prisma.availabilitySlot.deleteMany({ where: { id: seed.slotId } });
  await prisma.service.deleteMany({ where: { id: seed.serviceId } });
  await prisma.serviceCategory.deleteMany({ where: { id: seed.categoryId } });
  await prisma.adminUser.deleteMany({ where: { id: seed.actorUserId } });
}

function assertApprovedEmailPayloadHasSelfServiceLinks(payload: unknown) {
  assert.equal(typeof payload, "object");
  assert.ok(payload && !Array.isArray(payload));
  assert.ok("manageReservationUrl" in payload);
  assert.ok("cancellationUrl" in payload);

  const data = payload as {
    manageReservationUrl: string;
    cancellationUrl: string;
  };

  assert.match(data.manageReservationUrl, /\/rezervace\/sprava\//);
  assert.match(data.cancellationUrl, /\/rezervace\/storno\//);
}

dbTest("applyAdminBookingStatusChange stores manage and cancellation links in approved email payload", async () => {
  const seed = await createSeed();

  try {
    const { prisma, applyAdminBookingStatusChange } = await loadModules();
    const result = await applyAdminBookingStatusChange({
      bookingId: seed.bookingId,
      targetStatus: "CONFIRMED",
      actorUserId: seed.actorUserId,
      reason: "Integration test confirmation",
      internalNote: null,
    });

    assert.deepEqual(result, { status: "success" });

    const emailLog = await prisma.emailLog.findFirst({
      where: {
        bookingId: seed.bookingId,
        templateKey: "booking-approved-v1",
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        payload: true,
      },
    });

    assert.ok(emailLog);
    assertApprovedEmailPayloadHasSelfServiceLinks(emailLog.payload);
  } finally {
    await cleanupSeed(seed);
  }
});

dbTest("performBookingEmailAction approve stores manage and cancellation links in approved email payload", async () => {
  const seed = await createSeed({ withApproveToken: true });

  try {
    const { prisma, performBookingEmailAction } = await loadModules();
    const result = await performBookingEmailAction("approve", seed.approveRawToken!, {
      ipAddress: "127.0.0.1",
      userAgent: "integration-test",
    });

    assert.equal(result.status, "completed");

    const emailLog = await prisma.emailLog.findFirst({
      where: {
        bookingId: seed.bookingId,
        templateKey: "booking-approved-v1",
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        payload: true,
      },
    });

    assert.ok(emailLog);
    assertApprovedEmailPayloadHasSelfServiceLinks(emailLog.payload);
  } finally {
    await cleanupSeed(seed);
  }
});
