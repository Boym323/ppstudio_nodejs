import "dotenv/config";

import {
  AdminRole,
  AvailabilitySlotServiceRestrictionMode,
  AvailabilitySlotStatus,
  BookingActionTokenType,
  BookingActorType,
  BookingSource,
  BookingStatus,
  VoucherStatus,
  VoucherType,
} from "@prisma/client";

import {
  buildBookingActionExpiry,
  buildBookingActionToken,
} from "../../../src/features/booking/lib/booking-action-tokens";
import { hashPassword } from "../../../src/lib/auth/password";
import { prisma } from "../../../src/lib/prisma";

export type E2eFixture = {
  runId: string;
  serviceName: string;
  serviceSlug: string;
  categoryName: string;
  clientName: string;
  clientEmail: string;
  voucherCode?: string;
  bookingId?: string;
  cancelToken?: string;
  manageToken?: string;
  adminEmail?: string;
  adminPassword?: string;
  slotLabels: {
    primaryDateKey: string;
    primaryTime: string;
    rescheduleDateKey: string;
    rescheduleTime: string;
  };
};

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function addDays(value: Date, days: number) {
  const copy = new Date(value);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function futureUtcDate(daysFromNow: number, utcHour: number, utcMinute = 0) {
  const value = addDays(new Date(), daysFromNow);
  value.setUTCHours(utcHour, utcMinute, 0, 0);
  return value;
}

function addMinutes(value: Date, minutes: number) {
  return new Date(value.getTime() + minutes * 60 * 1000);
}

function formatPragueTime(value: Date) {
  return new Intl.DateTimeFormat("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Prague",
  }).format(value);
}

function formatPragueDateKey(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Prague",
  }).formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error(`Could not format Prague date key for ${value.toISOString()}`);
  }

  return `${year}-${month}-${day}`;
}

function buildRunId() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createCatalogFixture(runId: string) {
  const categoryName = `E2E kategorie ${runId}`;
  const serviceName = `E2E služba ${runId}`;
  const categorySlug = slugify(categoryName);
  const serviceSlug = slugify(serviceName);

  const category = await prisma.serviceCategory.create({
    data: {
      name: categoryName,
      slug: categorySlug,
      publicName: categoryName,
      description: "Dočasná E2E kategorie.",
      sortOrder: -10_000,
      pricingSortOrder: -10_000,
      isActive: true,
    },
  });

  const service = await prisma.service.create({
    data: {
      categoryId: category.id,
      name: serviceName,
      publicName: serviceName,
      slug: serviceSlug,
      shortDescription: "Dočasná E2E služba pro ověření rezervačního flow.",
      durationMinutes: 60,
      priceFromCzk: 900,
      sortOrder: -10_000,
      isActive: true,
      isPubliclyBookable: true,
    },
  });

  const primaryStart = futureUtcDate(45, 8);
  const primaryEnd = addMinutes(primaryStart, 180);
  const rescheduleStart = futureUtcDate(46, 9);
  const rescheduleEnd = addMinutes(rescheduleStart, 180);

  const [primarySlot, rescheduleSlot] = await Promise.all([
    prisma.availabilitySlot.create({
      data: {
        startsAt: primaryStart,
        endsAt: primaryEnd,
        capacity: 1,
        status: AvailabilitySlotStatus.PUBLISHED,
        serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.SELECTED,
        publishedAt: new Date(),
        publicNote: `E2E primary ${runId}`,
        allowedServices: {
          create: {
            serviceId: service.id,
          },
        },
      },
    }),
    prisma.availabilitySlot.create({
      data: {
        startsAt: rescheduleStart,
        endsAt: rescheduleEnd,
        capacity: 1,
        status: AvailabilitySlotStatus.PUBLISHED,
        serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode.SELECTED,
        publishedAt: new Date(),
        publicNote: `E2E reschedule ${runId}`,
        allowedServices: {
          create: {
            serviceId: service.id,
          },
        },
      },
    }),
  ]);

  return {
    category,
    service,
    primarySlot,
    primaryStart,
    primaryEnd,
    rescheduleSlot,
    rescheduleStart,
    rescheduleEnd,
    categoryName,
    serviceName,
    serviceSlug,
  };
}

export async function createPublicBookingFixture(): Promise<E2eFixture> {
  const runId = buildRunId();
  const catalog = await createCatalogFixture(runId);

  return {
    runId,
    serviceName: catalog.serviceName,
    serviceSlug: catalog.serviceSlug,
    categoryName: catalog.categoryName,
    clientName: `E2E Klientka ${runId}`,
    clientEmail: `${runId}@example.test`,
    slotLabels: {
      primaryDateKey: formatPragueDateKey(catalog.primaryStart),
      primaryTime: formatPragueTime(catalog.primaryStart),
      rescheduleDateKey: formatPragueDateKey(catalog.rescheduleStart),
      rescheduleTime: formatPragueTime(catalog.rescheduleStart),
    },
  };
}

