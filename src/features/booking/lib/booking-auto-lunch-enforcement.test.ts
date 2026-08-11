import assert from "node:assert/strict";
import { test } from "node:test";

import { AvailabilitySlotStatus } from "@prisma/client";


process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "change-me-owner";
process.env.ADMIN_STAFF_EMAIL ??= "staff@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "change-me-staff";

async function canPreserveAutoLunchForBooking(...args: Parameters<typeof import("./booking-auto-lunch-enforcement").canPreserveAutoLunchForBooking>) {
  const module = await import("./booking-auto-lunch-enforcement");
  return module.canPreserveAutoLunchForBooking(...args);
}

const dayStart = new Date("2026-04-28T06:00:00.000Z"); // 08:00 Europe/Prague
const dayEnd = new Date("2026-04-28T14:00:00.000Z"); // 16:00 Europe/Prague

function createTransaction(input: {
  bookings?: Array<{ id: string; startsAt: Date; endsAt: Date; blockedUntil?: Date | null }>;
  enabled?: boolean;
  off?: boolean;
}) {
  return {
    availabilitySlot: {
      findMany: async () => [{ startsAt: dayStart, endsAt: dayEnd, status: AvailabilitySlotStatus.PUBLISHED }],
    },
    booking: {
      findMany: async ({ where }: { where: { id?: { not: string } } }) =>
        (input.bookings ?? [])
          .filter((booking) => booking.id !== where.id?.not)
          .map((booking) => ({
            scheduledStartsAt: booking.startsAt,
            scheduledEndsAt: booking.endsAt,
            blockedUntil: booking.blockedUntil ?? booking.endsAt,
          })),
    },
    siteSettings: { findUnique: async () => ({ autoLunchEnabled: input.enabled ?? true }) },
    autoLunchDayOverride: { findMany: async () => input.off ? [{ dateKey: "2026-04-28" }] : [] },
  } as never;
}

test("reschedule odečte původní booking a používá blockedUntil nového termínu", async () => {
  const tx = createTransaction({
    bookings: [{
      id: "moving",
      startsAt: new Date("2026-04-28T09:00:00.000Z"),
      endsAt: new Date("2026-04-28T12:45:00.000Z"),
    }],
  });

  assert.equal(await canPreserveAutoLunchForBooking(tx, {
    requestedStartsAt: new Date("2026-04-28T09:00:00.000Z"),
    requestedBlockedUntil: new Date("2026-04-28T10:00:00.000Z"),
    excludeBookingId: "moving",
  }), true);

  assert.equal(await canPreserveAutoLunchForBooking(createTransaction({
    bookings: [{
      id: "other",
      startsAt: new Date("2026-04-28T06:00:00.000Z"),
      endsAt: new Date("2026-04-28T11:00:00.000Z"),
    }],
  }), {
    requestedStartsAt: new Date("2026-04-28T10:15:00.000Z"),
    requestedBlockedUntil: new Date("2026-04-28T11:45:00.000Z"),
  }), false);
});

test("OFF den, globální OFF a krátká směna lunch constraint neuplatní", async () => {
  const request = {
    requestedStartsAt: new Date("2026-04-28T10:15:00.000Z"),
    requestedBlockedUntil: new Date("2026-04-28T11:00:00.000Z"),
  };
  assert.equal(await canPreserveAutoLunchForBooking(createTransaction({ enabled: false }), request), true);
  assert.equal(await canPreserveAutoLunchForBooking(createTransaction({ off: true }), request), true);
});
