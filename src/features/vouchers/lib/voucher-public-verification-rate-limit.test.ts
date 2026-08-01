import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";

test("veřejné ověření voucheru se zablokuje od desátého pokusu v okně", async () => {
  const { isVoucherPublicVerificationRateLimited } = await import("./voucher-public-verification-rate-limit");

  assert.equal(isVoucherPublicVerificationRateLimited(9), false);
  assert.equal(isVoucherPublicVerificationRateLimited(10), true);
  assert.equal(isVoucherPublicVerificationRateLimited(11), true);
});
