import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  AvailabilitySlotStatus,
  BookingActorType,
  BookingActionTokenType,
  BookingSource,
  BookingStatus,
  EmailAudience,
  EmailLogStatus,
  EmailLogType,
} from "@/generated/prisma/browser";
import { Prisma } from "@/generated/prisma/client";
import { getNextCalendarDate, getPragueLocalDate, resolvePragueLocalDateTime } from "@/features/booking/lib/booking-local-time";

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

async function findIsolatedAdminWindow(
  prisma: Awaited<typeof import("@/lib/prisma")>["prisma"],
  seed: string,
  durationMinutes: number,
  options: { isolateReminderScan?: boolean } = {},
) {
  const daySeed = Number.parseInt(seed.slice(0, 4), 16);
  const hourSeed = Number.parseInt(seed.slice(4, 6), 16);
  const minuteSeed = Number.parseInt(seed.slice(6, 8), 16);
  const hourCandidates = [7, 8, 9, 10, 11, 12, 13, 14].map(
    (hour, index, list) => list[(index + hourSeed) % list.length] ?? hour,
  );
  const minuteCandidates = [0, 15, 30].map(
    (minute, index, list) => list[(index + minuteSeed) % list.length] ?? minute,
  );
  const now = new Date();

  for (let dayStep = 0; dayStep < 45; dayStep += 1) {
    const dayOffset = 14 + ((daySeed + dayStep) % 45);

    for (const hour of hourCandidates) {
      for (const minute of minuteCandidates) {
        const startsAt = new Date(now);
        startsAt.setUTCSeconds(0, 0);
        startsAt.setUTCDate(startsAt.getUTCDate() + dayOffset);
        startsAt.setUTCHours(hour, minute, 0, 0);
        const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);

        const [overlappingSlots, overlappingBookings] = await Promise.all([
          prisma.availabilitySlot.count({
            where: {
              // Obnova dostupnosti nesmí sloučit fixture se sousedním reálným slotem.
              startsAt: { lte: endsAt },
              endsAt: { gte: startsAt },
            },
          }),
          prisma.booking.count({
            where: {
              status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
              scheduledStartsAt: { lt: endsAt },
              OR: [
                { blockedUntil: { gt: startsAt } },
                { blockedUntil: null, scheduledEndsAt: { gt: startsAt } },
              ],
            },
          }),
        ]);

        if (overlappingSlots === 0 && overlappingBookings === 0) {
          if (options.isolateReminderScan) {
            const reminderScanAt = new Date(startsAt.getTime() - 25.5 * 60 * 60 * 1000);
            const reminderWindowEnd = new Date(reminderScanAt.getTime() + 26 * 60 * 60 * 1000);
            const otherReminderBookings = await prisma.booking.count({
              where: {
                status: BookingStatus.CONFIRMED,
                clientEmailSnapshot: { not: "" },
                reminder24hSentAt: null,
                scheduledStartsAt: {
                  gt: reminderScanAt,
                  lte: reminderWindowEnd,
                },
              },
            });

            if (otherReminderBookings > 0) continue;
          }

          return { startsAt, endsAt };
        }
      }
    }
  }

  throw new Error("Nepodařilo se najít izolované okno pro admin booking integrační test.");
}

async function disableAutoLunchForAdminFixture(
  prisma: Awaited<typeof import("@/lib/prisma")>["prisma"],
  localDate: string,
  ownerId: string,
) {
  const existingOverride = await prisma.autoLunchDayOverride.findUnique({
    where: { dateKey: localDate },
    select: { dateKey: true },
  });

  if (existingOverride) return false;

  await prisma.autoLunchDayOverride.create({
    data: { dateKey: localDate, updatedByUserId: ownerId },
  });
  return true;
}

