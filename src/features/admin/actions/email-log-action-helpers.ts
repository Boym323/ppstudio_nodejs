import { EmailLogStatus, EmailLogType, Prisma } from "@prisma/client";

export function resolveEmailLogRecipientFromContact(input: {
  clientEmail: string | null;
  bookingClientEmailSnapshot: string | null;
}) {
  const clientEmail = input.clientEmail?.trim() ?? "";
  if (clientEmail) {
    return clientEmail;
  }

  const bookingEmail = input.bookingClientEmailSnapshot?.trim() ?? "";
  return bookingEmail || null;
}

export function buildResendEmailLogCreateInput(input: {
  resendOfId: string;
  resendRootId: string;
  bookingId: string | null;
  clientId: string | null;
  actionTokenId: string | null;
  type: EmailLogType;
  recipientEmail: string;
  subject: string;
  templateKey: string;
  payload: Prisma.JsonValue | null;
  now?: Date;
}) {
  const shouldBypassReminderPreflight = input.type === EmailLogType.BOOKING_REMINDER;
  const payloadWithOverride =
    input.payload && typeof input.payload === "object" && !Array.isArray(input.payload)
      ? ({
          ...(input.payload as Record<string, unknown>),
          ...(shouldBypassReminderPreflight ? ({ manualReminderResend: true } as const) : {}),
        } satisfies Prisma.InputJsonObject)
      : shouldBypassReminderPreflight
        ? ({ manualReminderResend: true } satisfies Prisma.InputJsonObject)
        : input.payload;

  return {
    resendOfId: input.resendOfId,
    resendRootId: input.resendRootId,
    bookingId: input.bookingId,
    clientId: input.clientId,
    actionTokenId: input.actionTokenId,
    type: input.type,
    status: EmailLogStatus.PENDING,
    attemptCount: 0,
    nextAttemptAt: input.now ?? new Date(),
    processingStartedAt: null,
    processingToken: null,
    recipientEmail: input.recipientEmail,
    subject: input.subject,
    templateKey: input.templateKey,
    payload: payloadWithOverride === null ? undefined : (payloadWithOverride as Prisma.InputJsonValue),
    provider: null,
    providerMessageId: null,
    errorMessage: null,
    sentAt: null,
  };
}
