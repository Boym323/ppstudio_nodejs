import { BookingStatus, EmailAudience, EmailLogStatus, EmailLogType } from "@/generated/prisma/browser";
import { Prisma } from "@/generated/prisma/client";
import { randomUUID } from "node:crypto";

import {
  evaluateBookingReminderDelivery,
  markBookingReminder24hSent,
} from "@/features/booking/lib/booking-reminders";
import { evaluateBookingEmailPreflight } from "@/lib/email/booking-preflight";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/provider";
import { getEmailDeliveryRetryDelayMs, getMaxEmailDeliveryAttempts } from "@/lib/email/retry";
import { renderEmailTemplate } from "@/lib/email/templates";
import { sendOwnerEmailFailurePushover } from "@/lib/notifications/pushover-core";
import { reconcileUnmatchedResendWebhookEvents } from "@/lib/email/resend-webhooks";
import { scrubSensitiveEmailPayload } from "@/lib/email/payload-security";
import {
  acquireClientDeliveryLease,
  releaseClientDeliveryLease,
} from "@/lib/email/booking-delivery-fence";

export type EmailLogDeliveryOutcome = {
  status: "sent" | "failed" | "skipped";
  errorMessage?: string;
};

type EmailDeliveryDependencies = Partial<{
  sendEmail: typeof sendEmail;
  reconcileUnmatchedResendWebhookEvents: typeof reconcileUnmatchedResendWebhookEvents;
  markBookingReminder24hSent: typeof markBookingReminder24hSent;
  beforeBookingPreflight: () => void | Promise<void>;
  beforeDeliveryAuthorization: () => void | Promise<void>;
  beforeProviderSend: () => void | Promise<void>;
}>;

const WORKER_LOCK_TIMEOUT_MS = 10 * 60 * 1000;

/** Atomicky převezme pending job pro explicitní (mimo worker) odeslání. */
export async function claimEmailLogForImmediateDelivery(emailLogId: string) {
  const now = new Date();
  const processingToken = randomUUID();
  const staleBefore = new Date(now.getTime() - WORKER_LOCK_TIMEOUT_MS);
  const claimed = await prisma.emailLog.updateMany({
    where: {
      id: emailLogId,
      status: EmailLogStatus.PENDING,
      OR: [
        { processingStartedAt: null },
        { processingStartedAt: { lt: staleBefore } },
      ],
    },
    data: {
      processingToken,
      processingStartedAt: now,
      attemptCount: { increment: 1 },
    },
  });

  return claimed.count === 1 ? processingToken : null;
}

function readReminderScheduledStartsAt(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const scheduledStartsAt = "scheduledStartsAt" in payload ? payload.scheduledStartsAt : null;

  return typeof scheduledStartsAt === "string" ? scheduledStartsAt : null;
}

function shouldBypassReminderPreflight(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  const flag = "manualReminderResend" in payload ? payload.manualReminderResend : null;
  return flag === true;
}

function usesClientBookingDeliveryFence(emailLog: {
  bookingId: string | null;
  audience: EmailAudience;
  type: EmailLogType;
}) {
  return Boolean(
    emailLog.bookingId
    && (
      emailLog.audience === EmailAudience.CLIENT
      || emailLog.type === EmailLogType.BOOKING_REMINDER
    ),
  );
}

type ClientBookingDeliveryBooking = {
  status: BookingStatus;
  clientEmailSnapshot: string;
  communicationGeneration: number;
  clientDeliveryLeaseToken: string | null;
  clientDeliveryLeaseExpiresAt: Date | null;
  reminder24hSentAt: Date | null;
  scheduledStartsAt: Date;
  scheduledEndsAt: Date;
  serviceId: string;
};

function evaluateClientBookingDelivery(
  emailLog: {
    type: EmailLogType;
    audience: EmailAudience;
    templateKey: string;
    payload: Prisma.JsonValue | null;
    recipientEmail: string;
    communicationGeneration: number;
  },
  booking: ClientBookingDeliveryBooking | null,
) {
  const bookingEmailPreflight = evaluateBookingEmailPreflight({
    type: emailLog.type,
    audience: emailLog.audience,
    templateKey: emailLog.templateKey,
    payload: emailLog.payload,
    booking,
  });

  if (!bookingEmailPreflight.shouldSend) {
    return bookingEmailPreflight;
  }

  if (!booking) {
    return {
      shouldSend: false,
      reason: "Booking no longer exists.",
    };
  }

  if (emailLog.recipientEmail.trim() !== booking.clientEmailSnapshot.trim()) {
    return {
      shouldSend: false,
      reason: "Booking client e-mail no longer matches the email log recipient.",
    };
  }

  if (emailLog.communicationGeneration !== booking.communicationGeneration) {
    return {
      shouldSend: false,
      reason: "Booking communication generation no longer matches the email log.",
    };
  }

  if (emailLog.type === EmailLogType.BOOKING_REMINDER) {
    const reminderScheduledStartsAt = readReminderScheduledStartsAt(emailLog.payload);
    const preflight = evaluateBookingReminderDelivery({
      bookingStatus: booking.status,
      reminder24hSentAt: booking.reminder24hSentAt,
      scheduledStartsAt:
        reminderScheduledStartsAt
        && reminderScheduledStartsAt !== booking.scheduledStartsAt.toISOString()
          ? null
          : booking.scheduledStartsAt,
      ignoreAlreadySent: shouldBypassReminderPreflight(emailLog.payload),
    });

    if (!preflight.shouldSend) {
      return preflight;
    }
  }

  return { shouldSend: true };
}

