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
