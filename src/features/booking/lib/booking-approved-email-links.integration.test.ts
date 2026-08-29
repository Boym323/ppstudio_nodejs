import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

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

type Seed = {
  actorUserId: string;
  bookingId: string;
  clientId: string;
  slotId: string;
  serviceId: string;
  categoryId: string;
  approveRawToken?: string;
  rejectRawToken?: string;
};

async function loadModules() {
  const [{ prisma }, adminBookingModule, bookingEmailActionsModule, actionTokenModule, prismaClientModule, resendModule] =
    await Promise.all([
      import("@/lib/prisma"),
      import("@/features/admin/lib/admin-booking"),
      import("./booking-email-actions"),
      import("./booking-action-tokens"),
      import("@/generated/prisma/browser"),
      import("@/features/admin/actions/email-log-resend"),
    ]);

  return {
    prisma,
    applyAdminBookingStatusChange: adminBookingModule.applyAdminBookingStatusChange,
    performBookingEmailAction: bookingEmailActionsModule.performBookingEmailAction,
    buildBookingActionExpiry: actionTokenModule.buildBookingActionExpiry,
    buildBookingSelfServiceActionExpiry: actionTokenModule.buildBookingSelfServiceActionExpiry,
    buildBookingActionToken: actionTokenModule.buildBookingActionToken,
    hashBookingActionToken: actionTokenModule.hashBookingActionToken,
    createResendEmailLog: resendModule.createResendEmailLog,
    AdminRole: prismaClientModule.AdminRole,
    AvailabilitySlotStatus: prismaClientModule.AvailabilitySlotStatus,
    BookingActionTokenType: prismaClientModule.BookingActionTokenType,
    BookingSource: prismaClientModule.BookingSource,
    BookingStatus: prismaClientModule.BookingStatus,
    EmailAudience: prismaClientModule.EmailAudience,
    EmailLogStatus: prismaClientModule.EmailLogStatus,
    EmailLogType: prismaClientModule.EmailLogType,
  };
}