async function authorizeClientBookingDelivery(
  emailLogId: string,
  processingToken: string,
  emailLog: {
    type: EmailLogType;
    audience: EmailAudience;
    templateKey: string;
    payload: Prisma.JsonValue | null;
    recipientEmail: string;
    communicationGeneration: number;
    bookingId: string;
  },
) {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "Booking"
      WHERE "id" = ${emailLog.bookingId}
      FOR UPDATE
    `);

    const booking = await tx.booking.findUnique({
      where: { id: emailLog.bookingId },
      select: {
        status: true,
        clientEmailSnapshot: true,
        communicationGeneration: true,
        clientDeliveryLeaseToken: true,
        clientDeliveryLeaseExpiresAt: true,
        reminder24hSentAt: true,
        scheduledStartsAt: true,
        scheduledEndsAt: true,
        serviceId: true,
      },
    });
    const currentEmailLog = await tx.$queryRaw<Array<{
      status: EmailLogStatus;
      processingToken: string | null;
    }>>(Prisma.sql`
      SELECT "status", "processingToken"
      FROM "EmailLog"
      WHERE "id" = ${emailLogId}
      FOR UPDATE
    `);

    if (
      currentEmailLog[0]?.status !== EmailLogStatus.PENDING
      || currentEmailLog[0]?.processingToken !== processingToken
    ) {
      return {
        authorized: false,
        reason: "Claim e-mailu mezitím převzal jiný worker.",
      };
    }

    const preflight = evaluateClientBookingDelivery(emailLog, booking);
    if (!preflight.shouldSend) {
      return {
        authorized: false,
        reason: preflight.reason ?? "Booking email delivery skipped.",
      };
    }

    const leaseAcquired = await acquireClientDeliveryLease(tx, {
      bookingId: emailLog.bookingId,
      communicationGeneration: emailLog.communicationGeneration,
      recipientEmail: emailLog.recipientEmail.trim(),
      leaseToken: processingToken,
      now,
    });

    return leaseAcquired
      ? { authorized: true as const }
      : {
          authorized: false as const,
          reason: "Booking delivery lease could not be acquired.",
        };
  });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Neznámá chyba při odeslání e-mailu.";
}

async function markEmailLogSystemSkipped(
  emailLogId: string,
  processingToken: string,
  reason: string,
  payload: Prisma.JsonValue | null | undefined,
) {
  return prisma.emailLog.updateMany({
    where: {
      id: emailLogId,
      status: EmailLogStatus.PENDING,
      processingToken,
    },
    data: {
      status: EmailLogStatus.SENT,
      provider: "system-skip",
      sentAt: new Date(),
      processingStartedAt: null,
      processingToken: null,
      nextAttemptAt: new Date(),
      errorMessage: reason,
      payload: scrubSensitiveEmailPayload(payload),
    },
  });
}

export async function deliverEmailLog(
  emailLogId: string,
  processingToken: string,
  dependencies: EmailDeliveryDependencies = {},
): Promise<EmailLogDeliveryOutcome> {
  const emailLog = await prisma.emailLog.findUnique({
    where: {
      id: emailLogId,
    },
    select: {
      id: true,
      status: true,
      attemptCount: true,
      recipientEmail: true,
      subject: true,
      templateKey: true,
      payload: true,
      processingStartedAt: true,
      processingToken: true,
      type: true,
      audience: true,
      bookingId: true,
      communicationGeneration: true,
    },
  });

  if (!emailLog) {
    return {
      status: "skipped",
      errorMessage: "Email log nebyl nalezen.",
    };
  }

  if (
    emailLog.status !== EmailLogStatus.PENDING
    || emailLog.processingToken !== processingToken
  ) {
    return {
      status: "skipped",
    };
  }

  let booking: ClientBookingDeliveryBooking | null = null;
  if (usesClientBookingDeliveryFence(emailLog) && emailLog.bookingId) {
    await dependencies.beforeBookingPreflight?.();
    booking = await prisma.booking.findUnique({
      where: {
        id: emailLog.bookingId,
      },
      select: {
        status: true,
        clientEmailSnapshot: true,
        communicationGeneration: true,
        clientDeliveryLeaseToken: true,
        clientDeliveryLeaseExpiresAt: true,
        reminder24hSentAt: true,
        serviceId: true,
        scheduledStartsAt: true,
        scheduledEndsAt: true,
      },
    });
    const preflight = evaluateClientBookingDelivery(emailLog, booking);

    if (!preflight.shouldSend) {
      const completed = await markEmailLogSystemSkipped(
        emailLog.id,
        processingToken,
        preflight.reason ?? "Booking email delivery skipped.",
        emailLog.payload,
      );

      return completed.count === 1
        ? { status: "skipped", errorMessage: preflight.reason }
        : { status: "skipped", errorMessage: "Claim e-mailu mezitím převzal jiný worker." };
    }
  }

  let clientDeliveryLeaseAcquired = false;

  try {
    const rendered = await renderEmailTemplate(
      emailLog.templateKey,
      emailLog.subject,
      emailLog.payload,
    );

    if (usesClientBookingDeliveryFence(emailLog) && emailLog.bookingId) {
      await dependencies.beforeDeliveryAuthorization?.();
      const authorization = await authorizeClientBookingDelivery(
        emailLog.id,
        processingToken,
        {
          type: emailLog.type,
          audience: emailLog.audience,
          templateKey: emailLog.templateKey,
          payload: emailLog.payload,
          recipientEmail: emailLog.recipientEmail,
          communicationGeneration: emailLog.communicationGeneration,
          bookingId: emailLog.bookingId,
        },
      );

      if (!authorization.authorized) {
        const completed = await markEmailLogSystemSkipped(
          emailLog.id,
          processingToken,
          authorization.reason ?? "Booking email delivery skipped.",
          emailLog.payload,
        );

        return completed.count === 1
          ? { status: "skipped", errorMessage: authorization.reason }
          : { status: "skipped", errorMessage: "Claim e-mailu mezitím převzal jiný worker." };
      }

      clientDeliveryLeaseAcquired = true;
      await dependencies.beforeProviderSend?.();
    }

    const delivery = await (dependencies.sendEmail ?? sendEmail)({
      to: emailLog.recipientEmail,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      attachments: rendered.attachments,
      idempotencyKey: `email-log/${emailLog.id}`,
    });

    const completed = await prisma.emailLog.updateMany({
      where: {
        id: emailLog.id,
        status: EmailLogStatus.PENDING,
        processingToken,
      },
      data: {
        status: EmailLogStatus.SENT,
        provider: delivery.provider,
        providerMessageId: delivery.messageId,
        sentAt: new Date(),
        processingStartedAt: null,
        processingToken: null,
        nextAttemptAt: new Date(),
        errorMessage: null,
        payload: scrubSensitiveEmailPayload(emailLog.payload),
      },
    });

    if (completed.count !== 1) {
      return {
        status: "skipped",
        errorMessage: "Claim e-mailu mezitím převzal jiný worker.",
      };
    }

    if (delivery.provider === "resend" && delivery.messageId) {
      try {
        await (
          dependencies.reconcileUnmatchedResendWebhookEvents
          ?? reconcileUnmatchedResendWebhookEvents
        )(delivery.messageId);
      } catch (error) {
        console.error("Resend webhook reconciliation failed after successful delivery", {
          emailLogId: emailLog.id,
          providerMessageId: delivery.messageId,
          operation: "reconcile-unmatched-resend-webhook-events",
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
      }
    }

    if (emailLog.type === EmailLogType.BOOKING_REMINDER && emailLog.bookingId) {
      await (dependencies.markBookingReminder24hSent ?? markBookingReminder24hSent)(
        emailLog.bookingId,
        new Date(),
        {
          communicationGeneration: emailLog.communicationGeneration,
          recipientEmail: emailLog.recipientEmail.trim(),
          deliveryLeaseToken: processingToken,
        },
      );
    }

    return {
      status: "sent",
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error).slice(0, 1000);
    const attemptCount = emailLog.attemptCount;
    const shouldRetry = attemptCount < getMaxEmailDeliveryAttempts();
    const nextAttemptAt = shouldRetry
      ? new Date(Date.now() + getEmailDeliveryRetryDelayMs(attemptCount))
      : null;

    const released = await prisma.emailLog.updateMany({
      where: {
        id: emailLog.id,
        status: EmailLogStatus.PENDING,
        processingToken,
      },
      data: {
        status: shouldRetry ? EmailLogStatus.PENDING : EmailLogStatus.FAILED,
        nextAttemptAt: nextAttemptAt ?? undefined,
        processingStartedAt: null,
        processingToken: null,
        errorMessage,
        payload: shouldRetry ? undefined : scrubSensitiveEmailPayload(emailLog.payload),
      },
    });

    if (released.count !== 1) {
      return {
        status: "skipped",
        errorMessage: "Claim e-mailu mezitím převzal jiný worker.",
      };
    }

    if (!shouldRetry) {
      await sendOwnerEmailFailurePushover({
        emailLogId: emailLog.id,
        bookingId: emailLog.bookingId,
        emailType: emailLog.type,
        isReminder: emailLog.type === EmailLogType.BOOKING_REMINDER,
        failureKind: "transport",
      });
    }

    console.error("Email delivery failed", {
      emailLogId,
      error,
    });

    return {
      status: "failed",
      errorMessage,
    };
  } finally {
    if (clientDeliveryLeaseAcquired && emailLog.bookingId) {
      try {
        await releaseClientDeliveryLease(emailLog.bookingId, processingToken);
      } catch (error) {
        console.error("Client e-mail delivery lease release failed", {
          emailLogId: emailLog.id,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
      }
    }
  }
}
