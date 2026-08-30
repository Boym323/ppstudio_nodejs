import { EmailAudience, EmailLogStatus, EmailLogType, Prisma } from "@/generated/prisma/client";

export function resolveEmailLogRecipient(input: {
  audience: EmailAudience;
  clientIsAvailable: boolean;
  clientEmail: string | null;
  bookingClientEmailSnapshot: string | null;
  originalRecipientEmail: string;
  adminNotificationEmail?: string | null;
}) {
  if (input.audience === EmailAudience.CLIENT) {
    const clientEmail = input.clientEmail?.trim() ?? "";
    if (clientEmail) {
      return clientEmail;
    }

    // U dostupné Client relation je prázdný e-mail explicitní aktuální stav.
    // Resend nesmí znovu použít ani booking snapshot, ani historického
    // příjemce.
    if (input.clientIsAvailable) {
      return null;
    }

    const bookingEmail = input.bookingClientEmailSnapshot?.trim() ?? "";
    if (bookingEmail) {
      return bookingEmail;
    }

    return input.originalRecipientEmail.trim() || null;
  }

  if (input.audience === EmailAudience.ADMIN) {
    return input.adminNotificationEmail?.trim() || input.originalRecipientEmail.trim() || null;
  }

  return input.originalRecipientEmail.trim() || null;
}

/**
 * Technický resend může pokračovat přes `resendOfId` i po uzavření incidentu.
 * Nový lifecycle incident ale nesmí znovu použít již uzavřený root.
 */
export function resolveResendIncidentRootId(input: {
  sourceEmailLogId: string;
  sourceResendRootId: string | null;
  incidentResolvedAt: Date | null;
}) {
  return input.incidentResolvedAt === null
    ? input.sourceResendRootId ?? input.sourceEmailLogId
    : null;
}

export function buildResendEmailLogCreateInput(input: {
  resendOfId: string;
  resendRootId: string | null;
  bookingId: string | null;
  clientId: string | null;
  actionTokenId: string | null;
  type: EmailLogType;
  audience?: EmailAudience;
  recipientEmail: string;
  subject: string;
  templateKey: string;
  payload: Prisma.JsonValue | null;
  communicationGeneration?: number;
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
    audience: input.audience ?? EmailAudience.EXTERNAL,
    status: EmailLogStatus.PENDING,
    attemptCount: 0,
    nextAttemptAt: input.now ?? new Date(),
    processingStartedAt: null,
    processingToken: null,
    recipientEmail: input.recipientEmail,
    subject: input.subject,
    templateKey: input.templateKey,
    communicationGeneration: input.communicationGeneration,
    payload: payloadWithOverride === null ? undefined : (payloadWithOverride as Prisma.InputJsonValue),
    provider: null,
    providerMessageId: null,
    errorMessage: null,
    sentAt: null,
  };
}
