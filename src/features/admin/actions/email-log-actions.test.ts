import assert from "node:assert/strict";
import test from "node:test";

import { EmailLogStatus, EmailLogType } from "@/generated/prisma/browser";

test("resolveEmailLogRecipientFromContact prefers client email and trims whitespace", async () => {
  const { resolveEmailLogRecipientFromContact } = await import("@/features/admin/actions/email-log-action-helpers");
  const resolved = resolveEmailLogRecipientFromContact({
    clientEmail: "  klientka@example.com ",
    bookingClientEmailSnapshot: "snapshot@example.com",
  });

  assert.equal(resolved, "klientka@example.com");
});

test("resolveEmailLogRecipientFromContact falls back to booking snapshot when client email is missing", async () => {
  const { resolveEmailLogRecipientFromContact } = await import("@/features/admin/actions/email-log-action-helpers");
  const resolved = resolveEmailLogRecipientFromContact({
    clientEmail: "   ",
    bookingClientEmailSnapshot: " snapshot@example.com ",
  });

  assert.equal(resolved, "snapshot@example.com");
});

test("resolveEmailLogRecipientFromContact returns null when both emails are missing", async () => {
  const { resolveEmailLogRecipientFromContact } = await import("@/features/admin/actions/email-log-action-helpers");
  const resolved = resolveEmailLogRecipientFromContact({
    clientEmail: null,
    bookingClientEmailSnapshot: "   ",
  });

  assert.equal(resolved, null);
});

test("resolveResendIncidentRootId zachová pouze neuzavřený incident root", async () => {
  const { resolveResendIncidentRootId } = await import("@/features/admin/actions/email-log-action-helpers");

  assert.equal(resolveResendIncidentRootId({
    sourceEmailLogId: "resend-b",
    sourceResendRootId: "incident-a",
    incidentResolvedAt: null,
  }), "incident-a");
  assert.equal(resolveResendIncidentRootId({
    sourceEmailLogId: "resend-b",
    sourceResendRootId: "incident-a",
    incidentResolvedAt: new Date("2026-08-16T10:00:00.000Z"),
  }), null);
});

test("buildResendEmailLogCreateInput resets queue and provider state for resend", async () => {
  const { buildResendEmailLogCreateInput } = await import("@/features/admin/actions/email-log-action-helpers");
  const now = new Date("2026-05-24T08:30:00.000Z");
  const payload = { bookingId: "booking-1", reminder: true };

  const data = buildResendEmailLogCreateInput({
    resendOfId: "email-log-1",
    resendRootId: "email-log-1",
    bookingId: "booking-1",
    clientId: "client-1",
    actionTokenId: "token-1",
    type: EmailLogType.BOOKING_CONFIRMED,
    recipientEmail: "client@example.com",
    subject: "Rezervace potvrzena",
    templateKey: "booking-approved-v1",
    payload,
    now,
  });

  assert.equal(data.status, EmailLogStatus.PENDING);
  assert.equal(data.attemptCount, 0);
  assert.equal(data.nextAttemptAt, now);
  assert.equal(data.processingStartedAt, null);
  assert.equal(data.processingToken, null);
  assert.equal(data.provider, null);
  assert.equal(data.providerMessageId, null);
  assert.equal(data.errorMessage, null);
  assert.equal(data.sentAt, null);
  assert.equal(data.resendOfId, "email-log-1");
  assert.equal(data.resendRootId, "email-log-1");
  assert.deepEqual(data.payload, payload);
});

test("buildResendEmailLogCreateInput stores the current contact address only on the new resend", async () => {
  const {
    buildResendEmailLogCreateInput,
    resolveEmailLogRecipientFromContact,
  } = await import("@/features/admin/actions/email-log-action-helpers");
  const historicalRecipient = "petra@seznam.dz";
  const recipientEmail = resolveEmailLogRecipientFromContact({
    clientEmail: "petra@seznam.cz",
    bookingClientEmailSnapshot: historicalRecipient,
  });

  assert.equal(recipientEmail, "petra@seznam.cz");

  const data = buildResendEmailLogCreateInput({
    resendOfId: "email-log-a",
    resendRootId: "email-log-a",
    bookingId: "booking-1",
    clientId: "client-1",
    actionTokenId: null,
    type: EmailLogType.BOOKING_CONFIRMED,
    recipientEmail: recipientEmail!,
    subject: "Rezervace potvrzena",
    templateKey: "booking-approved-v1",
    payload: null,
  });

  assert.equal(historicalRecipient, "petra@seznam.dz");
  assert.equal(data.recipientEmail, "petra@seznam.cz");
  assert.equal(data.resendOfId, "email-log-a");
  assert.equal(data.resendRootId, "email-log-a");
});

test("buildResendEmailLogCreateInput preserves received-booking template", async () => {
  const { buildResendEmailLogCreateInput } = await import("@/features/admin/actions/email-log-action-helpers");

  const data = buildResendEmailLogCreateInput({
    resendOfId: "email-log-1",
    resendRootId: "email-log-1",
    bookingId: "booking-1",
    clientId: "client-1",
    actionTokenId: "token-1",
    type: EmailLogType.BOOKING_RECEIVED,
    recipientEmail: "client@example.com",
    subject: "Přijetí rezervace",
    templateKey: "booking-confirmation-v1",
    payload: { bookingId: "booking-1" },
  });

  assert.equal(data.type, EmailLogType.BOOKING_RECEIVED);
  assert.equal(data.templateKey, "booking-confirmation-v1");
});

test("buildResendEmailLogCreateInput omits payload when source payload is null", async () => {
  const { buildResendEmailLogCreateInput } = await import("@/features/admin/actions/email-log-action-helpers");
  const data = buildResendEmailLogCreateInput({
    resendOfId: "email-log-1",
    resendRootId: "email-log-1",
    bookingId: null,
    clientId: null,
    actionTokenId: null,
    type: EmailLogType.BOOKING_CREATED,
    recipientEmail: "client@example.com",
    subject: "Rezervace prijata",
    templateKey: "booking-pending-v1",
    payload: null,
  });

  assert.equal("payload" in data, true);
  assert.equal(data.payload, undefined);
});

test("buildResendEmailLogCreateInput sets manual reminder resend flag for reminder emails", async () => {
  const { buildResendEmailLogCreateInput } = await import("@/features/admin/actions/email-log-action-helpers");

  const data = buildResendEmailLogCreateInput({
    resendOfId: "email-log-1",
    resendRootId: "email-log-1",
    bookingId: "booking-1",
    clientId: "client-1",
    actionTokenId: null,
    type: EmailLogType.BOOKING_REMINDER,
    recipientEmail: "client@example.com",
    subject: "Pripominka terminu",
    templateKey: "booking-reminder-24h-v1",
    payload: { scheduledStartsAt: "2026-05-25T08:00:00.000Z" },
  });

  assert.equal(typeof data.payload, "object");
  assert.deepEqual(data.payload, {
    scheduledStartsAt: "2026-05-25T08:00:00.000Z",
    manualReminderResend: true,
  });
});
