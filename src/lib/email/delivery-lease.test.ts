import assert from "node:assert/strict";
import test from "node:test";

import { BookingStatus, EmailAudience, EmailLogStatus, EmailLogType } from "@/generated/prisma/browser";

process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";

test("deliverEmailLog defers a busy lease and rejects finalization after booking generation changes", async (t) => {
  const startsAt = new Date("2030-01-07T09:00:00.000Z");
  const endsAt = new Date("2030-01-07T10:00:00.000Z");
  const emailLog = {
    id: "email-log-lease",
    status: EmailLogStatus.PENDING,
    attemptCount: 1,
    recipientEmail: "client@example.com",
    subject: "Rezervace potvrzena",
    templateKey: "booking-approved-v1",
    payload: {
      serviceId: "service-1",
      scheduledStartsAt: startsAt.toISOString(),
      scheduledEndsAt: endsAt.toISOString(),
    },
    processingStartedAt: new Date("2030-01-07T08:00:00.000Z"),
    processingToken: "processing-token",
    type: EmailLogType.BOOKING_CONFIRMED,
    audience: EmailAudience.CLIENT,
    bookingId: "booking-1",
    communicationGeneration: 0,
  };
  const booking = {
    status: BookingStatus.CONFIRMED,
    clientEmailSnapshot: "client@example.com",
    communicationGeneration: 0,
    clientDeliveryLeaseToken: "other-worker",
    clientDeliveryLeaseExpiresAt: new Date("2030-01-07T09:05:00.000Z"),
    reminder24hSentAt: null,
    scheduledStartsAt: startsAt,
    scheduledEndsAt: endsAt,
    serviceId: "service-1",
  };
  let leaseBusy = true;
  let releaseCount = 0;
  const updates: Array<{ where: Record<string, unknown>; data: Record<string, unknown> }> = [];
  const updateMany = async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
    updates.push(args);
    return { count: 1 };
  };
  const tx = {
    $queryRaw: async () => [{ status: EmailLogStatus.PENDING, processingToken: "processing-token" }],
    booking: {
      findUnique: async () => booking,
      updateMany: async () => ({ count: 1 }),
    },
    emailLog: {
      findUnique: async () => ({ status: EmailLogStatus.PENDING, processingToken: "processing-token" }),
      updateMany,
    },
  };
  const prisma = {
    emailLog: { findUnique: async () => emailLog, updateMany },
    booking: { findUnique: async () => booking },
    $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
  };

  t.mock.module("@/lib/prisma", { exports: { prisma } });
  t.mock.module("@/lib/email/templates", {
    exports: {
      renderEmailTemplate: async () => ({ subject: "subject", text: "text", html: "<p>text</p>", attachments: [] }),
    },
  });
  t.mock.module("@/lib/email/provider", {
    exports: { sendEmail: async () => ({ provider: "log", messageId: "message-1" }) },
  });
  t.mock.module("@/lib/email/retry", {
    exports: { getEmailDeliveryRetryDelayMs: () => 1000, getMaxEmailDeliveryAttempts: () => 3 },
  });
  t.mock.module("@/lib/email/resend-webhooks", {
    exports: { reconcileUnmatchedResendWebhookEvents: async () => undefined },
  });
  t.mock.module("@/lib/notifications/pushover-core", {
    exports: { sendOwnerEmailFailurePushover: async () => undefined },
  });
  t.mock.module("@/lib/email/booking-delivery-fence", {
    exports: {
      CLIENT_DELIVERY_LEASE_BUSY_BUFFER_MS: 1000,
      getEmailWorkerStaleBefore: () => new Date(0),
      hasActiveClientDeliveryLease: () => leaseBusy,
      acquireClientDeliveryLease: async () => true,
      releaseClientDeliveryLease: async () => { releaseCount += 1; },
    },
  });

  const { deliverEmailLog } = await import("./delivery");
  let sends = 0;
  const busyResult = await deliverEmailLog(emailLog.id, "processing-token", {
    sendEmail: async () => {
      sends += 1;
      return { provider: "log", messageId: "busy-should-not-send" };
    },
  });
  assert.equal(busyResult.status, "deferred");
  assert.equal(sends, 0);
  assert.equal(updates.at(-1)?.data.status, EmailLogStatus.PENDING);
  assert.equal(updates.at(-1)?.data.processingToken, null);

  leaseBusy = false;
  const finalizationResult = await deliverEmailLog(emailLog.id, "processing-token", {
    sendEmail: async () => {
      sends += 1;
      return { provider: "log", messageId: "accepted-by-provider" };
    },
    beforeDeliveryFinalization: () => {
      booking.communicationGeneration = 1;
    },
  });

  assert.equal(finalizationResult.status, "deferred");
  assert.equal(sends, 1);
  assert.equal(releaseCount, 1);
  assert.equal(updates.at(-1)?.data.status, EmailLogStatus.PENDING);
  assert.equal(updates.at(-1)?.data.processingToken, null);
  assert.match(String(updates.at(-1)?.data.errorMessage), /lease vypršel/i);
});
