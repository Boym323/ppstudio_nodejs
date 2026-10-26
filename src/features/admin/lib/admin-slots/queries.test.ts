import assert from "node:assert/strict";
import test from "node:test";

import { AvailabilitySlotStatus, BookingStatus } from "@/generated/prisma/browser";

process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";

test("admin planner odečte rezervaci i její úklid z volných intervalů", async (t) => {
  const slotStartsAt = new Date("2030-01-07T08:00:00.000Z");
  const slotEndsAt = new Date("2030-01-07T12:00:00.000Z");
  const scheduledStartsAt = new Date("2030-01-07T08:30:00.000Z");
  const scheduledEndsAt = new Date("2030-01-07T09:30:00.000Z");
  const blockedUntil = new Date("2030-01-07T10:00:00.000Z");
  const prisma = {
    availabilitySlot: {
      findMany: async () => [{
        id: "slot-1",
        startsAt: slotStartsAt,
        endsAt: slotEndsAt,
        capacity: 1,
        status: AvailabilitySlotStatus.PUBLISHED,
        publicNote: null,
        internalNote: null,
        serviceRestrictionMode: "ANY",
        allowedServices: [],
        bookings: [{ id: "booking-1", status: BookingStatus.CONFIRMED }],
      }],
    },
    booking: {
      findMany: async () => [{
        id: "booking-1",
        slotId: "slot-1",
        scheduledStartsAt,
        scheduledEndsAt,
        blockedUntil,
        status: BookingStatus.CONFIRMED,
        clientNameSnapshot: "Test Klientka",
        serviceNameSnapshot: "Testovací služba",
      }],
    },
  };

  t.mock.module("@/lib/prisma", { exports: { prisma } });
  t.mock.module("@/features/booking/lib/booking-auto-lunch-policy", {
    exports: {
      loadAutoLunchPolicySnapshot: async () => ({
        globalAutoLunchEnabled: false,
        dayLunchModes: {},
      }),
    },
  });

  const { getAdminPlannerWeek } = await import("./queries");
  const week = await getAdminPlannerWeek("owner", "2030-01-07");
  const monday = week.days[0];

  assert.equal(monday.dateKey, "2030-01-07");
  assert.deepEqual(monday.availableBlocks, [
    { startMinutes: 180, endMinutes: 210 },
    { startMinutes: 300, endMinutes: 420 },
  ]);
  assert.deepEqual(monday.cleanupBlocks, [{ startMinutes: 270, endMinutes: 300 }]);
  assert.equal(monday.bookings[0]?.hasCleanupBlock, true);
  assert.equal(monday.bookings[0]?.blockedLabel, "09:30 - 11:00");
  assert.equal(monday.availableBlocks.some((block) => block.startMinutes < 300 && block.endMinutes > 210), false);
});