async function createAdminServiceChangeFixture(
  prisma: Awaited<typeof import("@/lib/prisma")>["prisma"],
  suffix: string,
  options: { isolateReminderScan?: boolean; windowMinutes?: number } = {},
) {
  const isolatedWindow = await findIsolatedAdminWindow(prisma, suffix, options.windowMinutes ?? 120, options);
  const { startsAt, endsAt } = isolatedWindow;
  const bookingEndsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
  const owner = await prisma.adminUser.create({
    data: {
      email: `owner-service-change-${suffix}@example.com`,
      name: `Owner service change ${suffix}`,
      role: "OWNER",
      isActive: true,
    },
    select: { id: true },
  });
  const autoLunchOverrideCreated = await disableAutoLunchForAdminFixture(
    prisma,
    getPragueLocalDate(startsAt),
    owner.id,
  );
  const category = await prisma.serviceCategory.create({
    data: {
      name: `Kategorie změny služby ${suffix}`,
      slug: `kategorie-zmeny-sluzby-${suffix}`,
      isActive: true,
    },
    select: { id: true },
  });
  const [originalService, replacementService] = await Promise.all([
    prisma.service.create({
      data: {
        categoryId: category.id,
        name: `Původní změna služby ${suffix}`,
        slug: `puvodni-zmena-sluzby-${suffix}`,
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
        name: `Delší změna služby ${suffix}`,
        slug: `delsi-zmena-sluzby-${suffix}`,
        durationMinutes: 90,
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
      publishedAt: new Date(startsAt.getTime() - 24 * 60 * 60 * 1000),
    },
    select: { id: true },
  });
  const client = await prisma.client.create({
    data: {
      fullName: `Klientka změny služby ${suffix}`,
      email: `client-service-change-${suffix}@example.com`,
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
      clientEmailSnapshot: `client-service-change-${suffix}@example.com`,
      clientPhoneSnapshot: "+420777123456",
      serviceNameSnapshot: `Původní změna služby ${suffix}`,
      serviceDurationMinutes: 60,
      servicePriceFromCzk: 1200,
      scheduledStartsAt: startsAt,
      scheduledEndsAt: bookingEndsAt,
      blockedUntil: bookingEndsAt,
    },
    select: { id: true, updatedAt: true },
  });

  return {
    startsAt,
    endsAt,
    bookingEndsAt,
    owner,
    category,
    originalService,
    replacementService,
    slot,
    client,
    booking,
    async cleanup() {
      const serviceIds = [originalService.id, replacementService.id];
      await prisma.bookingActionToken.deleteMany({ where: { booking: { serviceId: { in: serviceIds } } } });
      await prisma.emailLog.deleteMany({ where: { booking: { serviceId: { in: serviceIds } } } });
      await prisma.bookingStatusHistory.deleteMany({ where: { booking: { serviceId: { in: serviceIds } } } });
      await prisma.booking.deleteMany({ where: { serviceId: { in: serviceIds } } });
      await prisma.client.deleteMany({
        where: {
          OR: [
            { email: { contains: suffix } },
            { email: { startsWith: `concurrent-service-change-${booking.id}@` } },
          ],
        },
      });
      await prisma.availabilitySlot.deleteMany({
        where: { startsAt: { gte: startsAt, lt: endsAt } },
      });
      if (autoLunchOverrideCreated) {
        await prisma.autoLunchDayOverride.deleteMany({
          where: { dateKey: getPragueLocalDate(startsAt), updatedByUserId: owner.id },
        });
      }
      await prisma.service.deleteMany({ where: { id: { in: serviceIds } } });
      await prisma.serviceCategory.deleteMany({ where: { id: category.id } });
      await prisma.adminUser.deleteMany({ where: { id: owner.id } });
    },
  };
}

async function createAdminManualOverrideResizeFixture(
  prisma: Awaited<typeof import("@/lib/prisma")>["prisma"],
  suffix: string,
  options: {
    originalDurationMinutes?: number;
    originalCleanupMinutes?: number;
  } = {},
) {
  const { startsAt: baseStartsAt, endsAt: baseEndsAt } = await findIsolatedAdminWindow(prisma, suffix, 180);
  const originalDurationMinutes = options.originalDurationMinutes ?? 60;
  const originalCleanupMinutes = options.originalCleanupMinutes ?? 0;
  const cleanupBlockMinutes = Math.ceil(originalCleanupMinutes / 15) * 15;
  const manualStartsAt = new Date(baseStartsAt.getTime() + 30 * 60 * 1000);
  const originalAvailabilityStartsAt = new Date(baseStartsAt.getTime() + 60 * 60 * 1000);
  const originalAvailabilityEndsAt = new Date(baseStartsAt.getTime() + 120 * 60 * 1000);
  const manualEndsAt = new Date(
    manualStartsAt.getTime() + (originalDurationMinutes + cleanupBlockMinutes) * 60 * 1000,
  );
  const owner = await prisma.adminUser.create({
    data: {
      email: `owner-manual-resize-${suffix}@example.com`,
      name: `Owner manual resize ${suffix}`,
      role: "OWNER",
      isActive: true,
    },
    select: { id: true },
  });
  const autoLunchOverrideCreated = await disableAutoLunchForAdminFixture(
    prisma,
    getPragueLocalDate(manualStartsAt),
    owner.id,
  );
  const category = await prisma.serviceCategory.create({
    data: {
      name: `Kategorie manual resize ${suffix}`,
      slug: `kategorie-manual-resize-${suffix}`,
      isActive: true,
    },
    select: { id: true },
  });
  const [originalService, shortService, longService] = await Promise.all([
    prisma.service.create({
      data: {
        categoryId: category.id,
        name: `Původní manual resize ${suffix}`,
        slug: `puvodni-manual-resize-${suffix}`,
        durationMinutes: originalDurationMinutes,
        cleanupMinutes: originalCleanupMinutes,
        priceFromCzk: 1200,
        isActive: true,
        isPubliclyBookable: true,
      },
      select: { id: true },
    }),
    prisma.service.create({
      data: {
        categoryId: category.id,
        name: `Kratší manual resize ${suffix}`,
        slug: `kratsi-manual-resize-${suffix}`,
        durationMinutes: originalDurationMinutes === 60 ? 30 : originalDurationMinutes,
        priceFromCzk: 1300,
        isActive: true,
        isPubliclyBookable: true,
      },
      select: { id: true },
    }),
    prisma.service.create({
      data: {
        categoryId: category.id,
        name: `Delší manual resize ${suffix}`,
        slug: `delsi-manual-resize-${suffix}`,
        durationMinutes: 60,
        priceFromCzk: 1400,
        isActive: true,
        isPubliclyBookable: true,
      },
      select: { id: true },
    }),
  ]);
  const originSlot = await prisma.availabilitySlot.create({
    data: {
      startsAt: originalAvailabilityStartsAt,
      endsAt: originalAvailabilityEndsAt,
      status: "PUBLISHED",
      capacity: 1,
      serviceRestrictionMode: "ANY",
      publishedAt: new Date(baseStartsAt.getTime() - 24 * 60 * 60 * 1000),
    },
    select: { id: true },
  });
  await prisma.availabilitySlot.update({
    where: { id: originSlot.id },
    data: { status: "ARCHIVED" },
  });
  const manualOverrideSlot = await prisma.availabilitySlot.create({
    data: {
      startsAt: manualStartsAt,
      endsAt: manualEndsAt,
      status: "DRAFT",
      capacity: 1,
      serviceRestrictionMode: "ANY",
      internalNote: "Dočasná ruční výjimka",
      createdByUserId: owner.id,
    },
    select: { id: true },
  });
  const rightPublishedSlot = await prisma.availabilitySlot.create({
    data: {
      startsAt: manualEndsAt,
      endsAt: originalAvailabilityEndsAt,
      status: "PUBLISHED",
      capacity: 1,
      serviceRestrictionMode: "ANY",
      publishedAt: new Date(baseStartsAt.getTime() - 24 * 60 * 60 * 1000),
    },
    select: { id: true },
  });
  const client = await prisma.client.create({
    data: {
      fullName: `Klientka manual resize ${suffix}`,
      email: `client-manual-resize-${suffix}@example.com`,
      phone: "+420777123456",
      isActive: true,
    },
    select: { id: true },
  });
  const booking = await prisma.booking.create({
    data: {
      clientId: client.id,
      slotId: manualOverrideSlot.id,
      serviceId: originalService.id,
      status: BookingStatus.CONFIRMED,
      source: BookingSource.PHONE,
      isManual: true,
      manualOverride: true,
      clientNameSnapshot: `Klientka manual resize ${suffix}`,
      clientEmailSnapshot: `client-manual-resize-${suffix}@example.com`,
      clientPhoneSnapshot: "+420777123456",
      serviceNameSnapshot: `Původní manual resize ${suffix}`,
      serviceDurationMinutes: originalDurationMinutes,
      cleanupMinutes: originalCleanupMinutes,
      cleanupBlockMinutes,
      servicePriceFromCzk: 1200,
      scheduledStartsAt: manualStartsAt,
      scheduledEndsAt: new Date(manualStartsAt.getTime() + originalDurationMinutes * 60 * 1000),
      blockedUntil: manualEndsAt,
    },
    select: { id: true, updatedAt: true },
  });

  return {
    baseStartsAt,
    baseEndsAt,
    manualStartsAt,
    manualEndsAt,
    originalAvailabilityStartsAt,
    originalAvailabilityEndsAt,
    owner,
    category,
    originalService,
    shortService,
    longService,
    originSlot,
    manualOverrideSlot,
    rightPublishedSlot,
    client,
    booking,
    async cleanup() {
      const serviceIds = [originalService.id, shortService.id, longService.id];
      await prisma.bookingActionToken.deleteMany({ where: { booking: { serviceId: { in: serviceIds } } } });
      await prisma.emailLog.deleteMany({ where: { booking: { serviceId: { in: serviceIds } } } });
      await prisma.bookingStatusHistory.deleteMany({ where: { booking: { serviceId: { in: serviceIds } } } });
      await prisma.bookingRescheduleLog.deleteMany({ where: { booking: { serviceId: { in: serviceIds } } } });
      await prisma.booking.deleteMany({ where: { serviceId: { in: serviceIds } } });
      await prisma.client.deleteMany({ where: { id: client.id } });
      await prisma.availabilitySlot.deleteMany({
        where: {
          startsAt: {
            gte: baseStartsAt,
            lt: new Date(baseEndsAt.getTime() + 120 * 60 * 1000),
          },
        },
      });
      if (autoLunchOverrideCreated) {
        await prisma.autoLunchDayOverride.deleteMany({
          where: { dateKey: getPragueLocalDate(manualStartsAt), updatedByUserId: owner.id },
        });
      }
      await prisma.service.deleteMany({ where: { id: { in: serviceIds } } });
      await prisma.serviceCategory.deleteMany({ where: { id: category.id } });
      await prisma.adminUser.deleteMany({ where: { id: owner.id } });
    },
  };
}

async function findIsolatedAdminAutoLunchDate(
  prisma: Awaited<typeof import("@/lib/prisma")>["prisma"],
) {
  const today = getPragueLocalDate(new Date());

  for (let offset = 14; offset < 75; offset += 1) {
    const localDate = addCalendarDays(today, offset);
    const nextLocalDate = getNextCalendarDate(localDate);
    assert.ok(nextLocalDate);
    const dayStartsAt = at(localDate, "00:00");
    const dayEndsAt = at(nextLocalDate, "00:00");
    const [slotCount, bookingCount, overrideCount] = await Promise.all([
      prisma.availabilitySlot.count({
        where: { startsAt: { lt: dayEndsAt }, endsAt: { gt: dayStartsAt } },
      }),
      prisma.booking.count({
        where: {
          scheduledStartsAt: { lt: dayEndsAt },
          OR: [
            { blockedUntil: { gt: dayStartsAt } },
            { blockedUntil: null, scheduledEndsAt: { gt: dayStartsAt } },
          ],
        },
      }),
      prisma.autoLunchDayOverride.count({ where: { dateKey: localDate } }),
    ]);

    if (slotCount === 0 && bookingCount === 0 && overrideCount === 0) return localDate;
  }

  throw new Error("Nepodařilo se najít izolovaný den pro admin auto-lunch integrační test.");
}

async function createAdminAutoLunchServiceChangeFixture(
  prisma: Awaited<typeof import("@/lib/prisma")>["prisma"],
  suffix: string,
  options: {
    originalDurationMinutes: number;
    replacementDurationMinutes: number;
    activeAutoLunch: boolean;
  },
) {
  const localDate = await findIsolatedAdminAutoLunchDate(prisma);
  const startsAt = at(localDate, "10:30");
  const bookingEndsAt = new Date(startsAt.getTime() + options.originalDurationMinutes * 60 * 1000);
  const availabilityWindows = options.activeAutoLunch
    ? [["07:00", "10:00"], ["10:30", "12:45"], ["14:00", "17:00"]]
    : [["10:30", "12:45"]];

  const owner = await prisma.adminUser.create({
    data: {
      email: `owner-admin-auto-lunch-${suffix}@example.com`,
      name: `Owner admin auto lunch ${suffix}`,
      role: "OWNER",
      isActive: true,
    },
    select: { id: true },
  });
  const { ensureSiteSettings } = await import("@/lib/site-settings");
  const siteSettings = await ensureSiteSettings();
  await prisma.siteSettings.update({
    where: { id: "site-settings" },
    data: { autoLunchEnabled: true },
  });
  const autoLunchOverrideCreated = !options.activeAutoLunch;
  if (autoLunchOverrideCreated) {
    await prisma.autoLunchDayOverride.create({
      data: { dateKey: localDate, updatedByUserId: owner.id },
    });
  }
  const category = await prisma.serviceCategory.create({
    data: {
      name: `Kategorie admin auto lunch ${suffix}`,
      slug: `kategorie-admin-auto-lunch-${suffix}`,
      isActive: true,
    },
    select: { id: true },
  });
  const [originalService, replacementService] = await Promise.all([
    prisma.service.create({
      data: {
        categoryId: category.id,
        name: `Původní admin auto lunch ${suffix}`,
        slug: `puvodni-admin-auto-lunch-${suffix}`,
        durationMinutes: options.originalDurationMinutes,
        priceFromCzk: 1200,
        isActive: true,
        isPubliclyBookable: true,
      },
      select: { id: true },
    }),
    prisma.service.create({
      data: {
        categoryId: category.id,
        name: `Nová admin auto lunch ${suffix}`,
        slug: `nova-admin-auto-lunch-${suffix}`,
        durationMinutes: options.replacementDurationMinutes,
        priceFromCzk: 1500,
        isActive: true,
        isPubliclyBookable: true,
      },
      select: { id: true },
    }),
  ]);
  const slots = await Promise.all(
    availabilityWindows.map(([slotStartsAt, slotEndsAt]) => prisma.availabilitySlot.create({
      data: {
        startsAt: at(localDate, slotStartsAt),
        endsAt: at(localDate, slotEndsAt),
        status: "PUBLISHED",
        capacity: 1,
        serviceRestrictionMode: "ANY",
        publishedAt: new Date(),
      },
      select: { id: true },
    })),
  );
  const bookingSlot = slots[1] ?? slots[0];
  assert.ok(bookingSlot);
  const client = await prisma.client.create({
    data: {
      fullName: `Klientka admin auto lunch ${suffix}`,
      email: `client-admin-auto-lunch-${suffix}@example.com`,
      phone: "+420777123456",
      isActive: true,
    },
    select: { id: true },
  });
  const booking = await prisma.booking.create({
    data: {
      clientId: client.id,
      slotId: bookingSlot.id,
      serviceId: originalService.id,
      status: BookingStatus.CONFIRMED,
      source: "WEB",
      clientNameSnapshot: `Klientka admin auto lunch ${suffix}`,
      clientEmailSnapshot: `client-admin-auto-lunch-${suffix}@example.com`,
      clientPhoneSnapshot: "+420777123456",
      serviceNameSnapshot: `Původní admin auto lunch ${suffix}`,
      serviceDurationMinutes: options.originalDurationMinutes,
      servicePriceFromCzk: 1200,
      scheduledStartsAt: startsAt,
      scheduledEndsAt: bookingEndsAt,
      blockedUntil: bookingEndsAt,
    },
    select: { id: true, updatedAt: true },
  });

  return {
    localDate,
    startsAt,
    bookingEndsAt,
    owner,
    category,
    originalService,
    replacementService,
    slot: bookingSlot,
    booking,
    async cleanup() {
      const serviceIds = [originalService.id, replacementService.id];
      const slotIds = slots.map((slot) => slot.id);
      await prisma.bookingActionToken.deleteMany({ where: { booking: { serviceId: { in: serviceIds } } } });
      await prisma.emailLog.deleteMany({ where: { booking: { serviceId: { in: serviceIds } } } });
      await prisma.bookingStatusHistory.deleteMany({ where: { booking: { serviceId: { in: serviceIds } } } });
      await prisma.booking.deleteMany({ where: { serviceId: { in: serviceIds } } });
      await prisma.client.deleteMany({ where: { id: client.id } });
      await prisma.availabilitySlot.deleteMany({ where: { id: { in: slotIds } } });
      if (autoLunchOverrideCreated) {
        await prisma.autoLunchDayOverride.deleteMany({
          where: { dateKey: localDate, updatedByUserId: owner.id },
        });
      }
      await prisma.siteSettings.update({
        where: { id: "site-settings" },
        data: { autoLunchEnabled: siteSettings.autoLunchEnabled },
      });
      await prisma.service.deleteMany({ where: { id: { in: serviceIds } } });
      await prisma.serviceCategory.deleteMany({ where: { id: category.id } });
      await prisma.adminUser.deleteMany({ where: { id: owner.id } });
    },
  };
}

async function createAdminCancellationFixture(
  prisma: Awaited<typeof import("@/lib/prisma")>["prisma"],
  suffix: string,
  email: string | null,
  snapshotEmail = email,
) {
  const { startsAt, endsAt } = await findIsolatedAdminWindow(prisma, suffix, 60);
  const owner = await prisma.adminUser.create({
    data: {
      email: `owner-admin-cancellation-${suffix}@example.com`,
      name: `Owner cancellation ${suffix}`,
      role: "OWNER",
      isActive: true,
    },
    select: { id: true },
  });
  const category = await prisma.serviceCategory.create({
    data: {
      name: `Kategorie admin cancellation ${suffix}`,
      slug: `kategorie-admin-cancellation-${suffix}`,
      isActive: true,
    },
    select: { id: true },
  });
  const service = await prisma.service.create({
    data: {
      categoryId: category.id,
      name: `Služba admin cancellation ${suffix}`,
      slug: `sluzba-admin-cancellation-${suffix}`,
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
      status: AvailabilitySlotStatus.PUBLISHED,
      capacity: 1,
    },
    select: { id: true },
  });
  const client = await prisma.client.create({
    data: {
      fullName: `Klientka admin cancellation ${suffix}`,
      email,
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
      status: BookingStatus.CONFIRMED,
      source: BookingSource.PHONE,
      clientNameSnapshot: `Klientka admin cancellation ${suffix}`,
      clientEmailSnapshot: snapshotEmail ?? "",
      clientPhoneSnapshot: "+420777123456",
      serviceNameSnapshot: `Služba admin cancellation ${suffix}`,
      serviceDurationMinutes: 60,
      servicePriceFromCzk: 1200,
      scheduledStartsAt: startsAt,
      scheduledEndsAt: endsAt,
    },
    select: { id: true },
  });

  return {
    owner,
    client,
    booking,
    slot,
    service,
    category,
    async cleanup() {
      await prisma.bookingActionToken.deleteMany({ where: { bookingId: booking.id } });
      await prisma.emailLog.deleteMany({ where: { bookingId: booking.id } });
      await prisma.bookingStatusHistory.deleteMany({ where: { bookingId: booking.id } });
      await prisma.booking.deleteMany({ where: { id: booking.id } });
      await prisma.client.deleteMany({ where: { id: client.id } });
      await prisma.availabilitySlot.deleteMany({ where: { id: slot.id } });
      await prisma.service.deleteMany({ where: { id: service.id } });
      await prisma.serviceCategory.deleteMany({ where: { id: category.id } });
      await prisma.adminUser.deleteMany({ where: { id: owner.id } });
    },
  };
}

dbTest("applyAdminBookingStatusChange confirms pending booking and writes side effects", async () => {
  const [{ prisma }, { applyAdminBookingStatusChange }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-booking"),
  ]);

  const suffix = randomUUID().slice(0, 8);
  const { startsAt, endsAt } = await findIsolatedAdminWindow(prisma, suffix, 60);
  const confirmationNow = new Date(startsAt.getTime() - 24 * 60 * 60 * 1000);

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
      notifyClient: true,
      reason: "Integration confirmation",
      internalNote: "Potvrzeno z integračního testu",
      now: confirmationNow,
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

    assert.equal(actionTokens.length, 4);
    assert.equal(actionTokens.filter((token) => token.type === BookingActionTokenType.RESCHEDULE).length, 2);
    assert.equal(actionTokens.filter((token) => token.type === BookingActionTokenType.CANCEL).length, 2);
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
    assert.equal(await prisma.emailLog.count({
      where: {
        bookingId: booking.id,
        type: EmailLogType.BOOKING_REMINDER,
      },
    }), 1);
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

dbTest("applyAdminBookingStatusChange serverově odmítne předčasné no-show a po grace period uvolní availability", async () => {
  const [{ prisma }, { applyAdminBookingStatusChange }, { getBookingAvailabilityCatalog }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-booking"),
    import("@/features/booking/lib/booking-availability-core"),
  ]);
  const suffix = randomUUID().slice(0, 8);
  const { startsAt, endsAt } = await findIsolatedAdminWindow(prisma, suffix, 60);

  const [owner, category, client] = await Promise.all([
    prisma.adminUser.create({ data: { email: `owner-no-show-${suffix}@example.com`, name: `Owner ${suffix}`, role: "OWNER", isActive: true }, select: { id: true } }),
    prisma.serviceCategory.create({ data: { name: `Kategorie no-show ${suffix}`, slug: `kategorie-no-show-${suffix}`, isActive: true }, select: { id: true } }),
    prisma.client.create({ data: { fullName: `Klientka no-show ${suffix}`, email: `client-no-show-${suffix}@example.com`, phone: "+420777123456", isActive: true }, select: { id: true } }),
  ]);
  const service = await prisma.service.create({
    data: { categoryId: category.id, name: `Služba no-show ${suffix}`, slug: `sluzba-no-show-${suffix}`, durationMinutes: 60, priceFromCzk: 1200, isActive: true, isPubliclyBookable: true },
    select: { id: true },
  });
  const slot = await prisma.availabilitySlot.create({
    data: { startsAt, endsAt, status: "PUBLISHED", capacity: 1 },
    select: { id: true },
  });
  const booking = await prisma.booking.create({
    data: {
      clientId: client.id, slotId: slot.id, serviceId: service.id, status: BookingStatus.CONFIRMED, source: "WEB",
      clientNameSnapshot: `Klientka no-show ${suffix}`, clientEmailSnapshot: `client-no-show-${suffix}@example.com`, clientPhoneSnapshot: "+420777123456",
      serviceNameSnapshot: `Služba no-show ${suffix}`, serviceDurationMinutes: 60, servicePriceFromCzk: 1200,
      scheduledStartsAt: startsAt, scheduledEndsAt: endsAt,
    },
    select: { id: true },
  });
  const getAvailability = () => getBookingAvailabilityCatalog({
    includeServices: false,
    bookingWindowStart: startsAt,
    bookingWindowEnd: endsAt,
    availabilitySlotStatus: "PUBLISHED",
    serviceWhere: { id: service.id },
  });

  try {
    const earlyResult = await applyAdminBookingStatusChange({
      bookingId: booking.id, targetStatus: BookingStatus.NO_SHOW, actorUserId: owner.id,
      notifyClient: false,
      now: new Date(startsAt.getTime() - 16 * 60 * 1000),
    });
    assert.equal(earlyResult.status, "no-show-too-early");
    assert.equal((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id }, select: { status: true } })).status, BookingStatus.CONFIRMED);
    assert.equal((await getAvailability()).scheduleOptimization.bookedIntervals.length, 1);

    const noShowAt = new Date(startsAt.getTime() + 15 * 60 * 1000);
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        clientDeliveryLeaseToken: "no-show-worker",
        clientDeliveryLeaseExpiresAt: new Date(noShowAt.getTime() + 60 * 1000),
      },
    });

    const blockedByDeliveryLease = await applyAdminBookingStatusChange({
      bookingId: booking.id, targetStatus: BookingStatus.NO_SHOW, actorUserId: owner.id,
      notifyClient: false,
      now: noShowAt,
    });
    assert.equal(blockedByDeliveryLease.status, "concurrent-modification");
    assert.deepEqual(
      await prisma.booking.findUniqueOrThrow({
        where: { id: booking.id },
        select: { status: true, communicationGeneration: true },
      }),
      { status: BookingStatus.CONFIRMED, communicationGeneration: 1 },
    );

    await prisma.booking.update({
      where: { id: booking.id },
      data: { clientDeliveryLeaseExpiresAt: new Date(0) },
    });

    const validResult = await applyAdminBookingStatusChange({
      bookingId: booking.id, targetStatus: BookingStatus.NO_SHOW, actorUserId: owner.id,
      notifyClient: false,
      now: noShowAt,
    });
    assert.equal(validResult.status, "success");
    assert.deepEqual(
      await prisma.booking.findUniqueOrThrow({
        where: { id: booking.id },
        select: { status: true, communicationGeneration: true },
      }),
      { status: BookingStatus.NO_SHOW, communicationGeneration: 2 },
    );
    assert.equal((await getAvailability()).scheduleOptimization.bookedIntervals.length, 0);
    assert.equal(await prisma.bookingStatusHistory.count({ where: { bookingId: booking.id, status: BookingStatus.NO_SHOW } }), 1);
  } finally {
    await prisma.bookingStatusHistory.deleteMany({ where: { bookingId: booking.id } });
    await prisma.booking.deleteMany({ where: { id: booking.id } });
    await prisma.client.deleteMany({ where: { id: client.id } });
    await prisma.availabilitySlot.deleteMany({ where: { id: slot.id } });
    await prisma.service.deleteMany({ where: { id: service.id } });
    await prisma.serviceCategory.deleteMany({ where: { id: category.id } });
    await prisma.adminUser.deleteMany({ where: { id: owner.id } });
  }
});

