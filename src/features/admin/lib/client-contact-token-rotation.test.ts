import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";

test("email rotace rozlišuje normalizovaný e-mail od změny jména nebo telefonu", async () => {
  const { getBookingIdsWithChangedEmailSnapshot, hasClientEmailChanged } = await import("./client-contact-token-rotation");

  assert.equal(hasClientEmailChanged(" Jana@Example.com ", "jana@example.com"), false);
  assert.equal(hasClientEmailChanged("jana@example.com", "jana2@example.com"), true);
  assert.equal(hasClientEmailChanged("jana@example.com", null), true);
  assert.equal(hasClientEmailChanged(null, null), false);
  assert.equal(hasClientEmailChanged("  ", null), false);

  assert.deepEqual(
    getBookingIdsWithChangedEmailSnapshot(
      [
        { id: "booking-old-snapshot", clientEmailSnapshot: "B@example.com" },
        { id: "booking-current-snapshot", clientEmailSnapshot: " A@example.com " },
        { id: "booking-no-email", clientEmailSnapshot: "" },
      ],
      "a@example.com",
    ),
    ["booking-old-snapshot", "booking-no-email"],
  );
  assert.deepEqual(
    getBookingIdsWithChangedEmailSnapshot(
      [
        { id: "booking-removed-email", clientEmailSnapshot: "B@example.com" },
        { id: "booking-empty-snapshot", clientEmailSnapshot: "" },
        { id: "booking-whitespace-snapshot", clientEmailSnapshot: "  " },
      ],
      null,
    ),
    ["booking-removed-email"],
  );
});