async function createSeed(options?: { withApproveToken?: boolean; withRejectToken?: boolean }): Promise<Seed> {
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
  let rejectRawToken: string | undefined;

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

  if (options?.withRejectToken) {
    const rejectToken = buildBookingActionToken();
    rejectRawToken = rejectToken.rawToken;

    await prisma.bookingActionToken.create({
      data: {
        bookingId: booking.id,
        type: BookingActionTokenType.REJECT,
        tokenHash: rejectToken.tokenHash,
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
    rejectRawToken,
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
  const data = payload as Record<string, unknown>;
  assert.ok("manageReservationUrl" in data);
  assert.ok("cancellationUrl" in data);

  const typedData = data as {
    manageReservationUrl: string;
    cancellationUrl: string;
  };

  if (process.env.EMAIL_DELIVERY_MODE === "background") {
    assert.match(typedData.manageReservationUrl, /\/rezervace\/sprava\//);
    assert.match(typedData.cancellationUrl, /\/rezervace\/storno\//);
  } else {
    assert.equal(typedData.manageReservationUrl, "[REDACTED]");
    assert.equal(typedData.cancellationUrl, "[REDACTED]");
  }
}

dbTest("applyAdminBookingStatusChange stores manage and cancellation links in approved email payload", async () => {
  const seed = await createSeed();

  try {
    const {
      prisma,
      applyAdminBookingStatusChange,
      buildBookingSelfServiceActionExpiry,
    } = await loadModules();
    const result = await applyAdminBookingStatusChange({
      bookingId: seed.bookingId,
      targetStatus: "CONFIRMED",
      actorUserId: seed.actorUserId,
      reason: "Integration test confirmation",
      internalNote: undefined,
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

    const [booking, actionTokens] = await Promise.all([
      prisma.booking.findUniqueOrThrow({
        where: { id: seed.bookingId },
        select: { scheduledStartsAt: true },
      }),
      prisma.bookingActionToken.findMany({
        where: { bookingId: seed.bookingId },
        select: { type: true, expiresAt: true },
      }),
    ]);

    assert.equal(actionTokens.length, 2);
    assert.ok(actionTokens.every(
      (token) => token.expiresAt.getTime() === buildBookingSelfServiceActionExpiry(booking.scheduledStartsAt).getTime(),
    ));
  } finally {
    await cleanupSeed(seed);
  }
});

dbTest("performBookingEmailAction approve stores manage and cancellation links in approved email payload", async () => {
  const seed = await createSeed({ withApproveToken: true });

  try {
    const {
      prisma,
      performBookingEmailAction,
      buildBookingSelfServiceActionExpiry,
      BookingActionTokenType,
    } = await loadModules();
    const result = await performBookingEmailAction(
      "approve",
      seed.approveRawToken!,
      {
        ipAddress: "127.0.0.1",
        userAgent: "integration-test",
      },
      {
        userId: seed.actorUserId,
      },
    );

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

    const [booking, actionTokens] = await Promise.all([
      prisma.booking.findUniqueOrThrow({
        where: { id: seed.bookingId },
        select: { scheduledStartsAt: true },
      }),
      prisma.bookingActionToken.findMany({
        where: {
          bookingId: seed.bookingId,
          type: { in: [BookingActionTokenType.RESCHEDULE, BookingActionTokenType.CANCEL] },
        },
        select: { expiresAt: true },
      }),
    ]);

    assert.equal(actionTokens.length, 2);
    assert.ok(actionTokens.every(
      (token) => token.expiresAt.getTime() === buildBookingSelfServiceActionExpiry(booking.scheduledStartsAt).getTime(),
    ));
  } finally {
    await cleanupSeed(seed);
  }
});

dbTest("resend tokenového CLIENT e-mailu vydá nové tokeny a staré zneplatní", async () => {
  const seed = await createSeed();
  const {
    prisma,
    buildBookingActionExpiry,
    buildBookingSelfServiceActionExpiry,
    buildBookingActionToken,
    hashBookingActionToken,
    createResendEmailLog,
    BookingActionTokenType,
    EmailAudience,
    EmailLogStatus,
    EmailLogType,
  } = await loadModules();
  const now = new Date();
  const oldManageToken = buildBookingActionToken();
  const oldCancellationToken = buildBookingActionToken();

  try {
    const oldManageRecord = await prisma.bookingActionToken.create({
      data: {
        bookingId: seed.bookingId,
        type: BookingActionTokenType.RESCHEDULE,
        tokenHash: oldManageToken.tokenHash,
        expiresAt: buildBookingActionExpiry(now),
      },
      select: { id: true },
    });
    await prisma.bookingActionToken.create({
      data: {
        bookingId: seed.bookingId,
        type: BookingActionTokenType.CANCEL,
        tokenHash: oldCancellationToken.tokenHash,
        expiresAt: buildBookingActionExpiry(now),
      },
    });
    const source = await prisma.emailLog.create({
      data: {
        bookingId: seed.bookingId,
        clientId: seed.clientId,
        actionTokenId: oldManageRecord.id,
        type: EmailLogType.BOOKING_CONFIRMED,
        audience: EmailAudience.CLIENT,
        status: EmailLogStatus.SENT,
        recipientEmail: "historical@example.com",
        subject: "Rezervace potvrzena",
        templateKey: "booking-approved-v1",
        payload: {
          bookingId: seed.bookingId,
          serviceName: "Původní služba",
          clientName: "Původní klientka",
          scheduledStartsAt: "2026-08-17T10:00:00.000Z",
          scheduledEndsAt: "2026-08-17T11:00:00.000Z",
          manageReservationUrl: `https://example.com/rezervace/sprava/${oldManageToken.rawToken}`,
          cancellationUrl: `https://example.com/rezervace/storno/${oldCancellationToken.rawToken}`,
          includeCalendarAttachment: true,
          auditValue: "zachovat",
        },
      },
    });
    const sourceForResend = await prisma.emailLog.findUniqueOrThrow({
      where: { id: source.id },
      include: {
        client: { select: { id: true, email: true } },
        booking: { select: { id: true, clientEmailSnapshot: true } },
      },
    });

    const resend = await createResendEmailLog({ emailLog: sourceForResend });
    assert.ok(resend);
    const resendPayload = resend.payload as Record<string, unknown>;
    const newManageToken = String(resendPayload.manageReservationUrl).split("/").pop();
    const newCancellationToken = String(resendPayload.cancellationUrl).split("/").pop();

    assert.ok(newManageToken);
    assert.ok(newCancellationToken);
    assert.notEqual(newManageToken, oldManageToken.rawToken);
    assert.notEqual(newCancellationToken, oldCancellationToken.rawToken);
    assert.equal(resend.status, EmailLogStatus.PENDING);
    assert.equal(resend.actionTokenId !== null, true);
    assert.equal(resendPayload.auditValue, "zachovat");
    assert.ok(await prisma.bookingActionToken.findUnique({ where: { tokenHash: hashBookingActionToken(newManageToken) } }));
    assert.ok(await prisma.bookingActionToken.findUnique({ where: { tokenHash: hashBookingActionToken(newCancellationToken) } }));

    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: seed.bookingId },
      select: { scheduledStartsAt: true },
    });
    const newActionTokens = await prisma.bookingActionToken.findMany({
      where: {
        bookingId: seed.bookingId,
        tokenHash: { in: [hashBookingActionToken(newManageToken), hashBookingActionToken(newCancellationToken)] },
      },
      select: { expiresAt: true },
    });
    assert.equal(newActionTokens.length, 2);
    assert.ok(newActionTokens.every(
      (token) => token.expiresAt.getTime() === buildBookingSelfServiceActionExpiry(booking.scheduledStartsAt).getTime(),
    ));

    const oldTokens = await prisma.bookingActionToken.findMany({
      where: { bookingId: seed.bookingId, tokenHash: { in: [oldManageToken.tokenHash, oldCancellationToken.tokenHash] } },
      select: { revokedAt: true },
    });
    assert.equal(oldTokens.length, 2);
    assert.ok(oldTokens.every((token) => token.revokedAt));
  } finally {
    await cleanupSeed(seed);
  }
});

dbTest("resend tokenového ADMIN e-mailu vydá nové approve/reject tokeny", async () => {
  const seed = await createSeed();
  const {
    prisma,
    buildBookingActionExpiry,
    buildBookingActionToken,
    hashBookingActionToken,
    createResendEmailLog,
    BookingActionTokenType,
    EmailAudience,
    EmailLogStatus,
    EmailLogType,
  } = await loadModules();
  const now = new Date();
  const oldApproveToken = buildBookingActionToken();
  const oldRejectToken = buildBookingActionToken();

  try {
    await prisma.bookingActionToken.create({
      data: {
        bookingId: seed.bookingId,
        type: BookingActionTokenType.APPROVE,
        tokenHash: oldApproveToken.tokenHash,
        expiresAt: buildBookingActionExpiry(now, 7),
      },
    });
    await prisma.bookingActionToken.create({
      data: {
        bookingId: seed.bookingId,
        type: BookingActionTokenType.REJECT,
        tokenHash: oldRejectToken.tokenHash,
        expiresAt: buildBookingActionExpiry(now, 7),
      },
    });
    const source = await prisma.emailLog.create({
      data: {
        bookingId: seed.bookingId,
        clientId: seed.clientId,
        type: EmailLogType.BOOKING_CREATED,
        audience: EmailAudience.ADMIN,
        status: EmailLogStatus.SENT,
        recipientEmail: "admin@example.com",
        subject: "Nová rezervace",
        templateKey: "admin-booking-notification-v1",
        payload: {
          bookingId: seed.bookingId,
          serviceName: "Služba",
          clientName: "Klientka",
          clientEmail: "client@example.com",
          scheduledStartsAt: "2026-08-17T10:00:00.000Z",
          scheduledEndsAt: "2026-08-17T11:00:00.000Z",
          approveUrl: `https://example.com/rezervace/akce/approve/${oldApproveToken.rawToken}`,
          rejectUrl: `https://example.com/rezervace/akce/reject/${oldRejectToken.rawToken}`,
          adminUrl: "https://example.com/admin/rezervace/booking-1",
        },
      },
    });
    const sourceForResend = await prisma.emailLog.findUniqueOrThrow({
      where: { id: source.id },
      include: {
        client: { select: { id: true, email: true } },
        booking: { select: { id: true, clientEmailSnapshot: true } },
      },
    });

    const resend = await createResendEmailLog({
      emailLog: sourceForResend,
      adminNotificationEmail: "admin@example.com",
    });
    assert.ok(resend);
    const resendPayload = resend.payload as Record<string, unknown>;
    const newApproveToken = String(resendPayload.approveUrl).split("/").pop();
    const newRejectToken = String(resendPayload.rejectUrl).split("/").pop();

    assert.ok(newApproveToken);
    assert.ok(newRejectToken);
    assert.notEqual(newApproveToken, oldApproveToken.rawToken);
    assert.notEqual(newRejectToken, oldRejectToken.rawToken);
    assert.ok(await prisma.bookingActionToken.findUnique({ where: { tokenHash: hashBookingActionToken(newApproveToken) } }));
    assert.ok(await prisma.bookingActionToken.findUnique({ where: { tokenHash: hashBookingActionToken(newRejectToken) } }));
    const newAdminTokens = await prisma.bookingActionToken.findMany({
      where: {
        bookingId: seed.bookingId,
        tokenHash: { in: [hashBookingActionToken(newApproveToken), hashBookingActionToken(newRejectToken)] },
      },
      select: { expiresAt: true, createdAt: true },
    });
    assert.equal(newAdminTokens.length, 2);
    assert.ok(newAdminTokens.every(
      (token) => Math.abs(
        token.expiresAt.getTime() - token.createdAt.getTime() - 7 * 24 * 60 * 60 * 1000,
      ) < 1_000,
    ));
    const oldTokens = await prisma.bookingActionToken.findMany({
      where: { bookingId: seed.bookingId, tokenHash: { in: [oldApproveToken.tokenHash, oldRejectToken.tokenHash] } },
      select: { revokedAt: true },
    });
    assert.equal(oldTokens.length, 2);
    assert.ok(oldTokens.every((token) => token.revokedAt));
  } finally {
    await cleanupSeed(seed);
  }
});

dbTest("performBookingEmailAction without admin actor does not change booking status", async () => {
  const seed = await createSeed({ withApproveToken: true });

  try {
    const { prisma, performBookingEmailAction, BookingStatus } = await loadModules();
    const result = await performBookingEmailAction("approve", seed.approveRawToken!, {
      ipAddress: "127.0.0.1",
      userAgent: "integration-test",
    });

    assert.equal(result.status, "auth_required");

    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: seed.bookingId },
      select: { status: true },
    });
    const token = await prisma.bookingActionToken.findFirstOrThrow({
      where: { bookingId: seed.bookingId },
      select: { usedAt: true },
    });

    assert.equal(booking.status, BookingStatus.PENDING);
    assert.equal(token.usedAt, null);
  } finally {
    await cleanupSeed(seed);
  }
});

dbTest("performBookingEmailAction with admin actor records a user audit entry", async () => {
  const seed = await createSeed({ withApproveToken: true });

  try {
    const { prisma, performBookingEmailAction, BookingStatus } = await loadModules();
    const result = await performBookingEmailAction(
      "approve",
      seed.approveRawToken!,
      {
        ipAddress: "127.0.0.1",
        userAgent: "integration-test",
      },
      {
        userId: seed.actorUserId,
      },
    );

    assert.equal(result.status, "completed");

    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: seed.bookingId },
      select: { status: true },
    });
    const history = await prisma.bookingStatusHistory.findFirstOrThrow({
      where: { bookingId: seed.bookingId, status: BookingStatus.CONFIRMED },
      select: { actorUserId: true, reason: true },
    });

    assert.equal(booking.status, BookingStatus.CONFIRMED);
    assert.equal(history.actorUserId, seed.actorUserId);
    assert.equal(history.reason, "owner-email-approve-v1");
  } finally {
    await cleanupSeed(seed);
  }
});