dbTest("applyAdminBookingStatusChange restores only the cancelled slot and keeps later availability", async () => {
  const [{ prisma }, { applyAdminBookingStatusChange }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-booking"),
  ]);

  const suffix = randomUUID().slice(0, 8);
  const { startsAt: baseStartAt } = await findIsolatedAdminWindow(prisma, suffix, 120);
  const beforeEndsAt = new Date(baseStartAt.getTime() + 30 * 60 * 1000);
  const bookingEndsAt = new Date(baseStartAt.getTime() + 105 * 60 * 1000);
  const fullEndsAt = new Date(baseStartAt.getTime() + 120 * 60 * 1000);

  const owner = await prisma.adminUser.create({
    data: {
      email: `owner-booking-cancel-${suffix}@example.com`,
      name: `Owner Cancel ${suffix}`,
      role: "OWNER",
      isActive: true,
    },
    select: { id: true },
  });

  const category = await prisma.serviceCategory.create({
    data: {
      name: `Kategorie cancel ${suffix}`,
      slug: `kategorie-cancel-${suffix}`,
      isActive: true,
    },
    select: { id: true },
  });

  const service = await prisma.service.create({
    data: {
      categoryId: category.id,
      name: `Služba cancel ${suffix}`,
      slug: `sluzba-cancel-${suffix}`,
      durationMinutes: 75,
      priceFromCzk: 1200,
      isActive: true,
      isPubliclyBookable: true,
    },
    select: { id: true },
  });

  const [, bookedSlot] = await prisma.$transaction([
    prisma.availabilitySlot.create({
      data: {
        startsAt: baseStartAt,
        endsAt: beforeEndsAt,
        status: "PUBLISHED",
        capacity: 1,
        serviceRestrictionMode: "ANY",
        publishedAt: new Date(baseStartAt.getTime() - 24 * 60 * 60 * 1000),
        createdByUserId: owner.id,
      },
      select: { id: true },
    }),
    prisma.availabilitySlot.create({
      data: {
        startsAt: beforeEndsAt,
        endsAt: bookingEndsAt,
        status: "ARCHIVED",
        capacity: 1,
        serviceRestrictionMode: "ANY",
        publishedAt: new Date(baseStartAt.getTime() - 24 * 60 * 60 * 1000),
        createdByUserId: owner.id,
      },
      select: { id: true },
    }),
    prisma.availabilitySlot.create({
      data: {
        startsAt: bookingEndsAt,
        endsAt: fullEndsAt,
        status: "PUBLISHED",
        capacity: 1,
        serviceRestrictionMode: "ANY",
        publishedAt: new Date(baseStartAt.getTime() - 24 * 60 * 60 * 1000),
        createdByUserId: owner.id,
      },
      select: { id: true },
    }),
  ]);

  const client = await prisma.client.create({
    data: {
      fullName: `Klientka cancel ${suffix}`,
      email: `client-booking-cancel-${suffix}@example.com`,
      phone: "+420777123456",
      isActive: true,
    },
    select: { id: true },
  });

  const booking = await prisma.booking.create({
    data: {
      clientId: client.id,
      slotId: bookedSlot.id,
      serviceId: service.id,
      status: BookingStatus.CONFIRMED,
      source: "WEB",
      clientNameSnapshot: `Klientka cancel ${suffix}`,
      clientEmailSnapshot: `client-booking-cancel-${suffix}@example.com`,
      clientPhoneSnapshot: "+420777123456",
      serviceNameSnapshot: `Služba cancel ${suffix}`,
      serviceDurationMinutes: 75,
      servicePriceFromCzk: 1200,
      scheduledStartsAt: beforeEndsAt,
      scheduledEndsAt: bookingEndsAt,
      originalAvailabilityEndsAt: fullEndsAt,
      manualOverride: true,
    },
    select: { id: true },
  });

  try {
    await prisma.bookingActionToken.createMany({
      data: [
        {
          bookingId: booking.id,
          type: BookingActionTokenType.CANCEL,
          tokenHash: `admin-cancel-token-${suffix}`,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
        {
          bookingId: booking.id,
          type: BookingActionTokenType.RESCHEDULE,
          tokenHash: `admin-reschedule-token-${suffix}`,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      ],
    });

    const result = await applyAdminBookingStatusChange({
      bookingId: booking.id,
      targetStatus: BookingStatus.CANCELLED,
      actorUserId: owner.id,
      notifyClient: true,
      reason: "Integration cancellation",
    });

    assert.equal(result.status, "success");

    const updatedBooking = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
      select: {
        status: true,
        slotId: true,
        cancelledAt: true,
      },
    });

    assert.equal(updatedBooking.status, BookingStatus.CANCELLED);
    assert.ok(updatedBooking.cancelledAt);
    assert.equal(updatedBooking.slotId, bookedSlot.id);

    const slots = await prisma.availabilitySlot.findMany({
      where: {
        createdByUserId: owner.id,
      },
      orderBy: {
        startsAt: "asc",
      },
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
          startsAt: baseStartAt.toISOString(),
          endsAt: beforeEndsAt.toISOString(),
          status: "PUBLISHED",
        },
        {
          startsAt: beforeEndsAt.toISOString(),
          endsAt: bookingEndsAt.toISOString(),
          status: "PUBLISHED",
        },
        {
          startsAt: bookingEndsAt.toISOString(),
          endsAt: fullEndsAt.toISOString(),
          status: "PUBLISHED",
        },
      ],
    );

    const [emailLogs, actionTokens] = await Promise.all([
      prisma.emailLog.findMany({
        where: {
          bookingId: booking.id,
          type: EmailLogType.BOOKING_CANCELLED,
        },
        select: {
          audience: true,
          recipientEmail: true,
          templateKey: true,
        },
      }),
      prisma.bookingActionToken.findMany({
        where: { bookingId: booking.id },
        select: { revokedAt: true },
      }),
    ]);

    assert.deepEqual(emailLogs, [{
      audience: EmailAudience.CLIENT,
      recipientEmail: `client-booking-cancel-${suffix}@example.com`,
      templateKey: "booking-cancelled-v1",
    }]);
    assert.equal(actionTokens.length, 2);
    assert.ok(actionTokens.every((token) => token.revokedAt));

    const retry = await applyAdminBookingStatusChange({
      bookingId: booking.id,
      targetStatus: BookingStatus.CANCELLED,
      actorUserId: owner.id,
      notifyClient: true,
    });
    assert.equal(retry.status, "invalid-transition");
    assert.equal(
      await prisma.emailLog.count({
        where: {
          bookingId: booking.id,
          type: EmailLogType.BOOKING_CANCELLED,
          audience: EmailAudience.CLIENT,
        },
      }),
      1,
    );
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
      where: { createdByUserId: owner.id },
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

dbTest("admin cancellation with notifyClient=false does not create a client email log", async () => {
  const [{ prisma }, { applyAdminBookingStatusChange }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-booking"),
  ]);
  const fixture = await createAdminCancellationFixture(
    prisma,
    randomUUID().slice(0, 8),
    "client-without-notification@example.com",
  );

  try {
    const result = await applyAdminBookingStatusChange({
      bookingId: fixture.booking.id,
      targetStatus: BookingStatus.CANCELLED,
      actorUserId: fixture.owner.id,
      notifyClient: false,
    });

    assert.equal(result.status, "success");
    assert.equal(
      await prisma.emailLog.count({
        where: {
          bookingId: fixture.booking.id,
          type: EmailLogType.BOOKING_CANCELLED,
          audience: EmailAudience.CLIENT,
        },
      }),
      0,
    );
  } finally {
    await fixture.cleanup();
  }
});

dbTest("admin cancellation posílá CLIENT e-mail na snapshot rezervace, ne na master kontakt", async () => {
  const [{ prisma }, { applyAdminBookingStatusChange }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-booking"),
  ]);
  const suffix = randomUUID().slice(0, 8);
  const fixture = await createAdminCancellationFixture(
    prisma,
    suffix,
    `master-cancellation-${suffix}@example.com`,
    `booking-cancellation-${suffix}@example.com`,
  );

  try {
    const result = await applyAdminBookingStatusChange({
      bookingId: fixture.booking.id,
      targetStatus: BookingStatus.CANCELLED,
      actorUserId: fixture.owner.id,
      notifyClient: true,
    });

    assert.equal(result.status, "success");
    const emailLog = await prisma.emailLog.findFirstOrThrow({
      where: {
        bookingId: fixture.booking.id,
        type: EmailLogType.BOOKING_CANCELLED,
        audience: EmailAudience.CLIENT,
      },
      select: { recipientEmail: true },
    });
    assert.equal(emailLog.recipientEmail, `booking-cancellation-${suffix}@example.com`);
  } finally {
    await fixture.cleanup();
  }
});

dbTest("admin cancellation without a client email succeeds without a client email log", async () => {
  const [{ prisma }, { applyAdminBookingStatusChange }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-booking"),
  ]);
  const fixture = await createAdminCancellationFixture(
    prisma,
    randomUUID().slice(0, 8),
    null,
  );

  try {
    const result = await applyAdminBookingStatusChange({
      bookingId: fixture.booking.id,
      targetStatus: BookingStatus.CANCELLED,
      actorUserId: fixture.owner.id,
      notifyClient: true,
    });

    assert.equal(result.status, "success");
    assert.equal(
      await prisma.emailLog.count({
        where: {
          bookingId: fixture.booking.id,
          type: EmailLogType.BOOKING_CANCELLED,
          audience: EmailAudience.CLIENT,
        },
      }),
      0,
    );
    assert.equal(
      (await prisma.booking.findUniqueOrThrow({
        where: { id: fixture.booking.id },
        select: { status: true },
      })).status,
      BookingStatus.CANCELLED,
    );
  } finally {
    await fixture.cleanup();
  }
});

dbTest("applyAdminBookingStatusChange archives only its orphaned manual-override DRAFT slot", async () => {
  const [{ prisma }, { applyAdminBookingStatusChange }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-booking"),
  ]);

  const suffix = randomUUID().slice(0, 8);
  const { startsAt, endsAt } = await findIsolatedAdminWindow(prisma, suffix, 60);
  const owner = await prisma.adminUser.create({
    data: { email: `owner-override-cancel-${suffix}@example.com`, name: `Owner ${suffix}`, role: "OWNER", isActive: true },
    select: { id: true },
  });
  const category = await prisma.serviceCategory.create({
    data: { name: `Kategorie override ${suffix}`, slug: `kategorie-override-${suffix}`, isActive: true },
    select: { id: true },
  });
  const service = await prisma.service.create({
    data: {
      categoryId: category.id, name: `Služba override ${suffix}`, slug: `sluzba-override-${suffix}`,
      durationMinutes: 60, priceFromCzk: 1200, isActive: true, isPubliclyBookable: true,
    },
    select: { id: true },
  });
  const client = await prisma.client.create({
    data: { fullName: `Klientka override ${suffix}`, email: `override-${suffix}@example.com`, phone: "+420777123456", isActive: true },
    select: { id: true },
  });
  const manualOverrideSlot = await prisma.availabilitySlot.create({
    data: {
      startsAt, endsAt, capacity: 1, status: "DRAFT", serviceRestrictionMode: "ANY",
      internalNote: "Dočasná ruční výjimka", createdByUserId: owner.id,
    },
    select: { id: true },
  });
  const archivedOriginalSlot = await prisma.availabilitySlot.create({
    data: {
      startsAt, endsAt, capacity: 1, status: "ARCHIVED", serviceRestrictionMode: "ANY",
      createdByUserId: owner.id,
    },
    select: { id: true },
  });
  const adminDraftSlot = await prisma.availabilitySlot.create({
    data: {
      startsAt: new Date(endsAt.getTime() + 60 * 60 * 1000),
      endsAt: new Date(endsAt.getTime() + 2 * 60 * 60 * 1000),
      capacity: 1, status: "DRAFT", serviceRestrictionMode: "ANY",
      internalNote: "Skutečná administrativní blokace", createdByUserId: owner.id,
    },
    select: { id: true },
  });
  const booking = await prisma.booking.create({
    data: {
      clientId: client.id, slotId: manualOverrideSlot.id, serviceId: service.id,
      status: BookingStatus.CONFIRMED, source: "PHONE", manualOverride: true,
      clientNameSnapshot: `Klientka override ${suffix}`, clientEmailSnapshot: `override-${suffix}@example.com`,
      clientPhoneSnapshot: "+420777123456", serviceNameSnapshot: `Služba override ${suffix}`,
      serviceDurationMinutes: 60, servicePriceFromCzk: 1200, scheduledStartsAt: startsAt, scheduledEndsAt: endsAt,
    },
    select: { id: true },
  });

  try {
    const result = await applyAdminBookingStatusChange({
      bookingId: booking.id,
      targetStatus: BookingStatus.CANCELLED,
      actorUserId: owner.id,
      notifyClient: true,
      reason: "Integration manual override cancellation",
    });

    assert.equal(result.status, "success");
    const [updatedBooking, manualOverrideSlotAfterCancellation, archivedOriginalSlotAfterCancellation, adminDraftSlotAfterCancellation] = await Promise.all([
      prisma.booking.findUniqueOrThrow({ where: { id: booking.id }, select: { status: true } }),
      prisma.availabilitySlot.findUniqueOrThrow({ where: { id: manualOverrideSlot.id }, select: { status: true } }),
      prisma.availabilitySlot.findUniqueOrThrow({ where: { id: archivedOriginalSlot.id }, select: { status: true } }),
      prisma.availabilitySlot.findUniqueOrThrow({ where: { id: adminDraftSlot.id }, select: { status: true } }),
    ]);

    assert.equal(updatedBooking.status, BookingStatus.CANCELLED);
    assert.equal(manualOverrideSlotAfterCancellation.status, "ARCHIVED");
    assert.equal(archivedOriginalSlotAfterCancellation.status, "ARCHIVED");
    assert.equal(adminDraftSlotAfterCancellation.status, "DRAFT");
  } finally {
    await prisma.bookingStatusHistory.deleteMany({ where: { bookingId: booking.id } });
    await prisma.booking.deleteMany({ where: { id: booking.id } });
    await prisma.client.deleteMany({ where: { id: client.id } });
    await prisma.availabilitySlot.deleteMany({ where: { id: { in: [manualOverrideSlot.id, archivedOriginalSlot.id, adminDraftSlot.id] } } });
    await prisma.service.deleteMany({ where: { id: service.id } });
    await prisma.serviceCategory.deleteMany({ where: { id: category.id } });
    await prisma.adminUser.deleteMany({ where: { id: owner.id } });
  }
});

dbTest("updateAdminBookingService rewrites booking snapshot and audit history", async () => {
  const [{ prisma }, { updateAdminBookingService }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-booking"),
  ]);

  const suffix = randomUUID().slice(0, 8);
  const { startsAt, endsAt } = await findIsolatedAdminWindow(prisma, suffix, 60);
  const expectedServiceEndsAt = new Date(startsAt.getTime() + 45 * 60 * 1000);

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
        manualOverride: true,
        serviceId: true,
        serviceNameSnapshot: true,
        serviceDurationMinutes: true,
        cleanupMinutes: true,
        cleanupBlockMinutes: true,
        servicePriceFromCzk: true,
        scheduledEndsAt: true,
        blockedUntil: true,
        reminder24hQueuedAt: true,
        reminder24hSentAt: true,
      },
    });

    assert.ok(updatedBooking);
    assert.equal(updatedBooking.manualOverride, false);
    assert.equal(updatedBooking.serviceId, replacementService.id);
    assert.equal(updatedBooking.serviceNameSnapshot, `Nová služba ${suffix}`);
    assert.equal(updatedBooking.serviceDurationMinutes, 45);
    assert.equal(updatedBooking.cleanupMinutes, 10);
    assert.equal(updatedBooking.cleanupBlockMinutes, 15);
    assert.equal(updatedBooking.servicePriceFromCzk, 1500);
    assert.equal(updatedBooking.scheduledEndsAt.toISOString(), expectedServiceEndsAt.toISOString());
    assert.equal(updatedBooking.blockedUntil?.toISOString(), endsAt.toISOString());
    assert.equal(updatedBooking.reminder24hQueuedAt, null);
    assert.equal(updatedBooking.reminder24hSentAt, null);

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

