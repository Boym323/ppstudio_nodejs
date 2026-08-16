import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { EmailLogStatus, EmailLogType } from "@prisma/client";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "change-me-owner";
process.env.ADMIN_STAFF_EMAIL ??= "staff@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "change-me-staff";
process.env.EMAIL_DELIVERY_MODE ??= "log";

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

async function createEmailLog(providerMessageId: string) {
  const { prisma } = await import("@/lib/prisma");

  return prisma.emailLog.create({
    data: {
      type: EmailLogType.GENERIC,
      status: EmailLogStatus.SENT,
      recipientEmail: `${providerMessageId}@example.test`,
      subject: "Webhook test",
      templateKey: "webhook-test",
      provider: "resend",
      providerMessageId,
    },
  });
}

dbTest("Resend webhook ukládá event atomicky a deduplikuje opakované i souběžné doručení", async () => {
  const [{ prisma }, { applyResendWebhookEvent }] = await Promise.all([
    import("@/lib/prisma"),
    import("@/lib/email/resend-webhooks"),
  ]);
  const seed = randomUUID();
  const messageId = `resend-message-${seed}`;
  const eventId = `msg_${seed}`;
  const event = {
    type: "email.bounced",
    created_at: "2026-08-16T10:00:00.000Z",
    data: { email_id: messageId },
  };
  const notifications: string[] = [];
  const notifyDeliveryIssue = async ({ emailLogId }: { emailLogId: string }) => {
    notifications.push(emailLogId);
  };
  const emailLog = await createEmailLog(messageId);

  try {
    const first = await applyResendWebhookEvent({ event, providerEventId: eventId, notifyDeliveryIssue });
    const duplicate = await applyResendWebhookEvent({ event, providerEventId: eventId, notifyDeliveryIssue });
    const [storedLog, storedEvents] = await Promise.all([
      prisma.emailLog.findUniqueOrThrow({ where: { id: emailLog.id } }),
      prisma.emailProviderWebhookEvent.findMany({ where: { providerEventId: eventId } }),
    ]);

    assert.equal(first.duplicate, false);
    assert.equal(duplicate.duplicate, true);
    assert.ok(storedLog.trackingBouncedAt);
    assert.equal(storedEvents.length, 1);
    assert.equal(storedEvents[0]?.outcome, "MATCHED");
    assert.equal(notifications.length, 1);

    const concurrentEventId = `msg_concurrent_${seed}`;
    const concurrent = await Promise.all([
      applyResendWebhookEvent({ event, providerEventId: concurrentEventId, notifyDeliveryIssue }),
      applyResendWebhookEvent({ event, providerEventId: concurrentEventId, notifyDeliveryIssue }),
    ]);
    const concurrentEvents = await prisma.emailProviderWebhookEvent.count({ where: { providerEventId: concurrentEventId } });

    assert.equal(concurrent.filter((result) => !result.duplicate).length, 1);
    assert.equal(concurrent.filter((result) => result.duplicate).length, 1);
    assert.equal(concurrentEvents, 1);
    assert.equal(notifications.length, 1);
  } finally {
    await prisma.emailProviderWebhookEvent.deleteMany({ where: { providerEventId: { in: [eventId, `msg_concurrent_${seed}`] } } });
    await prisma.emailLog.delete({ where: { id: emailLog.id } });
  }
});

dbTest("Resend webhook rozlišuje různé eventy a nededuplikuje podle provider message ID", async () => {
  const [{ prisma }, { applyResendWebhookEvent }] = await Promise.all([
    import("@/lib/prisma"),
    import("@/lib/email/resend-webhooks"),
  ]);
  const seed = randomUUID();
  const firstMessageId = `resend-first-${seed}`;
  const secondMessageId = `resend-second-${seed}`;
  const sharedMessageId = `resend-shared-${seed}`;
  const eventIds = [`msg_first_${seed}`, `msg_second_${seed}`, `msg_delivered_${seed}`, `msg_opened_${seed}`];
  const logs = await Promise.all([createEmailLog(firstMessageId), createEmailLog(secondMessageId), createEmailLog(sharedMessageId)]);

  try {
    const results = await Promise.all([
      applyResendWebhookEvent({ event: { type: "email.bounced", created_at: "2026-08-16T10:00:00.000Z", data: { email_id: firstMessageId } }, providerEventId: eventIds[0] }),
      applyResendWebhookEvent({ event: { type: "email.bounced", created_at: "2026-08-16T10:01:00.000Z", data: { email_id: secondMessageId } }, providerEventId: eventIds[1] }),
      applyResendWebhookEvent({ event: { type: "email.delivered", created_at: "2026-08-16T10:02:00.000Z", data: { email_id: sharedMessageId } }, providerEventId: eventIds[2] }),
      applyResendWebhookEvent({ event: { type: "email.opened", created_at: "2026-08-16T10:03:00.000Z", data: { email_id: sharedMessageId } }, providerEventId: eventIds[3] }),
    ]);
    const [first, second, shared, storedEventCount] = await Promise.all([
      prisma.emailLog.findUniqueOrThrow({ where: { id: logs[0].id } }),
      prisma.emailLog.findUniqueOrThrow({ where: { id: logs[1].id } }),
      prisma.emailLog.findUniqueOrThrow({ where: { id: logs[2].id } }),
      prisma.emailProviderWebhookEvent.count({ where: { providerEventId: { in: eventIds } } }),
    ]);

    assert.ok(results.every((result) => !result.duplicate && result.matched));
    assert.ok(first.trackingBouncedAt);
    assert.ok(second.trackingBouncedAt);
    assert.ok(shared.trackingDeliveredAt);
    assert.ok(shared.trackingOpenedAt);
    assert.equal(storedEventCount, 4);
  } finally {
    await prisma.emailProviderWebhookEvent.deleteMany({ where: { providerEventId: { in: eventIds } } });
    await prisma.emailLog.deleteMany({ where: { id: { in: logs.map((log) => log.id) } } });
  }
});

