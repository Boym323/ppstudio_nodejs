import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";

test("rate limit aktivace pozvánky blokuje desátý pokus", async () => {
  const { isAdminInviteActivationRateLimited } = await import("./admin-invite-activation-rate-limit");

  assert.equal(isAdminInviteActivationRateLimited(9), false);
  assert.equal(isAdminInviteActivationRateLimited(10), true);
});

test("metadata aktivace pozvánky používá pouze důvěryhodnou IP proxy", async () => {
  const { getAdminInviteActivationAttemptMetadata } = await import("./admin-invite-activation-rate-limit");

  const trustedMetadata = getAdminInviteActivationAttemptMetadata(new Headers({
    "x-real-ip": "203.0.113.5",
    "user-agent": "test-agent",
  }));
  const untrustedMetadata = getAdminInviteActivationAttemptMetadata(new Headers({
    "x-forwarded-for": "203.0.113.5",
  }));

  assert.ok(trustedMetadata.ipHash);
  assert.equal(trustedMetadata.userAgent, "test-agent");
  assert.equal(untrustedMetadata.ipHash, undefined);
});
