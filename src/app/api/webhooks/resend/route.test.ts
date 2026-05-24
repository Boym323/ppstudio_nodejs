import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL = "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "change-me-owner";
process.env.ADMIN_STAFF_EMAIL ??= "staff@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "change-me-staff";
process.env.EMAIL_DELIVERY_MODE ??= "log";

test("resend webhook route rejects request without svix headers", async () => {
  process.env.RESEND_WEBHOOK_SECRET = "whsec_test";
  const { POST } = await import("./route");

  const response = await POST(new Request("https://example.com/api/webhooks/resend", {
    method: "POST",
    body: JSON.stringify({ type: "email.sent" }),
    headers: {
      "content-type": "application/json",
    },
  }));

  assert.equal(response.status, 400);
});