dbTest("doručený resend idempotentně uzavře celý explicitní incident chain bez přepisu bounce historie", async () => {
  const [{ prisma }, { applyResendWebhookEvent }, { getUnresolvedEmailDeliveryFailureWhere }] = await Promise.all([
    import("@/lib/prisma"),
    import("@/lib/email/resend-webhooks"),
    import("@/lib/email/incidents"),
  ]);
  const seed = randomUUID();
  const root = await createEmailLog(`resend-root-${seed}`);
  await prisma.emailLog.update({
    where: { id: root.id },
    data: { trackingBouncedAt: new Date("2026-08-16T09:00:00.000Z") },
  });
  const middle = await prisma.emailLog.create({
    data: {
      type: EmailLogType.GENERIC, status: EmailLogStatus.SENT, recipientEmail: `middle-${seed}@example.test`, subject: "Resend", templateKey: "webhook-test", provider: "resend", providerMessageId: `resend-middle-${seed}`,
      resendOfId: root.id, resendRootId: root.id, trackingBouncedAt: new Date("2026-08-16T10:00:00.000Z"),
    },
  });
  const deliveredMessageId = `resend-delivered-${seed}`;
  const delivered = await prisma.emailLog.create({
    data: {
      type: EmailLogType.GENERIC, status: EmailLogStatus.SENT, recipientEmail: `delivered-${seed}@example.test`, subject: "Resend", templateKey: "webhook-test", provider: "resend", providerMessageId: deliveredMessageId,
      resendOfId: middle.id, resendRootId: root.id,
    },
  });
  const eventId = `msg_delivered_chain_${seed}`;

  try {
    assert.equal(await prisma.emailLog.count({ where: { AND: [{ id: { in: [root.id, middle.id, delivered.id] } }, getUnresolvedEmailDeliveryFailureWhere()] } }) > 0, true);
    const event = { type: "email.delivered", created_at: "2026-08-16T11:00:00.000Z", data: { email_id: deliveredMessageId } };
    const [first, duplicate] = await Promise.all([
      applyResendWebhookEvent({ event, providerEventId: eventId }),
      applyResendWebhookEvent({ event, providerEventId: eventId }),
    ]);
    const [storedRoot, storedMiddle, storedDelivered] = await Promise.all([
      prisma.emailLog.findUniqueOrThrow({ where: { id: root.id } }),
      prisma.emailLog.findUniqueOrThrow({ where: { id: middle.id } }),
      prisma.emailLog.findUniqueOrThrow({ where: { id: delivered.id } }),
    ]);

    assert.equal([first, duplicate].filter((result) => !result.duplicate).length, 1);
    assert.ok(storedRoot.incidentResolvedAt);
    assert.equal(storedRoot.incidentResolvedByEmailLogId, delivered.id);
    assert.ok(storedRoot.trackingBouncedAt);
    assert.ok(storedMiddle.trackingBouncedAt);
    assert.ok(storedDelivered.trackingDeliveredAt);
    assert.equal(await prisma.emailLog.count({ where: { AND: [{ id: { in: [root.id, middle.id, delivered.id] } }, getUnresolvedEmailDeliveryFailureWhere()] } }), 0);
  } finally {
    await prisma.emailProviderWebhookEvent.deleteMany({ where: { providerEventId: eventId } });
    await prisma.emailLog.deleteMany({ where: { id: { in: [delivered.id, middle.id, root.id] } } });
  }
});
