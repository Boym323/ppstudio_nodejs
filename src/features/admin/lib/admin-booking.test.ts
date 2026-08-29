import assert from "node:assert/strict";
import test from "node:test";

import { BookingStatus } from "@/generated/prisma/browser";

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

test("canMarkBookingNoShowAt povolí no-show až 15 minut po začátku", async () => {
  const { canMarkBookingNoShowAt, NO_SHOW_GRACE_MINUTES } = await import("./admin-booking");
  const scheduledStartsAt = new Date("2026-04-30T12:00:00.000Z");

  assert.equal(NO_SHOW_GRACE_MINUTES, 15);
  assert.equal(canMarkBookingNoShowAt(scheduledStartsAt, new Date("2026-04-30T11:44:00.000Z")), false);
  assert.equal(canMarkBookingNoShowAt(scheduledStartsAt, new Date("2026-04-30T12:00:00.000Z")), false);
  assert.equal(canMarkBookingNoShowAt(scheduledStartsAt, new Date("2026-04-30T12:14:59.000Z")), false);
  assert.equal(canMarkBookingNoShowAt(scheduledStartsAt, new Date("2026-04-30T12:15:00.000Z")), true);
  assert.equal(canMarkBookingNoShowAt(scheduledStartsAt, new Date("2026-04-30T13:00:00.000Z")), true);
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

test("getAdminBookingActionOptions hides no-show before the grace period", async () => {
  const { getAdminBookingActionOptions } = await import("./admin-booking");
  const scheduledStartsAt = new Date("2026-04-30T12:00:00.000Z");

  const beforeGrace = getAdminBookingActionOptions(BookingStatus.CONFIRMED, {
    scheduledStartsAt,
    now: new Date("2026-04-30T12:14:59.000Z"),
  });
  const atGrace = getAdminBookingActionOptions(BookingStatus.CONFIRMED, {
    scheduledStartsAt,
    now: new Date("2026-04-30T12:15:00.000Z"),
  });

  assert.equal(beforeGrace.some((action) => action.value === BookingStatus.NO_SHOW), false);
  assert.equal(atGrace.some((action) => action.value === BookingStatus.NO_SHOW), true);
});

test("canApplyAdminBookingTransition permits only the defined booking state transitions", async () => {
  const { canApplyAdminBookingTransition } = await import("./admin-booking");

  assert.equal(
    canApplyAdminBookingTransition(BookingStatus.PENDING, BookingStatus.CONFIRMED),
    true,
  );
  assert.equal(
    canApplyAdminBookingTransition(BookingStatus.PENDING, BookingStatus.CANCELLED),
    true,
  );
  assert.equal(
    canApplyAdminBookingTransition(BookingStatus.PENDING, BookingStatus.COMPLETED),
    false,
  );
  assert.equal(
    canApplyAdminBookingTransition(BookingStatus.CONFIRMED, BookingStatus.COMPLETED),
    true,
  );
  assert.equal(
    canApplyAdminBookingTransition(BookingStatus.CONFIRMED, BookingStatus.NO_SHOW),
    true,
  );
  for (const closedStatus of [
    BookingStatus.CANCELLED,
    BookingStatus.COMPLETED,
    BookingStatus.NO_SHOW,
  ]) {
    for (const targetStatus of [
      BookingStatus.CONFIRMED,
      BookingStatus.COMPLETED,
      BookingStatus.CANCELLED,
      BookingStatus.NO_SHOW,
    ]) {
      assert.equal(canApplyAdminBookingTransition(closedStatus, targetStatus), false);
    }
  }
});

test("buildBookingCleanupMetadata formats internal cleanup as low-priority admin metadata", async () => {
  const { buildBookingCleanupMetadata } = await import("./admin-booking");
  const scheduledEndsAt = new Date("2026-04-30T11:15:00.000Z");

  assert.deepEqual(
    buildBookingCleanupMetadata({
      cleanupBlockMinutes: 15,
      blockedUntil: new Date("2026-04-30T11:30:00.000Z"),
      scheduledEndsAt,
    }),
    {
      cleanupBlockMinutes: 15,
      cleanupLabel: "15 min",
      blockedUntilLabel: "13:30",
    },
  );

  assert.deepEqual(
    buildBookingCleanupMetadata({
      cleanupBlockMinutes: null,
      blockedUntil: null,
      scheduledEndsAt,
    }),
    {
      cleanupBlockMinutes: 0,
      cleanupLabel: "Bez úklidové blokace",
      blockedUntilLabel: "13:15",
    },
  );
});