dbTest("updateAdminBookingService resetuje neodeslaný reminder a scheduler založí reminder pro novou službu", async () => {
  const [{ prisma }, { updateAdminBookingService }, { runBookingReminderSchedulerOnce }, { claimEmailLogForImmediateDelivery, deliverEmailLog }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-booking"),
    import("@/lib/email/worker"),
    import("@/lib/email/delivery"),
  ]);

  const suffix = randomUUID().slice(0, 8);
  const fixture = await createAdminServiceChangeFixture(prisma, suffix, { isolateReminderScan: true });
  const queuedAt = new Date(fixture.startsAt.getTime() - 26 * 60 * 60 * 1000);
  const oldReminder = await prisma.emailLog.create({
    data: {
      bookingId: fixture.booking.id,
      type: EmailLogType.BOOKING_REMINDER,
      audience: EmailAudience.CLIENT,
      status: EmailLogStatus.PENDING,
      recipientEmail: `client-service-change-${suffix}@example.com`,
      subject: "Zítra se na vás těšíme v PP Studiu",
      templateKey: "booking-reminder-24h-v1",
      payload: {
        bookingId: fixture.booking.id,
        serviceId: fixture.originalService.id,
        serviceName: `Původní změna služby ${suffix}`,
        clientName: `Klientka změny služby ${suffix}`,
        scheduledStartsAt: fixture.startsAt.toISOString(),
        scheduledEndsAt: fixture.bookingEndsAt.toISOString(),
      },
      nextAttemptAt: new Date(0),
    },
    select: { id: true },
  });

  try {
    const queuedBooking = await prisma.booking.update({
      where: { id: fixture.booking.id },
      data: { reminder24hQueuedAt: queuedAt, reminder24hSentAt: null },
      select: { updatedAt: true },
    });
    const result = await updateAdminBookingService({
      bookingId: fixture.booking.id,
      serviceId: fixture.replacementService.id,
      actorUserId: fixture.owner.id,
      expectedUpdatedAt: queuedBooking.updatedAt.toISOString(),
    });

    assert.equal(result.status, "success");

    const afterChange = await prisma.booking.findUniqueOrThrow({
      where: { id: fixture.booking.id },
      select: { serviceId: true, reminder24hQueuedAt: true, reminder24hSentAt: true },
    });
    assert.equal(afterChange.serviceId, fixture.replacementService.id);
    assert.equal(afterChange.reminder24hQueuedAt, null);
    assert.equal(afterChange.reminder24hSentAt, null);

    const oldClaim = await claimEmailLogForImmediateDelivery(oldReminder.id);
    assert.ok(oldClaim);
    assert.deepEqual(await deliverEmailLog(oldReminder.id, oldClaim), {
      status: "skipped",
      errorMessage: "Booking service no longer matches the email.",
    });
    const skippedOldReminder = await prisma.emailLog.findUniqueOrThrow({
      where: { id: oldReminder.id },
      select: { status: true, provider: true },
    });
    assert.equal(skippedOldReminder.status, EmailLogStatus.SENT);
    assert.equal(skippedOldReminder.provider, "system-skip");

    const schedulerResult = await runBookingReminderSchedulerOnce(
      new Date(fixture.startsAt.getTime() - (25.5 * 60 * 60 * 1000)),
    );
    assert.deepEqual(schedulerResult, { foundBookings: 1, enqueued: 1, failed: 0 });

    const reminderLogs = await prisma.emailLog.findMany({
      where: { bookingId: fixture.booking.id, type: EmailLogType.BOOKING_REMINDER },
      orderBy: { createdAt: "asc" },
      select: { id: true, payload: true, provider: true },
    });
    assert.equal(reminderLogs.length, 2);
    const newReminder = reminderLogs.find((log) => log.id !== oldReminder.id);
    assert.ok(newReminder);
    assert.equal((newReminder.payload as Record<string, unknown>).serviceId, fixture.replacementService.id);
    assert.equal(newReminder.provider, "log");

    const finalBooking = await prisma.booking.findUniqueOrThrow({
      where: { id: fixture.booking.id },
      select: { reminder24hQueuedAt: true, reminder24hSentAt: true },
    });
    assert.ok(finalBooking.reminder24hQueuedAt);
    assert.ok(finalBooking.reminder24hSentAt);
  } finally {
    await fixture.cleanup();
  }
});

dbTest("updateAdminBookingService po opuštění enqueue window vytvoří replacement reminder pro novou službu", async () => {
  const [{ prisma }, { updateAdminBookingService }, { claimEmailLogForImmediateDelivery, deliverEmailLog }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-booking"),
    import("@/lib/email/delivery"),
  ]);

  const suffix = randomUUID().slice(0, 8);
  const fixture = await createAdminServiceChangeFixture(prisma, suffix);
  const now = new Date(fixture.startsAt.getTime() - 24.5 * 60 * 60 * 1000);
  const oldReminder = await prisma.emailLog.create({
    data: {
      bookingId: fixture.booking.id,
      type: EmailLogType.BOOKING_REMINDER,
      audience: EmailAudience.CLIENT,
      status: EmailLogStatus.PENDING,
      recipientEmail: `client-service-change-${suffix}@example.com`,
      subject: "Zítra se na vás těšíme v PP Studiu",
      templateKey: "booking-reminder-24h-v1",
      payload: {
        bookingId: fixture.booking.id,
        serviceId: fixture.originalService.id,
        serviceName: `Původní změna služby ${suffix}`,
        clientName: `Klientka změny služby ${suffix}`,
        scheduledStartsAt: fixture.startsAt.toISOString(),
        scheduledEndsAt: fixture.bookingEndsAt.toISOString(),
      },
      nextAttemptAt: new Date(0),
    },
    select: { id: true },
  });

  try {
    const queuedBooking = await prisma.booking.update({
      where: { id: fixture.booking.id },
      data: {
        reminder24hQueuedAt: new Date(now.getTime() - 60 * 60 * 1000),
        reminder24hSentAt: null,
      },
      select: { updatedAt: true },
    });
    const result = await updateAdminBookingService({
      bookingId: fixture.booking.id,
      serviceId: fixture.replacementService.id,
      actorUserId: fixture.owner.id,
      expectedUpdatedAt: queuedBooking.updatedAt.toISOString(),
      now,
    });

    assert.equal(result.status, "success");

    const oldClaim = await claimEmailLogForImmediateDelivery(oldReminder.id);
    assert.ok(oldClaim);
    assert.deepEqual(await deliverEmailLog(oldReminder.id, oldClaim), {
      status: "skipped",
      errorMessage: "Booking service no longer matches the email.",
    });

    const reminderLogs = await prisma.emailLog.findMany({
      where: { bookingId: fixture.booking.id, type: EmailLogType.BOOKING_REMINDER },
      orderBy: { createdAt: "asc" },
      select: { id: true, status: true, payload: true },
    });
    assert.equal(reminderLogs.length, 2);
    const replacement = reminderLogs.find((log) => log.id !== oldReminder.id);
    assert.ok(replacement);
    assert.equal(replacement.status, EmailLogStatus.SENT);
    assert.equal((replacement.payload as Record<string, unknown>).serviceId, fixture.replacementService.id);
  } finally {
    await fixture.cleanup();
  }
});

dbTest("updateAdminBookingService uvnitř enqueue window založí reminder okamžitě", async () => {
  const [{ prisma }, { updateAdminBookingService }, { runBookingReminderSchedulerOnce }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-booking"),
    import("@/lib/email/worker"),
  ]);

  const suffix = randomUUID().slice(0, 8);
  const fixture = await createAdminServiceChangeFixture(prisma, suffix, { isolateReminderScan: true });
  const now = new Date(fixture.startsAt.getTime() - 25.5 * 60 * 60 * 1000);

  try {
    const result = await updateAdminBookingService({
      bookingId: fixture.booking.id,
      serviceId: fixture.replacementService.id,
      actorUserId: fixture.owner.id,
      expectedUpdatedAt: fixture.booking.updatedAt.toISOString(),
      now,
    });

    assert.equal(result.status, "success");
    assert.equal(
      await prisma.emailLog.count({
        where: { bookingId: fixture.booking.id, type: EmailLogType.BOOKING_REMINDER },
      }),
      1,
    );

    const schedulerResult = await runBookingReminderSchedulerOnce(now);
    assert.deepEqual(schedulerResult, { foundBookings: 0, enqueued: 0, failed: 0 });

    const reminder = await prisma.emailLog.findFirstOrThrow({
      where: { bookingId: fixture.booking.id, type: EmailLogType.BOOKING_REMINDER },
      select: { payload: true },
    });
    assert.equal((reminder.payload as Record<string, unknown>).serviceId, fixture.replacementService.id);
  } finally {
    await fixture.cleanup();
  }
});

dbTest("enqueue helper nereplikuje aktuální PENDING reminder", async () => {
  const [{ prisma }, { enqueueBookingReminder24hForBooking }] = await Promise.all([
    import("@/lib/prisma"),
    import("@/features/booking/lib/booking-reminders"),
  ]);

  const suffix = randomUUID().slice(0, 8);
  const fixture = await createAdminServiceChangeFixture(prisma, suffix);
  const now = new Date(fixture.startsAt.getTime() - 60 * 60 * 1000);
  await prisma.emailLog.create({
    data: {
      bookingId: fixture.booking.id,
      clientId: fixture.client.id,
      type: EmailLogType.BOOKING_REMINDER,
      audience: EmailAudience.CLIENT,
      status: EmailLogStatus.PENDING,
      recipientEmail: `client-service-change-${suffix}@example.com`,
      subject: "Zítra se na vás těšíme v PP Studiu",
      templateKey: "booking-reminder-24h-v1",
      payload: {
        bookingId: fixture.booking.id,
        serviceId: fixture.originalService.id,
        scheduledStartsAt: fixture.startsAt.toISOString(),
        scheduledEndsAt: fixture.bookingEndsAt.toISOString(),
      },
      nextAttemptAt: now,
    },
  });

  try {
    const result = await prisma.$transaction((tx) => enqueueBookingReminder24hForBooking(tx, {
      id: fixture.booking.id,
      clientId: fixture.client.id,
      clientEmailSnapshot: `client-service-change-${suffix}@example.com`,
      communicationGeneration: 1,
      clientNameSnapshot: `Klientka změny služby ${suffix}`,
      status: BookingStatus.CONFIRMED,
      serviceId: fixture.originalService.id,
      serviceNameSnapshot: `Původní změna služby ${suffix}`,
      scheduledStartsAt: fixture.startsAt,
      scheduledEndsAt: fixture.bookingEndsAt,
    }, now));

    assert.deepEqual(result, {
      created: false,
      reason: "Current booking reminder is already pending.",
    });
    assert.equal(
      await prisma.emailLog.count({
        where: { bookingId: fixture.booking.id, type: EmailLogType.BOOKING_REMINDER },
      }),
      1,
    );
  } finally {
    await fixture.cleanup();
  }
});

dbTest("updateAdminBookingService po začátku rezervace replacement reminder nevytvoří", async () => {
  const [{ prisma }, { updateAdminBookingService }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-booking"),
  ]);

  const suffix = randomUUID().slice(0, 8);
  const fixture = await createAdminServiceChangeFixture(prisma, suffix);
  const now = new Date(fixture.startsAt.getTime() + 60 * 60 * 1000);

  try {
    const result = await updateAdminBookingService({
      bookingId: fixture.booking.id,
      serviceId: fixture.replacementService.id,
      actorUserId: fixture.owner.id,
      expectedUpdatedAt: fixture.booking.updatedAt.toISOString(),
      now,
    });

    assert.equal(result.status, "success");
    assert.equal(
      await prisma.emailLog.count({
        where: { bookingId: fixture.booking.id, type: EmailLogType.BOOKING_REMINDER },
      }),
      0,
    );
  } finally {
    await fixture.cleanup();
  }
});

dbTest("updateAdminBookingService nemění stav již odeslaného reminderu", async () => {
  const [{ prisma }, { updateAdminBookingService }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-booking"),
  ]);

  const suffix = randomUUID().slice(0, 8);
  const fixture = await createAdminServiceChangeFixture(prisma, suffix);
  const queuedAt = new Date(fixture.startsAt.getTime() - 26 * 60 * 60 * 1000);
  const sentAt = new Date(fixture.startsAt.getTime() - 25 * 60 * 60 * 1000);

  try {
    const preparedBooking = await prisma.booking.update({
      where: { id: fixture.booking.id },
      data: { reminder24hQueuedAt: queuedAt, reminder24hSentAt: sentAt },
      select: { updatedAt: true },
    });
    const result = await updateAdminBookingService({
      bookingId: fixture.booking.id,
      serviceId: fixture.replacementService.id,
      actorUserId: fixture.owner.id,
      expectedUpdatedAt: preparedBooking.updatedAt.toISOString(),
    });

    assert.equal(result.status, "success");
    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: fixture.booking.id },
      select: { reminder24hQueuedAt: true, reminder24hSentAt: true },
    });
    assert.equal(booking.reminder24hQueuedAt?.toISOString(), queuedAt.toISOString());
    assert.equal(booking.reminder24hSentAt?.toISOString(), sentAt.toISOString());
  } finally {
    await fixture.cleanup();
  }
});

dbTest("rollback změny služby vrátí i reset neodeslaného reminderu", async () => {
  const [{ prisma }, { updateAdminBookingService }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-booking"),
  ]);

  const suffix = randomUUID().slice(0, 8);
  const fixture = await createAdminServiceChangeFixture(prisma, suffix);
  const queuedAt = new Date(fixture.startsAt.getTime() - 26 * 60 * 60 * 1000);

  try {
    const preparedBooking = await prisma.booking.update({
      where: { id: fixture.booking.id },
      data: { reminder24hQueuedAt: queuedAt, reminder24hSentAt: null },
      select: { updatedAt: true },
    });

    const originalTransaction = prisma.$transaction;
    Object.defineProperty(prisma, "$transaction", {
      configurable: true,
      writable: true,
      value: (...args: unknown[]) => {
        const operation = args[0] as (transaction: Prisma.TransactionClient) => Promise<unknown>;
        return Reflect.apply(originalTransaction, prisma, [
          async (transaction: Prisma.TransactionClient) => {
            await operation(transaction);
            throw new Error("forced service change rollback");
          },
          args[1],
        ]);
      },
    });

    try {
      await assert.rejects(
        updateAdminBookingService({
          bookingId: fixture.booking.id,
          serviceId: fixture.replacementService.id,
          actorUserId: fixture.owner.id,
          expectedUpdatedAt: preparedBooking.updatedAt.toISOString(),
        }),
        /forced service change rollback/,
      );
    } finally {
      Object.defineProperty(prisma, "$transaction", {
        configurable: true,
        writable: true,
        value: originalTransaction,
      });
    }

    assert.equal(typeof prisma.$transaction, "function");

    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: fixture.booking.id },
      select: { serviceId: true, reminder24hQueuedAt: true, reminder24hSentAt: true },
    });
    assert.equal(booking.serviceId, fixture.originalService.id);
    assert.equal(booking.reminder24hQueuedAt?.toISOString(), queuedAt.toISOString());
    assert.equal(booking.reminder24hSentAt, null);
  } finally {
    await fixture.cleanup();
  }
});

