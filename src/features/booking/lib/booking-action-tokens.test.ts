import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_APP_NAME = "PP Studio";
process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET = "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL = "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD = "change-me-owner";
process.env.ADMIN_STAFF_EMAIL = "staff@example.com";
process.env.ADMIN_STAFF_PASSWORD = "change-me-staff";
process.env.EMAIL_DELIVERY_MODE = "log";

test("buildBookingActionExpiry uses the standard token window", async () => {
  const { buildBookingActionExpiry } = await import("./booking-action-tokens");
  const now = new Date("2026-04-22T10:00:00.000Z");

  assert.equal(buildBookingActionExpiry(now).toISOString(), "2026-05-22T10:00:00.000Z");
});

test("self-service token expiry follows the scheduled start for 10, 60 and 90 day bookings", async () => {
  const { buildBookingSelfServiceActionExpiry } = await import("./booking-action-tokens");
  const now = new Date("2026-04-22T10:00:00.000Z");

  for (const daysAhead of [10, 60, 90]) {
    const scheduledStartsAt = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    const expiresAt = buildBookingSelfServiceActionExpiry(scheduledStartsAt);

    assert.equal(
      expiresAt.toISOString(),
      new Date(scheduledStartsAt.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    );
  }
});

test("self-service token expiry ends at the scheduled start plus the grace period", async () => {
  const { buildBookingSelfServiceActionExpiry } = await import("./booking-action-tokens");
  const scheduledStartsAt = new Date("2026-07-21T08:00:00.000Z");
  const expiresAt = buildBookingSelfServiceActionExpiry(scheduledStartsAt);

  assert.equal(expiresAt.toISOString(), "2026-07-21T10:00:00.000Z");
  assert.ok(expiresAt <= new Date("2026-07-21T10:00:00.000Z"));
  assert.ok(expiresAt < new Date("2026-07-21T10:00:00.001Z"));
});

test("rescheduled self-service tokens follow the later or earlier new term", async () => {
  const { buildBookingSelfServiceActionExpiry } = await import("./booking-action-tokens");
  const laterStart = new Date("2026-08-30T14:00:00.000Z");
  const earlierStart = new Date("2026-08-10T14:00:00.000Z");

  assert.equal(
    buildBookingSelfServiceActionExpiry(laterStart).toISOString(),
    "2026-08-30T16:00:00.000Z",
  );
  assert.equal(
    buildBookingSelfServiceActionExpiry(earlierStart).toISOString(),
    "2026-08-10T16:00:00.000Z",
  );
});

test("admin email action expiry keeps its seven day TTL", async () => {
  const { buildBookingEmailActionExpiry } = await import("./booking-action-tokens");
  const now = new Date("2026-04-22T10:00:00.000Z");

  assert.equal(buildBookingEmailActionExpiry(now).toISOString(), "2026-04-29T10:00:00.000Z");
});
