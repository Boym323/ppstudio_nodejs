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

test("resend invite admin route rejects unsafe origin before mutation", async () => {
  const { POST } = await import("./route");
  const response = await POST(new Request("https://example.com/api/admin/users/resend-invite", {
    method: "POST",
    headers: {
      host: "example.com",
      origin: "https://evil.example",
    },
    body: JSON.stringify({ userId: "admin-1" }),
  }));

  assert.equal(response.status, 403);
});