export async function createManagedBookingFixture(
  status: BookingStatus = BookingStatus.CONFIRMED,
  options?: {
    createRescheduleConflict?: boolean;
  },
): Promise<E2eFixture> {
  const runId = buildRunId();
  const catalog = await createCatalogFixture(runId);
  const clientName = `E2E Klientka ${runId}`;
  const clientEmail = `${runId}@example.test`;

  const client = await prisma.client.create({
    data: {
      fullName: clientName,
      email: clientEmail,
      phone: "+420777000000",
      lastBookedAt: catalog.primaryStart,
    },
  });

  const booking = await prisma.booking.create({
    data: {
      clientId: client.id,
      slotId: catalog.primarySlot.id,
      serviceId: catalog.service.id,
      source: BookingSource.WEB,
      status,
      clientNameSnapshot: clientName,
      clientEmailSnapshot: clientEmail,
      clientPhoneSnapshot: client.phone,
      serviceNameSnapshot: catalog.service.name,
      serviceDurationMinutes: catalog.service.durationMinutes,
      servicePriceFromCzk: catalog.service.priceFromCzk,
      scheduledStartsAt: catalog.primaryStart,
      scheduledEndsAt: addMinutes(catalog.primaryStart, catalog.service.durationMinutes),
      confirmedAt: status === BookingStatus.CONFIRMED ? new Date() : null,
      statusHistory: {
        create: {
          status,
          actorType: BookingActorType.SYSTEM,
          note: "E2E fixture",
        },
      },
    },
  });

  if (options?.createRescheduleConflict) {
    const conflictEmail = `${runId}-conflict@example.test`;
    const conflictStart = addMinutes(catalog.primaryStart, catalog.service.durationMinutes);
    const conflictClient = await prisma.client.create({
      data: {
        fullName: `E2E Kolize ${runId}`,
        email: conflictEmail,
        phone: "+420777000001",
        lastBookedAt: conflictStart,
      },
    });

    await prisma.booking.create({
      data: {
        clientId: conflictClient.id,
        slotId: catalog.primarySlot.id,
        serviceId: catalog.service.id,
        source: BookingSource.WEB,
        status: BookingStatus.CONFIRMED,
        clientNameSnapshot: conflictClient.fullName,
        clientEmailSnapshot: conflictEmail,
        clientPhoneSnapshot: conflictClient.phone,
        serviceNameSnapshot: catalog.service.name,
        serviceDurationMinutes: catalog.service.durationMinutes,
        servicePriceFromCzk: catalog.service.priceFromCzk,
        scheduledStartsAt: conflictStart,
        scheduledEndsAt: addMinutes(conflictStart, catalog.service.durationMinutes),
        confirmedAt: new Date(),
        statusHistory: {
          create: {
            status: BookingStatus.CONFIRMED,
            actorType: BookingActorType.SYSTEM,
            note: "E2E fixture conflict booking",
          },
        },
      },
    });
  }

  const cancelToken = buildBookingActionToken();
  const manageToken = buildBookingActionToken();

  await prisma.bookingActionToken.createMany({
    data: [
      {
        bookingId: booking.id,
        type: BookingActionTokenType.CANCEL,
        tokenHash: cancelToken.tokenHash,
        expiresAt: buildBookingActionExpiry(catalog.primaryStart),
      },
      {
        bookingId: booking.id,
        type: BookingActionTokenType.RESCHEDULE,
        tokenHash: manageToken.tokenHash,
        expiresAt: buildBookingActionExpiry(catalog.primaryStart),
      },
    ],
  });

  return {
    runId,
    serviceName: catalog.serviceName,
    serviceSlug: catalog.serviceSlug,
    categoryName: catalog.categoryName,
    clientName,
    clientEmail,
    bookingId: booking.id,
    cancelToken: cancelToken.rawToken,
    manageToken: manageToken.rawToken,
    slotLabels: {
      primaryDateKey: formatPragueDateKey(catalog.primaryStart),
      primaryTime: formatPragueTime(catalog.primaryStart),
      rescheduleDateKey: formatPragueDateKey(catalog.rescheduleStart),
      rescheduleTime: formatPragueTime(catalog.rescheduleStart),
    },
  };
}

export async function createAdminFixture(runId: string) {
  const password = `E2E-password-${runId}`;
  const email = `${runId}-owner@example.test`;

  await prisma.adminUser.create({
    data: {
      email,
      name: `E2E Owner ${runId}`,
      role: AdminRole.OWNER,
      passwordHash: await hashPassword(password),
      isActive: true,
    },
  });

  return { email, password };
}

