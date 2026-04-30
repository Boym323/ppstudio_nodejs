import assert from "node:assert/strict";
import test from "node:test";

import { BookingStatus } from "@prisma/client";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??=
  "test-admin-session-secret-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "password123";
process.env.ADMIN_STAFF_EMAIL ??= "staff@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "password123";

test("canCompleteBookingAt allows completion only after the booking end", async () => {
  const { canCompleteBookingAt } = await import("./admin-booking");
  const now = new Date("2026-04-30T12:00:00.000Z");

  assert.equal(
    canCompleteBookingAt(new Date("2026-04-30T11:59:59.000Z"), now),
    true,
  );
  assert.equal(
    canCompleteBookingAt(new Date("2026-04-30T12:00:00.000Z"), now),
    true,
  );
  assert.equal(
    canCompleteBookingAt(new Date("2026-04-30T12:00:01.000Z"), now),
    false,
  );
});

test("getAdminBookingActionOptions hides completion before the booking end", async () => {
  const { getAdminBookingActionOptions } = await import("./admin-booking");
  const now = new Date("2026-04-30T12:00:00.000Z");

  const beforeEnd = getAdminBookingActionOptions(BookingStatus.CONFIRMED, {
    scheduledEndsAt: new Date("2026-04-30T12:30:00.000Z"),
    now,
  });
  const afterEnd = getAdminBookingActionOptions(BookingStatus.CONFIRMED, {
    scheduledEndsAt: new Date("2026-04-30T11:30:00.000Z"),
    now,
  });

  assert.equal(
    beforeEnd.some((action) => action.value === BookingStatus.COMPLETED),
    false,
  );
  assert.equal(
    afterEnd.some((action) => action.value === BookingStatus.COMPLETED),
    true,
  );
});
