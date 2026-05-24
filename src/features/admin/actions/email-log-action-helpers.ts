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
  return {
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
    payload: input.payload === null ? undefined : (input.payload as Prisma.InputJsonValue),
    provider: null,
    providerMessageId: null,
    errorMessage: null,
    sentAt: null,
  };
}
