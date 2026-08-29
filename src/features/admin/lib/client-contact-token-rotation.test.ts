import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";

test("email rotace rozlišuje normalizovaný e-mail od změny jména nebo telefonu", async () => {
  const { hasClientEmailChanged } = await import("./client-contact-token-rotation");

  assert.equal(hasClientEmailChanged(" Jana@Example.com ", "jana@example.com"), false);
  assert.equal(hasClientEmailChanged("jana@example.com", "jana2@example.com"), true);
  assert.equal(hasClientEmailChanged("jana@example.com", null), true);
  assert.equal(hasClientEmailChanged(null, null), false);
});
