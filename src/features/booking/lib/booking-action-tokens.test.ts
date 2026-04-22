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

test("buildBookingCalendarUrl creates clickable ics endpoint", async () => {
  const { buildBookingCalendarUrl } = await import("./booking-action-tokens");

  assert.equal(
    buildBookingCalendarUrl("calendar-token-123"),
    "https://example.com/api/bookings/calendar/calendar-token-123.ics",
  );
});

test("buildBookingCalendarExpiry uses a longer-lived token window", async () => {
  const { buildBookingCalendarExpiry } = await import("./booking-action-tokens");
  const now = new Date("2026-04-22T10:00:00.000Z");
  const expiresAt = buildBookingCalendarExpiry(now);

  assert.equal(expiresAt.toISOString(), "2026-10-19T10:00:00.000Z");
});