dbTest("updateAdminBookingService authoritativeně chrání automatický oběd", async () => {
  const [{ prisma }, { updateAdminBookingService }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-booking"),
  ]);
  const scenarios = [
    {
      name: "prodloužení se zachovaným obědem",
      originalDurationMinutes: 60,
      replacementDurationMinutes: 90,
      activeAutoLunch: true,
      expectedStatus: "success",
    },
    {
      name: "prodloužení odstraňující poslední oběd",
      originalDurationMinutes: 90,
      replacementDurationMinutes: 105,
      activeAutoLunch: true,
      expectedStatus: "slot-unavailable",
    },
    {
      name: "zkrácení služby",
      originalDurationMinutes: 105,
      replacementDurationMinutes: 60,
      activeAutoLunch: true,
      expectedStatus: "success",
    },
    {
      name: "den bez aktivního auto-lunch",
      originalDurationMinutes: 90,
      replacementDurationMinutes: 105,
      activeAutoLunch: false,
      expectedStatus: "success",
    },
  ] as const;

  for (const scenario of scenarios) {
    const fixture = await createAdminAutoLunchServiceChangeFixture(
      prisma,
      randomUUID().slice(0, 8),
      scenario,
    );

    try {
      const result = await updateAdminBookingService({
        bookingId: fixture.booking.id,
        serviceId: fixture.replacementService.id,
        actorUserId: fixture.owner.id,
        expectedUpdatedAt: fixture.booking.updatedAt.toISOString(),
      });

      assert.equal(result.status, scenario.expectedStatus, `Scénář ${scenario.name} má mít očekávaný výsledek.`);

      if (scenario.expectedStatus === "slot-unavailable") {
        const overrideResult = await updateAdminBookingService({
          bookingId: fixture.booking.id, serviceId: fixture.replacementService.id,
          actorUserId: fixture.owner.id, allowManualOverride: true,
        });
        assert.equal(overrideResult.status, "slot-unavailable", "Výjimka nesmí obejít automatický oběd.");
        const unchangedBooking = await prisma.booking.findUniqueOrThrow({
          where: { id: fixture.booking.id },
          select: { serviceId: true, scheduledEndsAt: true, blockedUntil: true },
        });
        assert.equal(unchangedBooking.serviceId, fixture.originalService.id);
        assert.equal(unchangedBooking.scheduledEndsAt.toISOString(), fixture.bookingEndsAt.toISOString());
        assert.equal(unchangedBooking.blockedUntil?.toISOString(), fixture.bookingEndsAt.toISOString());
      }
    } finally {
      await fixture.cleanup();
    }
  }
});

dbTest("updateAdminBookingService rozlišuje coverage služby, stale slot a skutečný manual override", async () => {
  const [{ prisma }, { updateAdminBookingService }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-booking"),
  ]);
  const scenarios = [
    "cleanup-overhang",
    "insufficient-coverage",
    "coverage-gap",
    "archived-slot-with-current-coverage",
    "archived-slot-without-current-coverage",
    "manual-override",
  ] as const;

  for (const scenario of scenarios) {
    const fixture = await createAdminServiceChangeFixture(prisma, randomUUID().slice(0, 8));

    try {
      switch (scenario) {
        case "cleanup-overhang":
          await Promise.all([
            prisma.service.update({
              where: { id: fixture.replacementService.id },
              data: { durationMinutes: 60, cleanupMinutes: 10 },
            }),
            prisma.availabilitySlot.update({
              where: { id: fixture.slot.id },
              data: { endsAt: fixture.bookingEndsAt },
            }),
          ]);
          break;
        case "insufficient-coverage":
          await prisma.availabilitySlot.update({
            where: { id: fixture.slot.id },
            data: { endsAt: fixture.bookingEndsAt },
          });
          break;
        case "coverage-gap":
          await Promise.all([
            prisma.service.update({
              where: { id: fixture.replacementService.id },
              data: { durationMinutes: 60 },
            }),
            prisma.availabilitySlot.update({
              where: { id: fixture.slot.id },
              data: { endsAt: new Date(fixture.startsAt.getTime() + 30 * 60 * 1000) },
            }),
          ]);
          await prisma.availabilitySlot.create({
            data: {
              startsAt: new Date(fixture.startsAt.getTime() + 45 * 60 * 1000),
              endsAt: fixture.bookingEndsAt,
              status: "PUBLISHED",
              capacity: 1,
              serviceRestrictionMode: "ANY",
            },
          });
          break;
        case "archived-slot-with-current-coverage":
          await prisma.availabilitySlot.update({
            where: { id: fixture.slot.id },
            data: { status: "ARCHIVED" },
          });
          await prisma.availabilitySlot.create({
            data: {
              startsAt: fixture.startsAt,
              endsAt: fixture.endsAt,
              status: "PUBLISHED",
              capacity: 1,
              serviceRestrictionMode: "ANY",
            },
          });
          break;
        case "archived-slot-without-current-coverage":
          await prisma.availabilitySlot.update({
            where: { id: fixture.slot.id },
            data: { status: "ARCHIVED" },
          });
          break;
        case "manual-override":
          await Promise.all([
            prisma.booking.update({
              where: { id: fixture.booking.id },
              data: { manualOverride: true },
            }),
            prisma.availabilitySlot.update({
              where: { id: fixture.slot.id },
              data: { status: "DRAFT" },
            }),
          ]);
          break;
      }

      const result = await updateAdminBookingService({
        bookingId: fixture.booking.id,
        serviceId: fixture.replacementService.id,
        actorUserId: fixture.owner.id,
      });

      const shouldSucceed = scenario === "cleanup-overhang"
        || scenario === "archived-slot-with-current-coverage"
        || scenario === "manual-override";
      assert.equal(
        result.status,
        shouldSucceed ? "success" : "slot-too-short",
        `Scénář ${scenario} musí ${shouldSucceed ? "projít" : "selhat na coverage"}.`,
      );
    } finally {
      await fixture.cleanup();
    }
  }
});

dbTest("updateAdminBookingService odmítne globální kolizi mimo původní slot", async () => {
  const [{ prisma }, { updateAdminBookingService }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-booking"),
  ]);
  const fixture = await createAdminServiceChangeFixture(prisma, randomUUID().slice(0, 8));
  const conflictingWindow = await findIsolatedAdminWindow(prisma, randomUUID().slice(0, 8), 60);
  // Slot nesmí kolidovat s původním slotem kvůli DB exclusion constraintě;
  // samotný booking záměrně používá čas překrývající nový termín rezervace.
  const conflictingSlot = await prisma.availabilitySlot.create({
    data: {
      startsAt: conflictingWindow.startsAt,
      endsAt: conflictingWindow.endsAt,
      status: "PUBLISHED",
      capacity: 1,
      serviceRestrictionMode: "ANY",
      publishedAt: new Date(conflictingWindow.startsAt.getTime() - 24 * 60 * 60 * 1000),
    },
    select: { id: true },
  });
  const conflictingClient = await prisma.client.create({
    data: {
      fullName: `Kolizní klientka ${fixture.booking.id}`,
      email: `conflict-service-change-${fixture.booking.id}@example.com`,
      phone: "+420777123457",
      isActive: true,
    },
    select: { id: true },
  });

  try {
    await prisma.booking.create({
      data: {
        clientId: conflictingClient.id,
        slotId: conflictingSlot.id,
        serviceId: fixture.originalService.id,
        status: BookingStatus.CONFIRMED,
        source: "WEB",
        clientNameSnapshot: "Kolizní klientka",
        clientEmailSnapshot: `conflict-service-change-${fixture.booking.id}@example.com`,
        serviceNameSnapshot: "Kolizní služba",
        serviceDurationMinutes: 60,
        servicePriceFromCzk: 1200,
        scheduledStartsAt: fixture.bookingEndsAt,
        scheduledEndsAt: fixture.endsAt,
        blockedUntil: fixture.endsAt,
      },
    });

    const result = await updateAdminBookingService({
      bookingId: fixture.booking.id,
      serviceId: fixture.replacementService.id,
      actorUserId: fixture.owner.id,
      expectedUpdatedAt: fixture.booking.updatedAt.toISOString(),
    });

    assert.equal(result.status, "conflict");
  } finally {
    await fixture.cleanup();
    await prisma.availabilitySlot.deleteMany({ where: { id: conflictingSlot.id } });
    await prisma.client.deleteMany({ where: { id: conflictingClient.id } });
  }
});

for (const allowManualOverride of [false, true]) {
  dbTest(`souběh změny služby a nové rezervace nikdy neuloží překrytí (výjimka ${allowManualOverride})`, async () => {
    const [{ prisma }, { updateAdminBookingService }, { createManualBooking, PublicBookingError, publicBookingErrorCodes }] = await Promise.all([
      import("@/lib/prisma"),
      import("./admin-booking"),
      import("@/features/booking/lib/booking-public"),
    ]);
    const fixture = await createAdminServiceChangeFixture(prisma, randomUUID().slice(0, 8));

    try {
      let targetSlotId = fixture.slot.id;
      if (allowManualOverride) {
        await prisma.availabilitySlot.update({ where: { id: fixture.slot.id }, data: { status: "ARCHIVED", endsAt: fixture.bookingEndsAt } });
        const targetSlot = await prisma.availabilitySlot.create({ data: {
          startsAt: fixture.bookingEndsAt, endsAt: fixture.endsAt, capacity: 1,
          status: "PUBLISHED", serviceRestrictionMode: "ANY", publishedAt: new Date(),
        } });
        targetSlotId = targetSlot.id;
      }
      const [serviceChange, newBooking] = await Promise.allSettled([
        updateAdminBookingService({
          allowManualOverride,
          bookingId: fixture.booking.id,
          serviceId: fixture.replacementService.id,
          actorUserId: fixture.owner.id,
          expectedUpdatedAt: fixture.booking.updatedAt.toISOString(),
        }),
        createManualBooking({
          serviceId: fixture.originalService.id,
          slotId: targetSlotId,
          allowManualOverride: false,
          startsAt: fixture.bookingEndsAt.toISOString(),
          fullName: `Souběžná klientka ${fixture.booking.id}`,
          email: `concurrent-service-change-${fixture.booking.id}@example.com`,
          phone: "+420777123458",
          source: BookingSource.PHONE,
          status: BookingStatus.CONFIRMED,
          actorUserId: fixture.owner.id,
          sendClientEmail: false,
          includeCalendarAttachment: false,
        }),
      ]);

      assert.equal(serviceChange.status, "fulfilled");
      if (serviceChange.status !== "fulfilled") return;

      if (serviceChange.value.status === "success") {
        assert.equal(newBooking.status, "rejected");
        if (newBooking.status === "rejected") {
          assert.ok(newBooking.reason instanceof PublicBookingError);
          // Pořadí serializovaných transakcí rozhoduje, zda odmítne
          // nedostupná nabídka, nebo kolize s nově prodlouženou rezervací.
          assert.ok(
            newBooking.reason.code === publicBookingErrorCodes.slotUnavailable
            || newBooking.reason.code === publicBookingErrorCodes.bookingConflict,
          );
        }
      } else {
        assert.equal(serviceChange.value.status, "conflict");
        assert.equal(newBooking.status, "fulfilled");
      }

      const activeBookings = await prisma.booking.findMany({
        where: {
          status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
          scheduledStartsAt: { gte: fixture.startsAt, lt: fixture.endsAt },
        },
        select: {
          id: true,
          scheduledStartsAt: true,
          scheduledEndsAt: true,
          blockedUntil: true,
        },
      });

      for (const [index, booking] of activeBookings.entries()) {
        for (const other of activeBookings.slice(index + 1)) {
          const bookingBlockedUntil = booking.blockedUntil ?? booking.scheduledEndsAt;
          const otherBlockedUntil = other.blockedUntil ?? other.scheduledEndsAt;
          assert.ok(
            booking.scheduledStartsAt >= otherBlockedUntil || other.scheduledStartsAt >= bookingBlockedUntil,
            `Aktivní bookingy ${booking.id} a ${other.id} se nesmí překrývat.`,
          );
        }
      }
    } finally {
      await fixture.cleanup();
    }
  });
}

dbTest("změna služby zkrátí manual DRAFT a obnoví původní PUBLISHED dostupnost", async () => {
  const [{ prisma }, { updateAdminBookingService, applyAdminBookingStatusChange }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-booking"),
  ]);
  const fixture = await createAdminManualOverrideResizeFixture(prisma, randomUUID().slice(0, 8));

  try {
    const shortening = await updateAdminBookingService({
      bookingId: fixture.booking.id,
      serviceId: fixture.shortService.id,
      actorUserId: fixture.owner.id,
      expectedUpdatedAt: fixture.booking.updatedAt.toISOString(),
    });

    assert.equal(shortening.status, "success");
    const shortenedSlots = await prisma.availabilitySlot.findMany({
      where: {
        status: { in: [AvailabilitySlotStatus.DRAFT, AvailabilitySlotStatus.PUBLISHED] },
        startsAt: { lt: fixture.originalAvailabilityEndsAt },
        endsAt: { gt: fixture.manualStartsAt },
      },
      orderBy: { startsAt: "asc" },
      select: { startsAt: true, endsAt: true, status: true },
    });
    assert.deepEqual(shortenedSlots.map((slot) => [slot.startsAt, slot.endsAt, slot.status]), [
      [fixture.manualStartsAt, new Date(fixture.manualStartsAt.getTime() + 30 * 60 * 1000), AvailabilitySlotStatus.DRAFT],
      [fixture.originalAvailabilityStartsAt, fixture.originalAvailabilityEndsAt, AvailabilitySlotStatus.PUBLISHED],
    ]);

    const extension = await updateAdminBookingService({
      bookingId: fixture.booking.id,
      serviceId: fixture.longService.id,
      actorUserId: fixture.owner.id,
    });

    assert.equal(extension.status, "success");
    const extendedSlots = await prisma.availabilitySlot.findMany({
      where: {
        status: { in: [AvailabilitySlotStatus.DRAFT, AvailabilitySlotStatus.PUBLISHED] },
        startsAt: { lt: fixture.originalAvailabilityEndsAt },
        endsAt: { gt: fixture.manualStartsAt },
      },
      orderBy: { startsAt: "asc" },
      select: { startsAt: true, endsAt: true, status: true },
    });
    assert.deepEqual(extendedSlots.map((slot) => [slot.startsAt, slot.endsAt, slot.status]), [
      [fixture.manualStartsAt, fixture.manualEndsAt, AvailabilitySlotStatus.DRAFT],
      [fixture.manualEndsAt, fixture.originalAvailabilityEndsAt, AvailabilitySlotStatus.PUBLISHED],
    ]);

    const cancellation = await applyAdminBookingStatusChange({
      bookingId: fixture.booking.id,
      targetStatus: BookingStatus.CANCELLED,
      actorUserId: fixture.owner.id,
      notifyClient: true,
      reason: "Manual override service resize regression",
    });

    assert.equal(cancellation.status, "success");
    const restoredSlots = await prisma.availabilitySlot.findMany({
      where: {
        status: { in: [AvailabilitySlotStatus.DRAFT, AvailabilitySlotStatus.PUBLISHED] },
        startsAt: { lt: fixture.originalAvailabilityEndsAt },
        endsAt: { gt: fixture.manualStartsAt },
      },
      select: { startsAt: true, endsAt: true, status: true },
    });
    assert.deepEqual(restoredSlots.map((slot) => [slot.startsAt, slot.endsAt, slot.status]), [
      [fixture.originalAvailabilityStartsAt, fixture.originalAvailabilityEndsAt, AvailabilitySlotStatus.PUBLISHED],
    ]);
    const allAvailableSlotsInRestorationWindow = await prisma.availabilitySlot.findMany({
      where: {
        startsAt: {
          gte: fixture.manualStartsAt,
          lt: new Date(fixture.originalAvailabilityEndsAt.getTime() + 60 * 60 * 1000),
        },
        endsAt: { gt: fixture.manualStartsAt },
        status: { in: [AvailabilitySlotStatus.DRAFT, AvailabilitySlotStatus.PUBLISHED] },
      },
      orderBy: { startsAt: "asc" },
      select: { startsAt: true, endsAt: true, status: true },
    });
    assert.deepEqual(allAvailableSlotsInRestorationWindow, [{
      startsAt: fixture.originalAvailabilityStartsAt,
      endsAt: fixture.originalAvailabilityEndsAt,
      status: AvailabilitySlotStatus.PUBLISHED,
    }]);
  } finally {
    await fixture.cleanup();
  }
});

