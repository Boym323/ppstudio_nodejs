import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "change-me-owner";
process.env.ADMIN_STAFF_EMAIL ??= "staff@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "change-me-staff";
process.env.EMAIL_DELIVERY_MODE ??= "log";

test("extractClientIp prefers first x-forwarded-for value", async () => {
  const { extractClientIp } = await import("@/lib/auth/admin-login-rate-limit");
  const headers = new Headers({
    "x-forwarded-for": "198.51.100.10, 203.0.113.9",
    "x-real-ip": "203.0.113.5",
  });

  assert.equal(extractClientIp(headers), "198.51.100.10");
});

test("normalizeAdminLoginEmail trims and lowercases value", async () => {
  const { normalizeAdminLoginEmail } = await import("@/lib/auth/admin-login-rate-limit");

  assert.equal(normalizeAdminLoginEmail("  ADMIN@Example.COM  "), "admin@example.com");
  assert.equal(normalizeAdminLoginEmail("   "), undefined);
});

test("isAdminLoginRateLimited blocks when one limit is reached", async () => {
  const { isAdminLoginRateLimited } = await import("@/lib/auth/admin-login-rate-limit");

  assert.equal(isAdminLoginRateLimited({ ipAttempts: 20, emailFailures: 0 }), true);
  assert.equal(isAdminLoginRateLimited({ ipAttempts: 1, emailFailures: 6 }), true);
  assert.equal(isAdminLoginRateLimited({ ipAttempts: 19, emailFailures: 5 }), false);
});
