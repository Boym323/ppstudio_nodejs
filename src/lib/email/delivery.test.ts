import assert from "node:assert/strict";
import test from "node:test";

import {
  EmailAudience,
  EmailLogStatus,
  EmailLogType,
} from "@/generated/prisma/browser";

process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";

type DeliveryLog = {
  id: string;
  status: EmailLogStatus;
  attemptCount: number;
  recipientEmail: string;
  subject: string;
  templateKey: string;
  payload: null;
  processingStartedAt: Date | null;
  processingToken: string | null;
  type: EmailLogType;
  audience: EmailAudience;
  bookingId: string | null;
  communicationGeneration: number;
};

function createLog(overrides: Partial<DeliveryLog> = {}): DeliveryLog {
  return {
    id: "email-log-1",
    status: EmailLogStatus.PENDING,
    attemptCount: 1,
    recipientEmail: "client@example.com",
    subject: "Rezervace přijata",
    templateKey: "booking-confirmation-v1",
    payload: null,
    processingStartedAt: new Date("2026-08-17T08:00:00.000Z"),
    processingToken: "processing-token-1",
    type: EmailLogType.BOOKING_RECEIVED,
    audience: EmailAudience.ADMIN,
    bookingId: null,
    communicationGeneration: 0,
    ...overrides,
  };
}

function setupMocks(
  t: test.TestContext,
  options: {
    log?: DeliveryLog | null;
    updateMany?: (args: unknown) => Promise<{ count: number }>;
  } = {},
) {
  const updates: unknown[] = [];
  let currentLog = options.log === undefined ? createLog() : options.log;
  const db = {
    emailLog: {
      findUnique: async () => currentLog,
      updateMany: async (args: unknown) => {
        updates.push(args);
        return options.updateMany ? options.updateMany(args) : { count: 1 };
      },
    },
    booking: { findUnique: async () => null },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
      emailLog: {
        updateMany: async (args: unknown) => {
          updates.push(args);
          return options.updateMany ? options.updateMany(args) : { count: 1 };
        },
      },
    }),
  };

  t.mock.module("@/lib/prisma", { exports: { prisma: db } });
  t.mock.module("@/lib/email/templates", {
    exports: {
      renderEmailTemplate: async () => ({
        subject: "Rendered subject",
        text: "Rendered text",
        html: "<p>Rendered</p>",
        attachments: [],
      }),
    },
  });
  t.mock.module("@/lib/email/provider", {
    exports: { sendEmail: async () => ({ provider: "log", messageId: null }) },
  });
  t.mock.module("@/lib/email/retry", {
    exports: {
      getEmailDeliveryRetryDelayMs: () => 1000,
      getMaxEmailDeliveryAttempts: () => 3,
    },
  });
  t.mock.module("@/lib/email/resend-webhooks", {
    exports: { reconcileUnmatchedResendWebhookEvents: async () => undefined },
  });
  t.mock.module("@/lib/notifications/pushover-core", {
    exports: { sendOwnerEmailFailurePushover: async () => undefined },
  });

  return {
    updates,
    setLog(log: DeliveryLog | null) { currentLog = log; },
  };
}

test("deliverEmailLog handles missing, claimed, successful, and retryable jobs", async (t) => {
  const { updates, setLog } = setupMocks(t, { log: null });
  const { deliverEmailLog } = await import("./delivery");

  assert.deepEqual(await deliverEmailLog("missing", "token"), {
    status: "skipped",
    errorMessage: "Email log nebyl nalezen.",
  });

  setLog(createLog({ processingToken: "another-token" }));

  assert.deepEqual(await deliverEmailLog("email-log-1", "processing-token-1"), {
    status: "skipped",
  });

  setLog(createLog());
  const sent: unknown[] = [];

  const sentResult = await deliverEmailLog("email-log-1", "processing-token-1", {
    sendEmail: async (message) => {
      sent.push(message);
      return { provider: "log", messageId: "message-1" };
    },
  });

  assert.deepEqual(sentResult, { status: "sent" });
  assert.equal(sent.length, 1);
  assert.equal((sent[0] as { idempotencyKey: string }).idempotencyKey, "email-log/email-log-1");
  const update = updates.at(-1) as { where: { id: string; processingToken: string }; data: Record<string, unknown> };
  assert.equal(update.where.id, "email-log-1");
  assert.equal(update.where.processingToken, "processing-token-1");
  assert.equal(update.data.status, EmailLogStatus.SENT);
  assert.equal(update.data.provider, "log");
  assert.equal(update.data.providerMessageId, "message-1");
  assert.equal(update.data.processingToken, null);
  assert.equal(update.data.errorMessage, null);

  setLog(createLog());
  t.mock.method(console, "error", () => undefined);
  const retryResult = await deliverEmailLog("email-log-1", "processing-token-1", {
    sendEmail: async () => { throw new Error("provider unavailable"); },
  });

  assert.deepEqual(retryResult, {
    status: "failed",
    errorMessage: "provider unavailable",
  });
  const retryUpdate = updates.at(-1) as { where: { id: string }; data: Record<string, unknown> };
  assert.equal(retryUpdate.where.id, "email-log-1");
  assert.equal(retryUpdate.data.status, EmailLogStatus.PENDING);
  assert.equal(retryUpdate.data.processingToken, null);
  assert.equal(retryUpdate.data.processingStartedAt, null);
  assert.equal(retryUpdate.data.errorMessage, "provider unavailable");
  assert.ok(retryUpdate.data.nextAttemptAt instanceof Date);

  setLog(createLog({
    type: EmailLogType.BOOKING_CONFIRMED,
    audience: EmailAudience.CLIENT,
    bookingId: "booking-1",
  }));
  let staleEmailSent = false;
  const staleResult = await deliverEmailLog("email-log-1", "processing-token-1", {
    sendEmail: async () => {
      staleEmailSent = true;
      return { provider: "log" };
    },
  });
  assert.deepEqual(staleResult, {
    status: "skipped",
    errorMessage: "Booking no longer exists.",
  });
  assert.equal(staleEmailSent, false);
});