dbTest("zkrácení cleanup blokace manual override obnoví PUBLISHED část", async () => {
  const [{ prisma }, { updateAdminBookingService }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-booking"),
  ]);
  const fixture = await createAdminManualOverrideResizeFixture(
    prisma,
    randomUUID().slice(0, 8),
    { originalDurationMinutes: 30, originalCleanupMinutes: 30 },
  );

  try {
    const result = await updateAdminBookingService({
      bookingId: fixture.booking.id,
      serviceId: fixture.shortService.id,
      actorUserId: fixture.owner.id,
    });

    assert.equal(result.status, "success");
    const updatedBooking = await prisma.booking.findUniqueOrThrow({
      where: { id: fixture.booking.id },
      select: { scheduledEndsAt: true, blockedUntil: true },
    });
    assert.equal(updatedBooking.scheduledEndsAt.toISOString(), new Date(fixture.manualStartsAt.getTime() + 30 * 60 * 1000).toISOString());
    assert.equal(updatedBooking.blockedUntil?.toISOString(), new Date(fixture.manualStartsAt.getTime() + 30 * 60 * 1000).toISOString());

    const publishedSlots = await prisma.availabilitySlot.findMany({
      where: {
        status: AvailabilitySlotStatus.PUBLISHED,
        startsAt: { lt: fixture.originalAvailabilityEndsAt },
        endsAt: { gt: fixture.manualStartsAt },
      },
      select: { startsAt: true, endsAt: true },
    });
    assert.deepEqual(publishedSlots.map((slot) => [slot.startsAt, slot.endsAt]), [
      [fixture.originalAvailabilityStartsAt, fixture.originalAvailabilityEndsAt],
    ]);
  } finally {
    await fixture.cleanup();
  }
});

dbTest("prodloužení manual override odmítne protected PUBLISHED overlap bez změny dat", async () => {
  const [{ prisma }, { updateAdminBookingService }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-booking"),
  ]);
  const fixture = await createAdminManualOverrideResizeFixture(
    prisma,
    randomUUID().slice(0, 8),
    { originalDurationMinutes: 30 },
  );
  await prisma.availabilitySlot.update({
    where: { id: fixture.rightPublishedSlot.id },
    data: { internalNote: "Protected service-change overlap" },
  });

  try {
    const result = await updateAdminBookingService({
      bookingId: fixture.booking.id,
      serviceId: fixture.longService.id,
      actorUserId: fixture.owner.id,
    });

    assert.equal(result.status, "conflict");
    const [booking, draftSlot, protectedSlot] = await Promise.all([
      prisma.booking.findUniqueOrThrow({
        where: { id: fixture.booking.id },
        select: { serviceId: true, blockedUntil: true },
      }),
      prisma.availabilitySlot.findUniqueOrThrow({
        where: { id: fixture.manualOverrideSlot.id },
        select: { startsAt: true, endsAt: true, status: true },
      }),
      prisma.availabilitySlot.findUniqueOrThrow({
        where: { id: fixture.rightPublishedSlot.id },
        select: { startsAt: true, endsAt: true, status: true, internalNote: true },
      }),
    ]);
    assert.equal(booking.serviceId, fixture.originalService.id);
    assert.equal(booking.blockedUntil?.toISOString(), fixture.manualEndsAt.toISOString());
    assert.deepEqual(draftSlot, {
      startsAt: fixture.manualStartsAt,
      endsAt: fixture.manualEndsAt,
      status: AvailabilitySlotStatus.DRAFT,
    });
    assert.deepEqual(protectedSlot, {
      startsAt: fixture.manualEndsAt,
      endsAt: fixture.originalAvailabilityEndsAt,
      status: AvailabilitySlotStatus.PUBLISHED,
      internalNote: "Protected service-change overlap",
    });
  } finally {
    await fixture.cleanup();
  }
});

dbTest("reschedule po zkrácení manual override nenechá starý DRAFT ani mezeru", async () => {
  const [{ prisma }, { updateAdminBookingService }, { rescheduleBooking }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-booking"),
    import("@/features/booking/lib/booking-rescheduling"),
  ]);
  const fixture = await createAdminManualOverrideResizeFixture(prisma, randomUUID().slice(0, 8));
  const newStartsAt = new Date(fixture.baseStartsAt.getTime() + 150 * 60 * 1000);

  try {
    const shortening = await updateAdminBookingService({
      bookingId: fixture.booking.id,
      serviceId: fixture.shortService.id,
      actorUserId: fixture.owner.id,
    });
    assert.equal(shortening.status, "success");

    const result = await rescheduleBooking({
      bookingId: fixture.booking.id,
      newStartAt: newStartsAt.toISOString(),
      changedByUserId: fixture.owner.id,
      allowManualOverride: true,
      notifyClient: false,
    });
    assert.equal(result.manualOverride, true);

    const oldAreaSlots = await prisma.availabilitySlot.findMany({
      where: {
        status: { in: [AvailabilitySlotStatus.DRAFT, AvailabilitySlotStatus.PUBLISHED] },
        startsAt: { lt: fixture.originalAvailabilityEndsAt },
        endsAt: { gt: fixture.manualStartsAt },
      },
      select: { startsAt: true, endsAt: true, status: true },
    });
    assert.deepEqual(oldAreaSlots.map((slot) => [slot.startsAt, slot.endsAt, slot.status]), [
      [fixture.originalAvailabilityStartsAt, fixture.originalAvailabilityEndsAt, AvailabilitySlotStatus.PUBLISHED],
    ]);

    const orphanDrafts = await prisma.availabilitySlot.count({
      where: {
        status: AvailabilitySlotStatus.DRAFT,
        startsAt: { gte: fixture.manualStartsAt, lt: fixture.originalAvailabilityEndsAt },
      },
    });
    assert.equal(orphanDrafts, 0);
  } finally {
    await fixture.cleanup();
  }
});


for (const sourceStatus of [AvailabilitySlotStatus.ARCHIVED, AvailabilitySlotStatus.PUBLISHED]) {
  dbTest(`změna služby s výslovnou výjimkou prodlouží ${sourceStatus} přes vlastní úklid a po stornu obnoví jen původní nabídku`, async () => {
    const [{ prisma }, { updateAdminBookingService, applyAdminBookingStatusChange }] = await Promise.all([
      import("@/lib/prisma"), import("./admin-booking"),
    ]);
    const fixture = await createAdminServiceChangeFixture(prisma, randomUUID().slice(0, 8), { windowMinutes: 180 });
    const atMinute = (minutes: number) => new Date(fixture.startsAt.getTime() + minutes * 60_000);
    try {
      await prisma.availabilitySlot.update({ where: { id: fixture.slot.id }, data: { status: sourceStatus, endsAt: atMinute(60) } });
      await prisma.booking.update({ where: { id: fixture.booking.id }, data: {
        cleanupMinutes: 15, cleanupBlockMinutes: 15, blockedUntil: atMinute(75), originalAvailabilityEndsAt: atMinute(60),
      } });
      await prisma.service.update({ where: { id: fixture.replacementService.id }, data: { durationMinutes: 100, cleanupMinutes: 20 } });
      await prisma.availabilitySlot.create({ data: { startsAt: atMinute(75), endsAt: atMinute(180), status: "PUBLISHED", capacity: 1, serviceRestrictionMode: "ANY", publishedAt: new Date() } });
      const before = await prisma.booking.findUniqueOrThrow({ where: { id: fixture.booking.id } });
      const input = { bookingId: fixture.booking.id, serviceId: fixture.replacementService.id, actorUserId: fixture.owner.id, expectedUpdatedAt: before.updatedAt.toISOString() };
      const rejected = await updateAdminBookingService(input);
      assert.equal(rejected.status, "slot-too-short");
      assert.deepEqual(await prisma.booking.findUniqueOrThrow({ where: { id: fixture.booking.id } }), before);

      const changed = await updateAdminBookingService({ ...input, allowManualOverride: true });
      assert.equal(changed.status, "success");
      if (changed.status !== "success") assert.fail("Expected successful extension");
      assert.equal(changed.createdManualOverride, true);
      const booking = await prisma.booking.findUniqueOrThrow({ where: { id: fixture.booking.id }, include: { slot: true } });
      assert.equal(booking.scheduledStartsAt.toISOString(), atMinute(0).toISOString());
      assert.equal(booking.scheduledEndsAt.toISOString(), atMinute(100).toISOString());
      assert.equal(booking.cleanupBlockMinutes, 30);
      assert.equal(booking.blockedUntil?.toISOString(), atMinute(130).toISOString());
      assert.equal(booking.status, BookingStatus.CONFIRMED);
      assert.equal(booking.manualOverride, true);
      assert.equal(booking.slot.status, AvailabilitySlotStatus.DRAFT);
      assert.equal(booking.slot.endsAt.toISOString(), atMinute(130).toISOString());
      assert.equal(booking.originalAvailabilityEndsAt, null);
      const history = await prisma.bookingStatusHistory.findFirstOrThrow({ where: { bookingId: booking.id }, orderBy: { createdAt: "desc" } });
      assert.equal((history.metadata as { createdManualOverride: boolean }).createdManualOverride, true);

      const cancelled = await applyAdminBookingStatusChange({ bookingId: booking.id, targetStatus: BookingStatus.CANCELLED, actorUserId: fixture.owner.id, notifyClient: false });
      assert.equal(cancelled.status, "success");
      const publicSlots = await prisma.availabilitySlot.findMany({ where: { startsAt: { gte: atMinute(0), lt: atMinute(180) }, status: AvailabilitySlotStatus.PUBLISHED }, orderBy: { startsAt: "asc" } });
      assert.deepEqual(publicSlots.map((slot) => [slot.startsAt.toISOString(), slot.endsAt.toISOString()]), [
        [atMinute(0).toISOString(), atMinute(60).toISOString()],
        [atMinute(75).toISOString(), atMinute(180).toISOString()],
      ]);
    } finally {
      await fixture.cleanup();
    }
  });
}

for (const blockerKind of ["draft", "protected", "booking"] as const) {
  dbTest(`změna služby s výslovnou výjimkou odmítne ${blockerKind} v novém úklidu bez částečného zápisu`, async () => {
    const [{ prisma }, { updateAdminBookingService }] = await Promise.all([
      import("@/lib/prisma"), import("./admin-booking"),
    ]);
    const fixture = await createAdminServiceChangeFixture(prisma, randomUUID().slice(0, 8));
    const atMinute = (minutes: number) => new Date(fixture.startsAt.getTime() + minutes * 60_000);
    try {
      await prisma.availabilitySlot.update({ where: { id: fixture.slot.id }, data: { status: "ARCHIVED", endsAt: atMinute(60) } });
      await prisma.service.update({ where: { id: fixture.replacementService.id }, data: { cleanupMinutes: 20 } });
      const blocker = await prisma.availabilitySlot.create({ data: {
        startsAt: atMinute(105), endsAt: atMinute(120), capacity: 1, serviceRestrictionMode: "ANY",
        status: blockerKind === "draft" ? "DRAFT" : "PUBLISHED", internalNote: blockerKind === "protected" ? "Chráněný čas" : null,
      } });
      if (blockerKind === "booking") {
        const original = await prisma.booking.findUniqueOrThrow({ where: { id: fixture.booking.id } });
        await prisma.booking.create({ data: {
          clientId: fixture.client.id, slotId: blocker.id, serviceId: fixture.originalService.id, status: "CONFIRMED",
          clientNameSnapshot: "Kolizní návštěva", clientEmailSnapshot: original.clientEmailSnapshot,
          serviceNameSnapshot: original.serviceNameSnapshot, serviceDurationMinutes: 15,
          scheduledStartsAt: atMinute(105), scheduledEndsAt: atMinute(120), blockedUntil: null,
        } });
      }
      const before = await prisma.booking.findUniqueOrThrow({ where: { id: fixture.booking.id } });
      const slotsBefore = await prisma.availabilitySlot.findMany({ where: { startsAt: { gte: atMinute(0), lt: atMinute(120) } }, orderBy: { id: "asc" } });
      const historyBefore = await prisma.bookingStatusHistory.count({ where: { bookingId: fixture.booking.id } });
      const changed = await updateAdminBookingService({ bookingId: fixture.booking.id, serviceId: fixture.replacementService.id, actorUserId: fixture.owner.id, allowManualOverride: true });
      assert.equal(changed.status, "conflict");
      if (changed.status !== "conflict") assert.fail("Expected conflict");
      assert.ok(changed.message.includes(blockerKind === "booking" ? "Kolizní návštěva" : blockerKind === "draft" ? "interně blokovaného" : "chráněného"));
      assert.deepEqual(await prisma.booking.findUniqueOrThrow({ where: { id: fixture.booking.id } }), before);
      assert.deepEqual(await prisma.availabilitySlot.findMany({ where: { startsAt: { gte: atMinute(0), lt: atMinute(120) } }, orderBy: { id: "asc" } }), slotsBefore);
      assert.equal(await prisma.bookingStatusHistory.count({ where: { bookingId: fixture.booking.id } }), historyBefore);
    } finally {
      await fixture.cleanup();
    }
  });
}


