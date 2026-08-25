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

test("resend webhook route rejects an invalid Svix signature before processing", async () => {
  process.env.RESEND_WEBHOOK_SECRET = "whsec_test";
  const { POST } = await import("./route");

  const response = await POST(new Request("https://example.com/api/webhooks/resend", {
    method: "POST",
    body: JSON.stringify({
      type: "email.bounced",
      created_at: "2026-08-16T10:00:00.000Z",
      data: { email_id: "provider-message-invalid-signature" },
    }),
    headers: {
      "content-type": "application/json",
      "svix-id": "msg_invalid_signature",
      "svix-timestamp": "1786874400",
      "svix-signature": "v1,invalid",
    },
  }));

  assert.equal(response.status, 400);
});

test("resend webhook route odmítne deklarované nadlimitní body bez čtení streamu", async () => {
  process.env.RESEND_WEBHOOK_SECRET = "whsec_test";
  const { POST, RESEND_WEBHOOK_MAX_BODY_BYTES } = await import("./route");
  let pulls = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls += 1;
      controller.enqueue(new Uint8Array([123, 125]));
      controller.close();
    },
  });
  const request = new Request("https://example.com/api/webhooks/resend", {
    method: "POST",
    body,
    duplex: "half",
    headers: {
      "content-length": String(RESEND_WEBHOOK_MAX_BODY_BYTES + 1),
      "svix-id": "msg_too_large",
      "svix-timestamp": "1786874400",
      "svix-signature": "v1,invalid",
    },
  } as RequestInit & { duplex: "half" });
  const response = await POST(request);

  assert.equal(response.status, 413);
  assert.equal(request.bodyUsed, false);
  assert.ok(pulls <= 1);
  assert.deepEqual(await response.json(), { status: "too_large" });
});

test("resend webhook route vynutí limit i při lživě malém Content-Length", async () => {
  process.env.RESEND_WEBHOOK_SECRET = "whsec_test";
  const { POST, RESEND_WEBHOOK_MAX_BODY_BYTES } = await import("./route");
  const request = new Request("https://example.com/api/webhooks/resend", {
    method: "POST",
    body: new Uint8Array(RESEND_WEBHOOK_MAX_BODY_BYTES + 1),
    headers: {
      "content-length": "1",
      "svix-id": "msg_stream_too_large",
      "svix-timestamp": "1786874400",
      "svix-signature": "v1,invalid",
    },
  });

  const response = await POST(request);

  assert.equal(response.status, 413);
});

test("bounded raw-body reader zachová přesné bajty", async () => {
  const { readBoundedRawBody } = await import("./route");
  const bytes = Uint8Array.from([0, 255, 195, 40, 10, 123, 125]);
  const request = new Request("https://example.com/api/webhooks/resend", {
    method: "POST",
    body: bytes,
  });

  const payload = await readBoundedRawBody(request, bytes.byteLength);

  assert.deepEqual([...payload], [...bytes]);
});
