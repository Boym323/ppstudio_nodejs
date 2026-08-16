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

test("deriveTrackingState returns delivered/opened/clicked priorities", async () => {
  const { deriveTrackingState } = await import("@/lib/email/resend-webhooks");

  const delivered = deriveTrackingState({
    trackingLastEvent: null,
    trackingClickedAt: null,
    trackingOpenedAt: null,
    trackingDeliveredAt: new Date("2026-05-24T10:00:00.000Z"),
    trackingBouncedAt: null,
    trackingComplainedAt: null,
    trackingFailedAt: null,
    trackingSuppressedAt: null,
  });

  assert.equal(delivered.label, "Doručeno");

  const opened = deriveTrackingState({
    trackingLastEvent: null,
    trackingClickedAt: null,
    trackingOpenedAt: new Date("2026-05-24T10:01:00.000Z"),
    trackingDeliveredAt: new Date("2026-05-24T10:00:00.000Z"),
    trackingBouncedAt: null,
    trackingComplainedAt: null,
    trackingFailedAt: null,
    trackingSuppressedAt: null,
  });

  assert.equal(opened.label, "Doručeno - otevřeno");

  const clicked = deriveTrackingState({
    trackingLastEvent: null,
    trackingClickedAt: new Date("2026-05-24T10:02:00.000Z"),
    trackingOpenedAt: new Date("2026-05-24T10:01:00.000Z"),
    trackingDeliveredAt: new Date("2026-05-24T10:00:00.000Z"),
    trackingBouncedAt: null,
    trackingComplainedAt: null,
    trackingFailedAt: null,
    trackingSuppressedAt: null,
  });

  assert.equal(clicked.label, "Doručeno - kliknuto");
});

test("deriveTrackingState marks hard delivery issues as failed", async () => {
  const { deriveTrackingState } = await import("@/lib/email/resend-webhooks");

  const bounced = deriveTrackingState({
    trackingLastEvent: null,
    trackingClickedAt: null,
    trackingOpenedAt: null,
    trackingDeliveredAt: null,
    trackingBouncedAt: new Date("2026-05-24T10:00:00.000Z"),
    trackingComplainedAt: null,
    trackingFailedAt: null,
    trackingSuppressedAt: null,
  });

  assert.equal(bounced.value, "failed");
  assert.equal(bounced.label, "Nedoručeno - odmítnuto cílovým serverem (bounce)");

  const suppressed = deriveTrackingState({
    trackingLastEvent: null,
    trackingClickedAt: null,
    trackingOpenedAt: null,
    trackingDeliveredAt: null,
    trackingBouncedAt: null,
    trackingComplainedAt: null,
    trackingFailedAt: null,
    trackingSuppressedAt: new Date("2026-05-24T10:00:00.000Z"),
  });

  assert.equal(suppressed.value, "failed");
  assert.equal(suppressed.label, "Nedoručeno - blokováno (suppressed)");
});

test("deriveTrackingState reflects sent and delivery_delayed webhook events", async () => {
  const { deriveTrackingState } = await import("@/lib/email/resend-webhooks");

  const sent = deriveTrackingState({
    trackingLastEvent: "email.sent",
    trackingClickedAt: null,
    trackingOpenedAt: null,
    trackingDeliveredAt: null,
    trackingBouncedAt: null,
    trackingComplainedAt: null,
    trackingFailedAt: null,
    trackingSuppressedAt: null,
  });

  assert.equal(sent.value, "processing");
  assert.equal(sent.label, "Odesláno - čeká na doručení");

  const delayed = deriveTrackingState({
    trackingLastEvent: "email.delivery_delayed",
    trackingClickedAt: null,
    trackingOpenedAt: null,
    trackingDeliveredAt: null,
    trackingBouncedAt: null,
    trackingComplainedAt: null,
    trackingFailedAt: null,
    trackingSuppressedAt: null,
  });

  assert.equal(delayed.value, "retry");
  assert.equal(delayed.label, "Doručení zpožděno");
});
