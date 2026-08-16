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

dbTest("Resend reconciliation zpracuje dříve uložené UNMATCHED eventy právě jednou", async () => {
  const [{ prisma }, { applyResendWebhookEvent, reconcileUnmatchedResendWebhookEvents }] = await Promise.all([
    import("@/lib/prisma"),
    import("@/lib/email/resend-webhooks"),
  ]);
  const seed = randomUUID();
  const messageId = `resend-reconcile-${seed}`;
  const eventIds = [`msg_sent_${seed}`, `msg_bounce_${seed}`, `msg_complaint_${seed}`];
  const notifications: string[] = [];
  const notifyDeliveryIssue = async ({ emailLogId, emailType }: { emailLogId: string; emailType: string }) => {
    notifications.push(`${emailLogId}:${emailType}`);
  };
  let emailLogId: string | null = null;

  try {
    for (const [index, event] of [
      { type: "email.sent", created_at: "2026-08-16T10:00:00.000Z", data: { email_id: messageId } },
      { type: "email.bounced", created_at: "2026-08-16T10:01:00.000Z", data: { email_id: messageId } },
      { type: "email.complained", created_at: "2026-08-16T10:02:00.000Z", data: { email_id: messageId } },
    ].entries()) {
      const result = await applyResendWebhookEvent({ event, providerEventId: eventIds[index]!, notifyDeliveryIssue });
      assert.equal(result.outcome, "UNMATCHED");
    }

    const emailLog = await createEmailLog(messageId);
    emailLogId = emailLog.id;
    const concurrent = await Promise.all([
      reconcileUnmatchedResendWebhookEvents(messageId, notifyDeliveryIssue),
      reconcileUnmatchedResendWebhookEvents(messageId, notifyDeliveryIssue),
    ]);
    const [storedLog, storedEvents] = await Promise.all([
      prisma.emailLog.findUniqueOrThrow({ where: { id: emailLog.id } }),
      prisma.emailProviderWebhookEvent.findMany({ where: { providerEventId: { in: eventIds } } }),
    ]);

    assert.equal(concurrent.reduce((sum, result) => sum + result.reconciled, 0), 3);
    assert.equal(storedLog.trackingLastEvent, "email.complained");
    assert.equal(storedLog.trackingBouncedAt?.toISOString(), "2026-08-16T10:01:00.000Z");
    assert.equal(storedLog.trackingComplainedAt?.toISOString(), "2026-08-16T10:02:00.000Z");
    assert.ok(storedEvents.every((event) => event.outcome === "RECONCILED"));
    assert.deepEqual(notifications.sort(), [
      `${emailLog.id}:email.bounced`,
      `${emailLog.id}:email.complained`,
    ]);

    const duplicate = await applyResendWebhookEvent({
      event: { type: "email.bounced", created_at: "2026-08-16T10:01:00.000Z", data: { email_id: messageId } },
      providerEventId: eventIds[1]!, notifyDeliveryIssue,
    });
    assert.equal(duplicate.duplicate, true);
    assert.equal(notifications.length, 2);
  } finally {
    await prisma.emailProviderWebhookEvent.deleteMany({ where: { providerEventId: { in: eventIds } } });
    if (emailLogId) await prisma.emailLog.delete({ where: { id: emailLogId } });
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

dbTest("resend po opravě kontaktu zachová bounce audit původního logu a založí nový chain", async () => {
  const [{ prisma }, { buildResendEmailLogCreateInput, resolveEmailLogRecipientFromContact }] = await Promise.all([
    import("@/lib/prisma"),
    import("@/features/admin/actions/email-log-action-helpers"),
  ]);
  const seed = randomUUID();
  const oldEmail = `petra-${seed}@seznam.dz`;
  const currentEmail = `petra-${seed}@seznam.cz`;
  const client = await prisma.client.create({
    data: { fullName: `Resend audit ${seed}`, email: oldEmail },
  });
  const root = await prisma.emailLog.create({
    data: {
      clientId: client.id,
      type: EmailLogType.BOOKING_CONFIRMED,
      status: EmailLogStatus.SENT,
      recipientEmail: oldEmail,
      subject: "Rezervace potvrzena",
      templateKey: "booking-approved-v1",
      trackingBouncedAt: new Date("2026-08-16T09:00:00.000Z"),
    },
  });
  const unrelatedLifecycleLog = await prisma.emailLog.create({
    data: {
      clientId: client.id,
      type: EmailLogType.BOOKING_RECEIVED,
      status: EmailLogStatus.SENT,
      recipientEmail: oldEmail,
      subject: "Rezervace přijata",
      templateKey: "booking-confirmation-v1",
    },
  });

  try {
    await prisma.client.update({ where: { id: client.id }, data: { email: currentEmail } });
    const updatedClient = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    const recipientEmail = resolveEmailLogRecipientFromContact({
      clientEmail: updatedClient.email,
      bookingClientEmailSnapshot: null,
    });
    assert.equal(recipientEmail, currentEmail);

    const resend = await prisma.emailLog.create({
      data: buildResendEmailLogCreateInput({
        resendOfId: root.id,
        resendRootId: root.id,
        bookingId: root.bookingId,
        clientId: root.clientId,
        actionTokenId: root.actionTokenId,
        type: root.type,
        recipientEmail: recipientEmail!,
        subject: root.subject,
        templateKey: root.templateKey,
        payload: root.payload,
      }),
    });
    const [storedRoot, storedResend, storedUnrelatedLifecycleLog] = await Promise.all([
      prisma.emailLog.findUniqueOrThrow({ where: { id: root.id } }),
      prisma.emailLog.findUniqueOrThrow({ where: { id: resend.id } }),
      prisma.emailLog.findUniqueOrThrow({ where: { id: unrelatedLifecycleLog.id } }),
    ]);

    assert.equal(storedRoot.recipientEmail, oldEmail);
    assert.ok(storedRoot.trackingBouncedAt);
    assert.equal(storedResend.recipientEmail, currentEmail);
    assert.equal(storedResend.status, EmailLogStatus.PENDING);
    assert.equal(storedResend.resendOfId, root.id);
    assert.equal(storedResend.resendRootId, root.id);
    assert.equal(storedUnrelatedLifecycleLog.recipientEmail, oldEmail);
  } finally {
    await prisma.emailLog.deleteMany({ where: { id: { in: [unrelatedLifecycleLog.id] } } });
    await prisma.emailLog.deleteMany({ where: { resendOfId: root.id } });
    await prisma.emailLog.delete({ where: { id: root.id } });
    await prisma.client.delete({ where: { id: client.id } });
  }
});

dbTest("terminální failed retry zachová audit a doručený navazující resend uzavře incident", async () => {
  const [{ prisma }, { buildResendEmailLogCreateInput }, { applyResendWebhookEvent }, { getUnresolvedEmailDeliveryFailureWhere }] = await Promise.all([
    import("@/lib/prisma"),
    import("@/features/admin/actions/email-log-action-helpers"),
    import("@/lib/email/resend-webhooks"),
    import("@/lib/email/incidents"),
  ]);
  const seed = randomUUID();
  const root = await prisma.emailLog.create({
    data: {
      type: EmailLogType.GENERIC,
      status: EmailLogStatus.FAILED,
      attemptCount: 3,
      recipientEmail: `failed-root-${seed}@example.test`,
      subject: "Terminálně selhaný e-mail",
      templateKey: "webhook-test",
      errorMessage: "Původní transportní chyba",
    },
  });
  const deliveredMessageId = `resend-terminal-delivered-${seed}`;
  const eventId = `msg_terminal_chain_${seed}`;

  try {
    const firstResend = await prisma.emailLog.create({
      data: buildResendEmailLogCreateInput({
        resendOfId: root.id,
        resendRootId: root.id,
        bookingId: root.bookingId,
        clientId: root.clientId,
        actionTokenId: root.actionTokenId,
        type: root.type,
        recipientEmail: root.recipientEmail,
        subject: root.subject,
        templateKey: root.templateKey,
        payload: root.payload,
      }),
    });
    const storedRootAfterRetry = await prisma.emailLog.findUniqueOrThrow({ where: { id: root.id } });

    assert.equal(storedRootAfterRetry.status, EmailLogStatus.FAILED);
    assert.equal(storedRootAfterRetry.errorMessage, "Původní transportní chyba");
    assert.equal(firstResend.status, EmailLogStatus.PENDING);
    assert.equal(firstResend.resendOfId, root.id);
    assert.equal(firstResend.resendRootId, root.id);
    assert.equal(await prisma.emailLog.count({ where: { AND: [{ id: root.id }, getUnresolvedEmailDeliveryFailureWhere()] } }), 1);

    await prisma.emailLog.update({
      where: { id: firstResend.id },
      data: { status: EmailLogStatus.SENT, sentAt: new Date(), provider: "resend", providerMessageId: `resend-terminal-sent-${seed}` },
    });
    const rootAfterSentResend = await prisma.emailLog.findUniqueOrThrow({ where: { id: root.id } });
    assert.equal(rootAfterSentResend.incidentResolvedAt, null);
    assert.equal(rootAfterSentResend.incidentResolvedByEmailLogId, null);

    const failedResend = await prisma.emailLog.update({
      where: { id: firstResend.id },
      data: { status: EmailLogStatus.FAILED, errorMessage: "Druhý transportní fail" },
    });
    const deliveredResend = await prisma.emailLog.create({
      data: buildResendEmailLogCreateInput({
        resendOfId: failedResend.id,
        resendRootId: failedResend.resendRootId ?? failedResend.id,
        bookingId: failedResend.bookingId,
        clientId: failedResend.clientId,
        actionTokenId: failedResend.actionTokenId,
        type: failedResend.type,
        recipientEmail: failedResend.recipientEmail,
        subject: failedResend.subject,
        templateKey: failedResend.templateKey,
        payload: failedResend.payload,
      }),
    });
    await prisma.emailLog.update({
      where: { id: deliveredResend.id },
      data: { status: EmailLogStatus.SENT, sentAt: new Date(), provider: "resend", providerMessageId: deliveredMessageId },
    });

    await applyResendWebhookEvent({
      event: { type: "email.delivered", created_at: "2026-08-16T12:00:00.000Z", data: { email_id: deliveredMessageId } },
      providerEventId: eventId,
    });
    const [storedRoot, storedFailedResend, storedDeliveredResend] = await Promise.all([
      prisma.emailLog.findUniqueOrThrow({ where: { id: root.id } }),
      prisma.emailLog.findUniqueOrThrow({ where: { id: firstResend.id } }),
      prisma.emailLog.findUniqueOrThrow({ where: { id: deliveredResend.id } }),
    ]);

    assert.equal(storedRoot.status, EmailLogStatus.FAILED);
    assert.equal(storedRoot.errorMessage, "Původní transportní chyba");
    assert.equal(storedFailedResend.status, EmailLogStatus.FAILED);
    assert.equal(storedDeliveredResend.trackingDeliveredAt?.toISOString(), "2026-08-16T12:00:00.000Z");
    assert.ok(storedRoot.incidentResolvedAt);
    assert.equal(storedRoot.incidentResolvedByEmailLogId, deliveredResend.id);
    assert.equal(await prisma.emailLog.count({ where: { AND: [{ id: { in: [root.id, firstResend.id] } }, getUnresolvedEmailDeliveryFailureWhere()] } }), 0);
  } finally {
    await prisma.emailProviderWebhookEvent.deleteMany({ where: { providerEventId: eventId } });
    await prisma.emailLog.deleteMany({ where: { resendRootId: root.id } });
    await prisma.emailLog.delete({ where: { id: root.id } });
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
