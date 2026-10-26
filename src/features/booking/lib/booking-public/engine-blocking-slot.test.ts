import assert from "node:assert/strict";
import test from "node:test";

import {
  AvailabilitySlotStatus,
  BookingActorType,
  BookingSource,
  BookingStatus,
} from "@/generated/prisma/browser";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.EMAIL_DELIVERY_MODE ??= "log";

test("veřejný rezervační engine odmítne termín překrývající se s DRAFT blokací", async (t) => {
  let clientLookupCount = 0;
  const startsAt = new Date("2030-01-07T09:00:00.000Z");
  const publishedSlot = {
    id: "published-slot-1",
    startsAt,
    endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000),
    capacity: 1,
    status: AvailabilitySlotStatus.PUBLISHED,
    serviceRestrictionMode: "ANY",
    publicNote: null,
    internalNote: null,
    publishedAt: startsAt,
    cancelledAt: null,
    createdByUserId: "owner-1",
    allowedServices: [],
  };
  const draftSlot = {
    ...publishedSlot,
    id: "admin-block-1",
    startsAt: new Date(startsAt.getTime() + 15 * 60 * 1000),
    endsAt: new Date(startsAt.getTime() + 45 * 60 * 1000),
    status: AvailabilitySlotStatus.DRAFT,
    internalNote: "Administrativní blokace",
    publishedAt: null,
  };
  const tx = {
    service: {
      findFirst: async () => ({
        id: "service-1",
        name: "Testovací služba",
        durationMinutes: 30,
        cleanupMinutes: 0,
        priceFromCzk: 1200,
      }),
    },
    $queryRaw: async () => [{ id: publishedSlot.id }, { id: draftSlot.id }],
    availabilitySlot: {
      findUnique: async () => publishedSlot,
      findMany: async (args: { where: { id?: { not: string } } }) => {
        assert.equal(args.where.id?.not, publishedSlot.id);
        return [draftSlot];
      },
    },
    client: { findFirst: async () => { clientLookupCount += 1; return null; } },
  };

  t.mock.module("@/lib/prisma", {
    exports: { prisma: { $transaction: async (callback: (transaction: unknown) => Promise<unknown>) => callback(tx) } },
  });
  t.mock.module("@/lib/site-settings", {
    exports: {
      getBookingPolicySettings: async () => ({ minAdvanceHours: 0, maxAdvanceDays: 365 }),
      getEmailBrandingSettings: async () => ({ notificationAdminEmail: null }),
      isBookingWithinWindow: () => true,
    },
  });

  const { createBookingWithEngine } = await import("./engine");
  const { PublicBookingError, publicBookingErrorCodes } = await import("./shared");
  const input = {
    serviceId: "service-1",
    slotId: publishedSlot.id,
    startsAt: startsAt.toISOString(),
    client: { fullName: "Test Klientka", email: "client@example.cz", phone: "+420777111222" },
    source: BookingSource.WEB,
    status: BookingStatus.PENDING,
    isManual: false,
    allowManualOverride: false,
    actorType: BookingActorType.CLIENT,
    historyReason: "Test",
    sendClientEmail: false,
    includeCalendarAttachment: false,
    sendAdminNotification: false,
  } as const;

  await assert.rejects(createBookingWithEngine(input), (error: unknown) => {
    assert.ok(error instanceof PublicBookingError);
    assert.equal(error.code, publicBookingErrorCodes.bookingConflict);
    assert.match(error.message, /interně blokovaného času/);
    return true;
  });
  assert.equal(clientLookupCount, 0);
});