export async function createPublicVoucherFixture(): Promise<E2eFixture> {
  const runId = buildRunId();
  const voucherCode = `PP-2026-${runId.replace(/[^a-z0-9]/gi, "").slice(-10).toUpperCase()}`;

  await prisma.voucher.create({
    data: {
      code: voucherCode,
      type: VoucherType.VALUE,
      status: VoucherStatus.ACTIVE,
      purchaserEmail: `${runId}@secret.example.test`,
      originalValueCzk: 1500,
      remainingValueCzk: 1500,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validUntil: new Date("2026-12-31T23:59:59.000Z"),
      issuedAt: new Date("2026-01-01T00:00:00.000Z"),
      internalNote: `E2E tajná poznámka ${runId}`,
    },
  });

  return {
    runId,
    voucherCode,
    serviceName: "",
    serviceSlug: "",
    categoryName: "",
    clientName: "",
    clientEmail: "",
    slotLabels: {
      primaryDateKey: "",
      primaryTime: "",
      rescheduleDateKey: "",
      rescheduleTime: "",
    },
  };
}

export async function cleanupE2eData(runId: string) {
  const services = await prisma.service.findMany({
    where: {
      slug: {
        contains: runId,
      },
    },
    select: {
      id: true,
      categoryId: true,
    },
  });
  const serviceIds = services.map((service) => service.id);
  const categoryIds = [...new Set(services.map((service) => service.categoryId))];
  const clients = await prisma.client.findMany({
    where: {
      email: {
        contains: runId,
      },
    },
    select: {
      id: true,
    },
  });
  const clientIds = clients.map((client) => client.id);
  const bookingCleanupFilters = [
    ...(serviceIds.length > 0 ? [{ serviceId: { in: serviceIds } }] : []),
    ...(clientIds.length > 0 ? [{ clientId: { in: clientIds } }] : []),
  ];
  const bookings = bookingCleanupFilters.length > 0 ? await prisma.booking.findMany({
    where: {
      OR: bookingCleanupFilters,
    },
    select: {
      id: true,
    },
  }) : [];
  const bookingIds = bookings.map((booking) => booking.id);
  const actionTokens = await prisma.bookingActionToken.findMany({
    where: {
      bookingId: {
        in: bookingIds,
      },
    },
    select: {
      id: true,
    },
  });
  const actionTokenIds = actionTokens.map((token) => token.id);
  const slots = await prisma.availabilitySlot.findMany({
    where: {
      publicNote: {
        contains: runId,
      },
    },
    select: {
      id: true,
    },
  });
  const slotIds = slots.map((slot) => slot.id);

  await prisma.voucherRedemption.deleteMany({
    where: {
      voucher: {
        internalNote: {
          contains: runId,
        },
      },
    },
  });
  await prisma.voucher.deleteMany({
    where: {
      internalNote: {
        contains: runId,
      },
    },
  });

  await prisma.emailLog.deleteMany({
    where: {
      OR: [
        { recipientEmail: { contains: runId } },
        ...(bookingIds.length > 0 ? [{ bookingId: { in: bookingIds } }] : []),
        ...(clientIds.length > 0 ? [{ clientId: { in: clientIds } }] : []),
        ...(actionTokenIds.length > 0 ? [{ actionTokenId: { in: actionTokenIds } }] : []),
      ],
    },
  });

  const submissionCleanupFilters = [
    ...(bookingIds.length > 0 ? [{ bookingId: { in: bookingIds } }] : []),
    ...(clientIds.length > 0 ? [{ clientId: { in: clientIds } }] : []),
    ...(serviceIds.length > 0 ? [{ serviceId: { in: serviceIds } }] : []),
    ...(slotIds.length > 0 ? [{ slotId: { in: slotIds } }] : []),
  ];

  if (submissionCleanupFilters.length > 0) {
    await prisma.bookingSubmissionLog.deleteMany({
      where: {
        OR: submissionCleanupFilters,
      },
    });
  }
  await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
  const slotServiceCleanupFilters = [
    ...(slotIds.length > 0 ? [{ slotId: { in: slotIds } }] : []),
    ...(serviceIds.length > 0 ? [{ serviceId: { in: serviceIds } }] : []),
  ];

  if (slotServiceCleanupFilters.length > 0) {
    await prisma.availabilitySlotService.deleteMany({
      where: {
        OR: slotServiceCleanupFilters,
      },
    });
  }
  await prisma.availabilitySlot.deleteMany({ where: { id: { in: slotIds } } });
  await prisma.client.deleteMany({ where: { id: { in: clientIds } } });
  await prisma.service.deleteMany({ where: { id: { in: serviceIds } } });
  await prisma.serviceCategory.deleteMany({ where: { id: { in: categoryIds } } });
  await prisma.adminUser.deleteMany({
    where: {
      email: {
        contains: runId,
      },
    },
  });
}

export { prisma };