dbTest("performBookingEmailAction reject restores availability across an archived split slot", async () => {
  const seed = await createSeed({ withRejectToken: true });
  const { prisma, performBookingEmailAction, AvailabilitySlotStatus, BookingStatus } = await loadModules();
  const fragmentIds: string[] = [];

  try {
    const slot = await prisma.availabilitySlot.findUniqueOrThrow({
      where: { id: seed.slotId },
      select: { startsAt: true, endsAt: true },
    });
    const fragmentDuration = 30 * 60 * 1000;

    await prisma.availabilitySlot.update({
      where: { id: seed.slotId },
      data: { status: AvailabilitySlotStatus.ARCHIVED },
    });

    const fragments = await prisma.availabilitySlot.createManyAndReturn({
      data: [
        {
          startsAt: new Date(slot.startsAt.getTime() - fragmentDuration),
          endsAt: slot.startsAt,
          capacity: 1,
          status: AvailabilitySlotStatus.PUBLISHED,
          publishedAt: new Date(),
          serviceRestrictionMode: "ANY",
          createdByUserId: seed.actorUserId,
        },
        {
          startsAt: slot.endsAt,
          endsAt: new Date(slot.endsAt.getTime() + fragmentDuration),
          capacity: 1,
          status: AvailabilitySlotStatus.PUBLISHED,
          publishedAt: new Date(),
          serviceRestrictionMode: "ANY",
          createdByUserId: seed.actorUserId,
        },
      ],
      select: { id: true },
    });
    fragmentIds.push(...fragments.map((fragment) => fragment.id));

    const result = await performBookingEmailAction(
      "reject",
      seed.rejectRawToken!,
      undefined,
      { userId: seed.actorUserId },
    );

    assert.equal(result.status, "completed");

    const [booking, overlappingSlots, blockingBookings] = await Promise.all([
      prisma.booking.findUniqueOrThrow({
        where: { id: seed.bookingId },
        select: { status: true },
      }),
      prisma.availabilitySlot.findMany({
        where: {
          startsAt: { lt: slot.endsAt },
          endsAt: { gt: slot.startsAt },
        },
        orderBy: { startsAt: "asc" },
        select: {
          id: true,
          status: true,
          startsAt: true,
          endsAt: true,
          bookings: {
            select: { id: true, status: true, manualOverride: true },
          },
        },
      }),
      prisma.booking.findMany({
        where: {
          status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
          scheduledStartsAt: { lt: slot.endsAt },
          OR: [
            { blockedUntil: { gt: slot.startsAt } },
            { blockedUntil: null, scheduledEndsAt: { gt: slot.startsAt } },
          ],
        },
        select: { id: true, status: true, manualOverride: true },
      }),
    ]);

    assert.equal(booking.status, BookingStatus.CANCELLED);

    let coveredUntil = slot.startsAt.getTime();
    for (const publishedSlot of overlappingSlots.filter((item) => item.status === AvailabilitySlotStatus.PUBLISHED)) {
      if (publishedSlot.startsAt.getTime() <= coveredUntil) {
        coveredUntil = Math.max(coveredUntil, publishedSlot.endsAt.getTime());
      }
    }

    assert.ok(coveredUntil >= slot.endsAt.getTime(), "Původní interval musí být celý pokryt publikovanou dostupností.");
    assert.equal(
      overlappingSlots.some((item) => item.status === AvailabilitySlotStatus.DRAFT
        && item.bookings.some((bookingItem) => bookingItem.manualOverride && bookingItem.status === BookingStatus.CANCELLED)),
      false,
      "Osiřelý DRAFT slot ruční výjimky nesmí blokovat obnovenou dostupnost.",
    );
    assert.deepEqual(blockingBookings, []);
  } finally {
    await prisma.availabilitySlot.deleteMany({ where: { id: { in: fragmentIds } } });
    await cleanupSeed(seed);
  }
});
