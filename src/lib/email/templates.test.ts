import test from "node:test";
import assert from "node:assert/strict";

async function loadRenderer() {
  process.env.NEXT_PUBLIC_APP_NAME = "PP Studio";
  process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
  process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
  process.env.ADMIN_SESSION_SECRET = "test-secret-value-with-at-least-32-chars";
  process.env.ADMIN_OWNER_EMAIL = "owner@example.com";
  process.env.ADMIN_OWNER_PASSWORD = "change-me-owner";
  process.env.ADMIN_STAFF_EMAIL = "staff@example.com";
  process.env.ADMIN_STAFF_PASSWORD = "change-me-staff";
  process.env.EMAIL_DELIVERY_MODE = "log";

  return import("@/lib/email/templates");
}

test("renderEmailTemplate creates confirmation email with cancellation link", async () => {
  const { renderEmailTemplate } = await loadRenderer();
  const email = renderEmailTemplate(
    "booking-confirmation-v1",
    "Potvrzení rezervace: Luxusní péče",
    {
      bookingId: "clztestbooking1234",
      serviceName: "Luxusní péče",
      clientName: "Jana Nováková",
      scheduledStartsAt: "2026-04-20T08:00:00.000Z",
      scheduledEndsAt: "2026-04-20T09:00:00.000Z",
      cancellationUrl: "https://example.com/rezervace/storno/token123",
    },
  );

  assert.equal(email.subject, "Potvrzení rezervace: Luxusní péče");
  assert.match(email.text, /token123/);
  assert.match(email.html, /Zrušit rezervaci/);
});

test("renderEmailTemplate creates cancellation email with booking reference", async () => {
  const { renderEmailTemplate } = await loadRenderer();
  const email = renderEmailTemplate(
    "booking-cancelled-v1",
    "Storno potvrzeno: Luxusní péče",
    {
      bookingId: "clztestbooking5678",
      serviceName: "Luxusní péče",
      clientName: "Jana Nováková",
      scheduledStartsAt: "2026-04-20T08:00:00.000Z",
      scheduledEndsAt: "2026-04-20T09:00:00.000Z",
    },
  );

  assert.equal(email.subject, "Storno potvrzeno: Luxusní péče");
  assert.match(email.text, /5678/i);
  assert.match(email.html, /Rezervace byla zrušena/);
});