for (const nextAction of ["shorten", "reschedule"] as const) {
  dbTest(`výjimka po změně služby při ${nextAction} neobnoví odebraný čas historického slotu`, async () => {
    const [{ prisma }, { updateAdminBookingService, applyAdminBookingStatusChange }, { rescheduleBooking }] = await Promise.all([
      import("@/lib/prisma"), import("./admin-booking"), import("@/features/booking/lib/booking-rescheduling"),
    ]);
    const fixture = await createAdminServiceChangeFixture(prisma, randomUUID().slice(0, 8), { windowMinutes: 360 });
    const atMinute = (minutes: number) => new Date(fixture.startsAt.getTime() + minutes * 60_000);
    try {
      // Historický slot je širší než doložený původní čas této rezervace.
      await prisma.availabilitySlot.update({ where: { id: fixture.slot.id }, data: { status: "ARCHIVED" } });
      await prisma.booking.update({ where: { id: fixture.booking.id }, data: { originalAvailabilityEndsAt: atMinute(60) } });
      await prisma.service.update({ where: { id: fixture.replacementService.id }, data: { durationMinutes: 100, cleanupMinutes: 20 } });
      const changed = await updateAdminBookingService({ bookingId: fixture.booking.id, serviceId: fixture.replacementService.id, actorUserId: fixture.owner.id, allowManualOverride: true });
      assert.equal(changed.status, "success");
      if (nextAction === "shorten") {
        const shortened = await updateAdminBookingService({ bookingId: fixture.booking.id, serviceId: fixture.originalService.id, actorUserId: fixture.owner.id });
        assert.equal(shortened.status, "success");
      } else {
        const moved = await rescheduleBooking({ bookingId: fixture.booking.id, newStartAt: atMinute(180).toISOString(), changedByUserId: fixture.owner.id, allowManualOverride: true, notifyClient: false });
        assert.equal(moved.manualOverride, true);
      }
      const publishedBeforeCancellation = await prisma.availabilitySlot.findMany({ where: { startsAt: { gte: atMinute(0), lt: atMinute(360) }, status: "PUBLISHED" }, orderBy: { startsAt: "asc" } });
      assert.deepEqual(publishedBeforeCancellation.map((slot) => [slot.startsAt.toISOString(), slot.endsAt.toISOString()]), nextAction === "shorten" ? [] : [[atMinute(0).toISOString(), atMinute(60).toISOString()]]);
      const cancellation = await applyAdminBookingStatusChange({ bookingId: fixture.booking.id, targetStatus: BookingStatus.CANCELLED, actorUserId: fixture.owner.id, notifyClient: false });
      assert.equal(cancellation.status, "success");
      const publishedAfterCancellation = await prisma.availabilitySlot.findMany({ where: { startsAt: { gte: atMinute(0), lt: atMinute(360) }, status: "PUBLISHED" }, orderBy: { startsAt: "asc" } });
      assert.deepEqual(publishedAfterCancellation.map((slot) => [slot.startsAt.toISOString(), slot.endsAt.toISOString()]), [[atMinute(0).toISOString(), atMinute(60).toISOString()]]);
    } finally {
      await fixture.cleanup();
    }
  });
}


for (const previewKind of ["ready", "requires-override", "blocked"] as const) {
  dbTest(`náhled změny služby ${previewKind} používá validační pravidla uložení a nezapisuje data`, async () => {
    const [{ prisma }, { previewAdminBookingServiceChange, updateAdminBookingService }] = await Promise.all([
      import("@/lib/prisma"), import("./admin-booking"),
    ]);
    const fixture = await createAdminServiceChangeFixture(prisma, randomUUID().slice(0, 8));
    const atMinute = (minutes: number) => new Date(fixture.startsAt.getTime() + minutes * 60_000);
    try {
      await prisma.service.update({ where: { id: fixture.replacementService.id }, data: { cleanupMinutes: 20 } });
      if (previewKind !== "ready") {
        await prisma.availabilitySlot.update({ where: { id: fixture.slot.id }, data: { status: "ARCHIVED", endsAt: atMinute(60) } });
        await prisma.booking.update({ where: { id: fixture.booking.id }, data: { cleanupMinutes: 15, cleanupBlockMinutes: 15, blockedUntil: atMinute(75), originalAvailabilityEndsAt: atMinute(60) } });
        await prisma.availabilitySlot.create({ data: { startsAt: atMinute(75), endsAt: atMinute(120), status: "PUBLISHED", capacity: 1, serviceRestrictionMode: "ANY", publishedAt: new Date(), internalNote: previewKind === "blocked" ? "Chráněný termín" : null } });
      }
      const bookingBefore = await prisma.booking.findUniqueOrThrow({ where: { id: fixture.booking.id } });
      const slotsBefore = await prisma.availabilitySlot.findMany({ where: { startsAt: { gte: atMinute(0), lt: atMinute(120) } }, orderBy: { id: "asc" } });
      const historyBefore = await prisma.bookingStatusHistory.findMany({ where: { bookingId: fixture.booking.id } });
      const emailsBefore = await prisma.emailLog.findMany({ where: { bookingId: fixture.booking.id } });
      const input = { bookingId: fixture.booking.id, serviceId: fixture.replacementService.id, actorUserId: fixture.owner.id, expectedUpdatedAt: bookingBefore.updatedAt.toISOString() };
      const preview = await previewAdminBookingServiceChange(input);
      assert.equal(preview.status, previewKind === "blocked" ? "conflict" : "success");
      if (preview.status === "success") {
        assert.equal(preview.createdManualOverride, previewKind === "requires-override");
        assert.equal(preview.nextScheduledEndsAt.toISOString(), atMinute(90).toISOString());
        assert.equal(preview.nextBlockedUntil.toISOString(), atMinute(120).toISOString());
      }
      assert.deepEqual(await prisma.booking.findUniqueOrThrow({ where: { id: fixture.booking.id } }), bookingBefore);
      assert.deepEqual(await prisma.availabilitySlot.findMany({ where: { startsAt: { gte: atMinute(0), lt: atMinute(120) } }, orderBy: { id: "asc" } }), slotsBefore);
      assert.deepEqual(await prisma.bookingStatusHistory.findMany({ where: { bookingId: fixture.booking.id } }), historyBefore);
      assert.deepEqual(await prisma.emailLog.findMany({ where: { bookingId: fixture.booking.id } }), emailsBefore);
      if (previewKind === "ready") {
        const changed = await updateAdminBookingService(input);
        assert.equal(changed.status, "success");
      } else if (previewKind === "requires-override") {
        assert.equal((await updateAdminBookingService(input)).status, "slot-too-short");
        assert.equal((await updateAdminBookingService({ ...input, allowManualOverride: true })).status, "success");
      } else {
        assert.equal((await updateAdminBookingService({ ...input, allowManualOverride: true })).status, preview.status);
      }
    } finally {
      await fixture.cleanup();
    }
  });
}


for (const scenario of [
  { name: "kratší služba", duration: 30, cleanup: 15, blockedMinutes: 45, status: "success", exception: false, restricted: false },
  { name: "kratší služba u dřívější ruční výjimky", duration: 30, cleanup: 15, blockedMinutes: 45, status: "success", exception: false, restricted: false, manualOverride: true },
  { name: "stejně dlouhá služba", duration: 60, cleanup: 15, blockedMinutes: 75, status: "success", exception: false, restricted: false },
  { name: "kratší služba se stejnou celkovou blokací", duration: 45, cleanup: 30, blockedMinutes: 75, status: "success", exception: false, restricted: false },
  { name: "kratší služba s delší celkovou blokací", duration: 45, cleanup: 45, blockedMinutes: 90, status: "success", exception: true, restricted: false },
  { name: "kratší nepovolená služba", duration: 30, cleanup: 15, blockedMinutes: 45, status: "slot-too-short", exception: false, restricted: true },
] as const) {
  dbTest(`změna služby v již drženém archivovaném termínu: ${scenario.name}`, async () => {
    const [{ prisma }, { previewAdminBookingServiceChange, updateAdminBookingService }] = await Promise.all([
      import("@/lib/prisma"), import("./admin-booking"),
    ]);
    const fixture = await createAdminServiceChangeFixture(prisma, randomUUID().slice(0, 8));
    const atMinute = (minutes: number) => new Date(fixture.startsAt.getTime() + minutes * 60_000);
    try {
      await prisma.availabilitySlot.update({ where: { id: fixture.slot.id }, data: {
        status: "ARCHIVED", endsAt: atMinute(60),
        serviceRestrictionMode: scenario.restricted ? "SELECTED" : "ANY",
        allowedServices: scenario.restricted ? { create: { serviceId: fixture.originalService.id } } : undefined,
      } });
      await prisma.booking.update({ where: { id: fixture.booking.id }, data: {
        manualOverride: "manualOverride" in scenario ? scenario.manualOverride : false,
        cleanupMinutes: 15, cleanupBlockMinutes: 15, blockedUntil: atMinute(75), originalAvailabilityEndsAt: atMinute(60),
      } });
      await prisma.service.update({ where: { id: fixture.replacementService.id }, data: {
        durationMinutes: scenario.duration, cleanupMinutes: scenario.cleanup,
      } });
      const before = await prisma.booking.findUniqueOrThrow({ where: { id: fixture.booking.id } });
      const sourceBefore = await prisma.availabilitySlot.findUniqueOrThrow({ where: { id: fixture.slot.id } });
      const input = { bookingId: fixture.booking.id, serviceId: fixture.replacementService.id, actorUserId: fixture.owner.id, expectedUpdatedAt: before.updatedAt.toISOString() };
      const preview = await previewAdminBookingServiceChange(input);
      assert.equal(preview.status, scenario.status);
      if (preview.status === "success") assert.equal(preview.createdManualOverride, scenario.exception);
      assert.deepEqual(await prisma.booking.findUniqueOrThrow({ where: { id: fixture.booking.id } }), before);
      assert.deepEqual(await prisma.availabilitySlot.findUniqueOrThrow({ where: { id: fixture.slot.id } }), sourceBefore);

      const result = await updateAdminBookingService(input);
      if (scenario.exception || scenario.restricted) {
        assert.equal(result.status, "slot-too-short");
        assert.deepEqual(await prisma.booking.findUniqueOrThrow({ where: { id: fixture.booking.id } }), before);
      } else {
        assert.equal(result.status, "success");
        const booking = await prisma.booking.findUniqueOrThrow({ where: { id: fixture.booking.id } });
        assert.equal(booking.scheduledStartsAt.toISOString(), before.scheduledStartsAt.toISOString());
        assert.equal(booking.scheduledEndsAt.toISOString(), atMinute(scenario.duration).toISOString());
        assert.equal(booking.blockedUntil?.toISOString(), atMinute(scenario.blockedMinutes).toISOString());
        assert.equal(booking.slotId, fixture.slot.id);
        assert.equal(booking.manualOverride, before.manualOverride);
        assert.equal(booking.status, before.status);
        const audit = await prisma.bookingStatusHistory.findFirstOrThrow({ where: { bookingId: booking.id }, orderBy: { createdAt: "desc" } });
        assert.equal((audit.metadata as { createdManualOverride: boolean }).createdManualOverride, false);
      }
      assert.deepEqual(await prisma.availabilitySlot.findUniqueOrThrow({ where: { id: fixture.slot.id } }), sourceBefore);
      assert.equal(await prisma.availabilitySlot.count({ where: { startsAt: { gte: atMinute(0), lt: atMinute(120) }, status: { in: ["PUBLISHED", "DRAFT"] } } }), 0);
    } finally {
      await fixture.cleanup();
    }
  });
}


