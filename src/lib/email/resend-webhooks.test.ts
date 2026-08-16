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

test("deriveTrackingState rozlišuje spam complaint od nedoručení", async () => {
  const { deriveTrackingState } = await import("@/lib/email/resend-webhooks");

  const complained = deriveTrackingState({
    trackingLastEvent: "email.complained",
    trackingClickedAt: null,
    trackingOpenedAt: null,
    trackingDeliveredAt: new Date("2026-05-24T10:00:00.000Z"),
    trackingBouncedAt: null,
    trackingComplainedAt: new Date("2026-05-24T10:02:00.000Z"),
    trackingFailedAt: null,
    trackingSuppressedAt: null,
  });

  assert.equal(complained.value, "retry");
  assert.equal(complained.label, "Nahlášeno jako spam");
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

test("applyResendWebhookEvent records email.bounced as a provider delivery issue", async () => {
  const [{ prisma }, { applyResendWebhookEvent }] = await Promise.all([
    import("@/lib/prisma"),
    import("@/lib/email/resend-webhooks"),
  ]);
  const originalFindFirst = prisma.emailLog.findFirst;
  const originalUpdate = prisma.emailLog.update;
  const originalTransaction = prisma.$transaction;
  const originalWebhookCreateMany = prisma.emailProviderWebhookEvent.createMany;
  const originalWebhookUpdateMany = prisma.emailProviderWebhookEvent.updateMany;
  const updates: unknown[] = [];
  const events: unknown[] = [];

  prisma.emailLog.findFirst = (async () => ({
    id: "email-log-bounce",
    bookingId: "booking-bounce",
    trackingLastEventAt: null,
    trackingDeliveredAt: null,
    trackingOpenedAt: null,
    trackingClickedAt: null,
    trackingBouncedAt: null,
    trackingComplainedAt: null,
    trackingFailedAt: null,
    trackingSuppressedAt: null,
  })) as typeof prisma.emailLog.findFirst;
  prisma.emailLog.update = (async (args) => {
    updates.push(args);
    return {};
  }) as typeof prisma.emailLog.update;
  prisma.emailProviderWebhookEvent.createMany = (async (args) => {
    events.push(args);
    return { count: 1 };
  }) as typeof prisma.emailProviderWebhookEvent.createMany;
  prisma.emailProviderWebhookEvent.updateMany = (async () => ({ count: 1 })) as typeof prisma.emailProviderWebhookEvent.updateMany;
  prisma.$transaction = (async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma)) as unknown as typeof prisma.$transaction;

  try {
    const result = await applyResendWebhookEvent({
      providerEventId: "msg_unit_bounce",
      event: {
        type: "email.bounced",
        created_at: "2026-08-16T10:00:00.000Z",
        data: { email_id: "provider-message-1" },
      },
    });

    assert.deepEqual(result, { matched: true, ignored: false, deliveryIssue: { emailLogId: "email-log-bounce", bookingId: "booking-bounce" }, duplicate: false });
    assert.deepEqual(updates, [{
      where: { id: "email-log-bounce" },
      data: {
        trackingLastEvent: "email.bounced",
        trackingLastEventAt: new Date("2026-08-16T10:00:00.000Z"),
        trackingBouncedAt: new Date("2026-08-16T10:00:00.000Z"),
      },
    }]);
    assert.equal(events.length, 1);
  } finally {
    prisma.emailLog.findFirst = originalFindFirst;
    prisma.emailLog.update = originalUpdate;
    prisma.emailProviderWebhookEvent.createMany = originalWebhookCreateMany;
    prisma.emailProviderWebhookEvent.updateMany = originalWebhookUpdateMany;
    prisma.$transaction = originalTransaction;
  }
});