for (const notificationCase of ["with-email", "optout", "missing-email", "pending", "final-price", "unknown-price"] as const) {
  dbTest(`oznámení změny služby: ${notificationCase}`, async () => {
    const [{ prisma }, { previewAdminBookingServiceChange, updateAdminBookingService }] = await Promise.all([
      import("@/lib/prisma"), import("./admin-booking"),
    ]);
    const fixture = await createAdminServiceChangeFixture(prisma, randomUUID().slice(0, 8));
    try {
      await prisma.booking.update({ where: { id: fixture.booking.id }, data: {
        clientEmailSnapshot: notificationCase === "missing-email" ? " " : `client-service-change-${fixture.owner.id}@example.com`,
        status: notificationCase === "pending" ? "PENDING" : "CONFIRMED",
        finalPriceCzk: notificationCase === "final-price" ? 1700 : null,
      } });
      if (notificationCase === "unknown-price") await prisma.service.update({ where: { id: fixture.replacementService.id }, data: { priceFromCzk: null } });
      const before = await prisma.booking.findUniqueOrThrow({ where: { id: fixture.booking.id } });
      const input = { bookingId: fixture.booking.id, serviceId: fixture.replacementService.id, actorUserId: fixture.owner.id, expectedUpdatedAt: before.updatedAt.toISOString(), now: new Date(fixture.startsAt.getTime() - 7 * 24 * 60 * 60_000) };
      const preview = await previewAdminBookingServiceChange(input);
      assert.equal(preview.status, "success");
      assert.equal(await prisma.emailLog.count({ where: { bookingId: fixture.booking.id } }), 0);
      assert.equal(await prisma.bookingActionToken.count({ where: { bookingId: fixture.booking.id } }), 0);
      const result = await updateAdminBookingService({ ...input, notifyClient: notificationCase !== "optout" });
      assert.equal(result.status, "success");
      if (result.status !== "success") assert.fail("Expected successful change");
      const shouldNotify = notificationCase !== "optout" && notificationCase !== "missing-email";
      const backgroundDelivery = process.env.EMAIL_DELIVERY_MODE === "background";
      assert.equal(result.notificationStatus, shouldNotify ? (backgroundDelivery ? "queued" : "logged") : "skipped");
      const logs = await prisma.emailLog.findMany({ where: { bookingId: fixture.booking.id, templateKey: "booking-service-changed-v1" } });
      assert.equal(logs.length, shouldNotify ? 1 : 0);
      assert.equal(await prisma.bookingActionToken.count({ where: { bookingId: fixture.booking.id } }), shouldNotify ? 2 : 0);
      if (shouldNotify) {
        const log = logs[0]!;
        const payload = log.payload as Prisma.JsonObject;
        assert.equal(log.status, backgroundDelivery ? EmailLogStatus.PENDING : EmailLogStatus.SENT);
        assert.equal(log.communicationGeneration, before.communicationGeneration + 1);
        assert.equal(payload.serviceId, fixture.replacementService.id);
        assert.equal(payload.previousServiceName, before.serviceNameSnapshot);
        assert.equal(payload.scheduledEndsAt, new Date(fixture.startsAt.getTime() + 90 * 60_000).toISOString());
        assert.equal(payload.priceCzk, notificationCase === "final-price" ? 1700 : notificationCase === "unknown-price" ? null : 1500);
        assert.equal(payload.priceIsFinal, notificationCase === "final-price");
        assert.equal(payload.bookingStatus, before.status);
        if (backgroundDelivery) {
          assert.match(String(payload.manageReservationUrl), /\/rezervace\/sprava\//);
          assert.match(String(payload.cancellationUrl), /\/rezervace\/storno\//);
          assert.ok(log.nextAttemptAt && log.nextAttemptAt > new Date(), "Testovací zprávu nesmí vyzvednout běžící worker.");
        } else {
          assert.equal(payload.manageReservationUrl, "[REDACTED]");
          assert.equal(payload.cancellationUrl, "[REDACTED]");
          assert.equal(log.provider, "log");
          assert.ok(log.sentAt);
        }
        assert.ok(log.actionTokenId);
      }
      const repeated = await updateAdminBookingService({ ...input, notifyClient: true });
      assert.equal(repeated.status, "concurrent-modification");
      assert.equal(await prisma.emailLog.count({ where: { bookingId: fixture.booking.id, templateKey: "booking-service-changed-v1" } }), logs.length);
    } finally {
      await fixture.cleanup();
    }
  });
}

dbTest("oznámení změny služby při selhání fronty vrátí rezervaci, sloty, tokeny i audit", async () => {
  const [{ prisma }, { updateAdminBookingService }] = await Promise.all([import("@/lib/prisma"), import("./admin-booking")]);
  const fixture = await createAdminServiceChangeFixture(prisma, randomUUID().slice(0, 8));
  const originalTransaction = prisma.$transaction;
  try {
    await prisma.availabilitySlot.update({ where: { id: fixture.slot.id }, data: { status: "ARCHIVED", endsAt: fixture.bookingEndsAt } });
    const before = await prisma.booking.findUniqueOrThrow({ where: { id: fixture.booking.id } });
    const slotsBefore = await prisma.availabilitySlot.findMany({ where: { startsAt: { gte: fixture.startsAt, lt: fixture.endsAt } }, orderBy: { id: "asc" } });
    Object.defineProperty(prisma, "$transaction", { configurable: true, writable: true, value: (...args: unknown[]) => {
      const operation = args[0] as (tx: Prisma.TransactionClient) => Promise<unknown>;
      return Reflect.apply(originalTransaction, prisma, [async (tx: Prisma.TransactionClient) => {
        const emailLog = new Proxy(tx.emailLog, { get(target, key) {
          if (key === "create") return async () => { throw new Error("forced service notification queue failure"); };
          return Reflect.get(target, key);
        } });
        return operation(new Proxy(tx, { get(target, key) { return key === "emailLog" ? emailLog : Reflect.get(target, key); } }));
      }, args[1]]);
    } });
    await assert.rejects(updateAdminBookingService({ bookingId: fixture.booking.id, serviceId: fixture.replacementService.id, actorUserId: fixture.owner.id, allowManualOverride: true, notifyClient: true }), /forced service notification queue failure/);
    Object.defineProperty(prisma, "$transaction", { configurable: true, writable: true, value: originalTransaction });
    assert.deepEqual(await prisma.booking.findUniqueOrThrow({ where: { id: fixture.booking.id } }), before);
    assert.deepEqual(await prisma.availabilitySlot.findMany({ where: { startsAt: { gte: fixture.startsAt, lt: fixture.endsAt } }, orderBy: { id: "asc" } }), slotsBefore);
    assert.equal(await prisma.bookingActionToken.count({ where: { bookingId: fixture.booking.id } }), 0);
    assert.equal(await prisma.emailLog.count({ where: { bookingId: fixture.booking.id } }), 0);
    assert.equal(await prisma.bookingStatusHistory.count({ where: { bookingId: fixture.booking.id } }), 0);
  } finally {
    Object.defineProperty(prisma, "$transaction", { configurable: true, writable: true, value: originalTransaction });
    await fixture.cleanup();
  }
});


dbTest("oznámení změny služby lze znovu odeslat s novými odkazy i po redakci a zachová obsah dalších čekajících zpráv", async () => {
  const [{ prisma }, { updateAdminBookingService }, { createResendEmailLog }, { scrubSensitiveEmailPayload }] = await Promise.all([
    import("@/lib/prisma"), import("./admin-booking"), import("@/features/admin/actions/email-log-resend"), import("@/lib/email/payload-security"),
  ]);
  const fixture = await createAdminServiceChangeFixture(prisma, randomUUID().slice(0, 8));
  const deferredAt = new Date(fixture.startsAt.getTime() - 7 * 24 * 60 * 60_000);
  try {
    const changed = await updateAdminBookingService({ bookingId: fixture.booking.id, serviceId: fixture.replacementService.id, actorUserId: fixture.owner.id, notifyClient: true, now: deferredAt });
    assert.equal(changed.status, "success");
    const original = await prisma.emailLog.findFirstOrThrow({ where: { bookingId: fixture.booking.id, templateKey: "booking-service-changed-v1" } });
    const sibling = await prisma.emailLog.create({ data: {
      bookingId: fixture.booking.id, clientId: fixture.client.id, type: EmailLogType.GENERIC,
      audience: EmailAudience.CLIENT, templateKey: original.templateKey, recipientEmail: original.recipientEmail,
      subject: original.subject, payload: original.payload as Prisma.InputJsonObject,
      communicationGeneration: original.communicationGeneration, nextAttemptAt: deferredAt,
    } });
    await prisma.emailLog.update({ where: { id: original.id }, data: { status: "SENT", provider: "log", sentAt: new Date(), payload: scrubSensitiveEmailPayload(original.payload) } });
    const source = await prisma.emailLog.findUniqueOrThrow({ where: { id: original.id }, include: { client: { select: { id: true, email: true } }, booking: { select: { id: true, clientEmailSnapshot: true } } } });
    const resent = await prisma.$transaction(async (tx) => {
      const result = await createResendEmailLog({ emailLog: source, transaction: tx });
      await tx.emailLog.updateMany({ where: { bookingId: fixture.booking.id, status: "PENDING" }, data: { nextAttemptAt: deferredAt } });
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    assert.ok(resent);
    const payload = resent.payload as Prisma.JsonObject;
    assert.equal(payload.priceCzk, 1500);
    assert.equal(payload.bookingStatus, "CONFIRMED");
    assert.equal(payload.previousServiceName, (original.payload as Prisma.JsonObject).previousServiceName);
    assert.match(String(payload.manageReservationUrl), /\/rezervace\/sprava\//);
    assert.notEqual(payload.manageReservationUrl, (original.payload as Prisma.JsonObject).manageReservationUrl);
    const updatedSibling = await prisma.emailLog.findUniqueOrThrow({ where: { id: sibling.id } });
    const siblingPayload = updatedSibling.payload as Prisma.JsonObject;
    assert.equal(siblingPayload.priceCzk, payload.priceCzk);
    assert.equal(siblingPayload.previousServiceName, payload.previousServiceName);
    assert.equal(siblingPayload.bookingStatus, payload.bookingStatus);
    assert.equal(siblingPayload.manageReservationUrl, payload.manageReservationUrl);
    assert.equal(updatedSibling.communicationGeneration, resent.communicationGeneration);
  } finally {
    await fixture.cleanup();
  }
});

// Samostatný CI průchod s background; běžný log průchod tuto větev nepouští.
// Provider se nahrazuje před importem workeru, DB i renderer zůstávají skutečné.
(process.env.EMAIL_DELIVERY_MODE === "background" ? dbTest : test.skip)("background: oznámení změny služby projde frontou a workerem", async (t) => {
  const messages: import("@/lib/email/provider").EmailDeliveryMessage[] = [];
  let failDelivery = false;
  t.mock.module("@/lib/email/provider", { exports: {
    sendEmail: async (message: import("@/lib/email/provider").EmailDeliveryMessage) => {
      messages.push(message);
      if (failDelivery) throw new Error("fake service-change transport failure");
      return { provider: "smtp", messageId: "fake-service-change" };
    },
  } });
  // Ani terminální chyba nesmí kontaktovat externí notifikační službu.
  t.mock.module("@/lib/notifications/pushover-core", { exports: {
    sendOwnerEmailFailurePushover: async () => undefined,
  } });
  const [{ prisma }, { updateAdminBookingService }, { runEmailDeliveryWorkerOnce }, { hashBookingActionToken }, { env }] = await Promise.all([
    import("@/lib/prisma"), import("./admin-booking"), import("@/lib/email/worker"),
    import("@/features/booking/lib/booking-action-tokens"), import("@/config/env"),
  ]);
  assert.equal(env.EMAIL_DELIVERY_MODE, "background");

  for (const scenario of ["sent", "retry", "terminal-failure", "stale-generation", "stale-price", "stale-term", "stale-status", "stale-service", "stale-name"] as const) {
    await t.test(scenario, async () => {
      const fixture = await createAdminServiceChangeFixture(prisma, randomUUID().slice(0, 8));
      messages.length = 0;
      failDelivery = scenario === "retry" || scenario === "terminal-failure";
      try {
        const result = await updateAdminBookingService({
          bookingId: fixture.booking.id, serviceId: fixture.replacementService.id,
          actorUserId: fixture.owner.id, notifyClient: true,
        });
        assert.equal(result.status, "success");
        if (result.status !== "success") assert.fail("Změna služby musí uspět.");
        assert.equal(result.notificationStatus, "queued");
        const log = await prisma.emailLog.findFirstOrThrow({ where: { bookingId: fixture.booking.id, templateKey: "booking-service-changed-v1" } });
        const booking = await prisma.booking.findUniqueOrThrow({ where: { id: fixture.booking.id } });
        const payload = log.payload as Prisma.JsonObject;
        assert.equal(log.status, EmailLogStatus.PENDING);
        assert.equal(log.attemptCount, 0);
        assert.equal(log.sentAt, null);
        assert.equal(payload.clientName, booking.clientNameSnapshot);
        assert.equal(payload.serviceName, booking.serviceNameSnapshot);
        assert.equal(payload.serviceId, fixture.replacementService.id);
        assert.equal(payload.priceCzk, 1500);
        assert.equal(payload.scheduledStartsAt, fixture.startsAt.toISOString());
        assert.equal(payload.scheduledEndsAt, new Date(fixture.startsAt.getTime() + 90 * 60_000).toISOString());
        const rawTokens: string[] = [];
        for (const [field, path, type] of [
          ["manageReservationUrl", "sprava", BookingActionTokenType.RESCHEDULE],
          ["cancellationUrl", "storno", BookingActionTokenType.CANCEL],
        ] as const) {
          const url = new URL(String(payload[field]));
          assert.equal(url.origin, new URL(env.NEXT_PUBLIC_APP_URL).origin);
          assert.equal(url.search, "");
          assert.equal(url.hash, "");
          assert.match(url.pathname, new RegExp(`^/rezervace/${path}/[A-Za-z0-9_-]{43}$`));
          const raw = url.pathname.split("/").at(-1)!;
          rawTokens.push(raw);
          const token = await prisma.bookingActionToken.findUniqueOrThrow({ where: { tokenHash: hashBookingActionToken(raw) } });
          assert.notEqual(token.tokenHash, raw);
          assert.equal(token.bookingId, fixture.booking.id);
          assert.equal(token.type, type);
          assert.equal(token.usedAt, null);
          assert.equal(token.revokedAt, null);
          assert.ok(token.expiresAt > new Date());
          assert.equal(token.expiresAt.getTime(), fixture.startsAt.getTime() + 2 * 60 * 60_000);
          if (type === BookingActionTokenType.RESCHEDULE) assert.equal(log.actionTokenId, token.id);
        }
        assert.notEqual(rawTokens[0], rawTokens[1]);

        if (scenario === "stale-generation") await prisma.booking.update({ where: { id: booking.id }, data: { communicationGeneration: { increment: 1 } } });
        if (scenario === "stale-price") await prisma.booking.update({ where: { id: booking.id }, data: { finalPriceCzk: 1900 } });
        if (scenario === "stale-term") await prisma.booking.update({ where: { id: booking.id }, data: { scheduledEndsAt: fixture.bookingEndsAt } });
        if (scenario === "stale-status") await prisma.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });
        if (scenario === "stale-service") await prisma.booking.update({ where: { id: booking.id }, data: { serviceId: fixture.originalService.id } });
        if (scenario === "stale-name") await prisma.booking.update({ where: { id: booking.id }, data: { clientNameSnapshot: "Jiná klientka" } });
        // Zpřístupníme pouze vlastní zprávu; DB je izolovaná testovacím runnerem.
        await prisma.emailLog.update({ where: { id: log.id }, data: { nextAttemptAt: new Date(0), attemptCount: scenario === "terminal-failure" ? 4 : 0 } });
        assert.equal(await runEmailDeliveryWorkerOnce(), 1);
        let stored = await prisma.emailLog.findUniqueOrThrow({ where: { id: log.id } });
        assert.equal(stored.processingToken, null);
        assert.equal(stored.processingStartedAt, null);
        if (scenario.startsWith("stale-")) {
          assert.equal(messages.length, 0);
          assert.equal(stored.status, EmailLogStatus.SENT);
          assert.equal(stored.provider, "system-skip");
          assert.equal(stored.providerMessageId, null);
          assert.ok(stored.errorMessage);
        } else if (failDelivery) {
          assert.equal(messages.length, 1);
          assert.equal(stored.status, scenario === "retry" ? EmailLogStatus.PENDING : EmailLogStatus.FAILED);
          assert.equal(stored.errorMessage, "fake service-change transport failure");
          assert.equal(stored.sentAt, null);
          assert.equal(stored.providerMessageId, null);
          if (scenario === "retry") {
            assert.ok(stored.nextAttemptAt && stored.nextAttemptAt > new Date());
            assert.equal((stored.payload as Prisma.JsonObject).manageReservationUrl, payload.manageReservationUrl);
            failDelivery = false;
            await prisma.emailLog.update({ where: { id: log.id }, data: { nextAttemptAt: new Date(0) } });
            assert.equal(await runEmailDeliveryWorkerOnce(), 1);
            stored = await prisma.emailLog.findUniqueOrThrow({ where: { id: log.id } });
            assert.equal(stored.status, EmailLogStatus.SENT);
            assert.equal(stored.attemptCount, 2);
            assert.equal(messages[0].idempotencyKey, messages[1].idempotencyKey);
          }
        } else {
          assert.equal(messages.length, 1);
          assert.equal(stored.status, EmailLogStatus.SENT);
          assert.equal(stored.provider, "smtp");
          assert.equal(stored.providerMessageId, "fake-service-change");
          assert.ok(stored.sentAt);
          const message = messages[0];
          assert.equal(message.to, booking.clientEmailSnapshot);
          assert.match(message.text, new RegExp(String(booking.serviceNameSnapshot)));
          assert.match(message.text, /1\s500\sKč/);
          const localTime = (date: Date) => new Intl.DateTimeFormat("cs-CZ", { timeZone: "Europe/Prague", hour: "2-digit", minute: "2-digit" }).format(date);
          assert.ok(message.text.includes(localTime(booking.scheduledStartsAt)));
          assert.ok(message.text.includes(localTime(booking.scheduledEndsAt)));
          for (const field of ["manageReservationUrl", "cancellationUrl"]) {
            assert.ok(message.text.includes(String(payload[field])));
            assert.ok(message.html.includes(String(payload[field])));
          }
          assert.equal(message.attachments?.length, 1);
          const attachment = message.attachments![0];
          assert.equal(attachment.filename, "pp-studio-rezervace.ics");
          assert.match(attachment.contentType, /^text\/calendar/);
          const ics = String(attachment.content).replace(/\r?\n /g, "");
          const icsTime = (date: Date) => `${getPragueLocalDate(date).replaceAll("-", "")}T${localTime(date).replace(":", "")}00`;
          assert.ok(ics.includes(`DTSTART;TZID=Europe/Prague:${icsTime(booking.scheduledStartsAt)}`));
          assert.ok(ics.includes(`DTEND;TZID=Europe/Prague:${icsTime(booking.scheduledEndsAt)}`));
          assert.ok(ics.includes(`SUMMARY:PP Studio – ${booking.serviceNameSnapshot}`));
          assert.ok(ics.includes(`UID:${booking.id}@`));
          assert.match(ics, /STATUS:CONFIRMED/);
          for (const raw of rawTokens) assert.ok(!ics.includes(raw));
        }
        if (stored.status !== EmailLogStatus.PENDING) {
          assert.equal((stored.payload as Prisma.JsonObject).manageReservationUrl, "[REDACTED]");
          assert.equal((stored.payload as Prisma.JsonObject).cancellationUrl, "[REDACTED]");
        }
      } finally {
        await fixture.cleanup();
      }
    });
  }
});
