import { EmailLogStatus, EmailLogType } from "@prisma/client";
import { randomUUID } from "node:crypto";

import {
  evaluateBookingReminderDelivery,
  markBookingReminder24hSent,
} from "@/features/booking/lib/booking-reminders";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/provider";
import { getEmailDeliveryRetryDelayMs, getMaxEmailDeliveryAttempts } from "@/lib/email/retry";
import { renderEmailTemplate } from "@/lib/email/templates";
import { sendOwnerEmailFailurePushover } from "@/lib/notifications/pushover-core";
import { reconcileUnmatchedResendWebhookEvents } from "@/lib/email/resend-webhooks";

export type EmailLogDeliveryOutcome = {
  status: "sent" | "failed" | "skipped";
  errorMessage?: string;
};

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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Neznámá chyba při odeslání e-mailu.";
}

export async function deliverEmailLog(
  emailLogId: string,
  processingToken: string,
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
      bookingId: true,
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

  if (emailLog.type === EmailLogType.BOOKING_REMINDER && emailLog.bookingId) {
    const bypassPreflight = shouldBypassReminderPreflight(emailLog.payload);

    if (!bypassPreflight) {
      const booking = await prisma.booking.findUnique({
        where: {
          id: emailLog.bookingId,
        },
        select: {
          status: true,
          reminder24hSentAt: true,
          scheduledStartsAt: true,
        },
      });
      const reminderScheduledStartsAt = readReminderScheduledStartsAt(emailLog.payload);
      const preflight = evaluateBookingReminderDelivery({
        bookingStatus: booking?.status ?? null,
        reminder24hSentAt: booking?.reminder24hSentAt ?? null,
        scheduledStartsAt:
          reminderScheduledStartsAt && booking?.scheduledStartsAt
          && reminderScheduledStartsAt !== booking.scheduledStartsAt.toISOString()
            ? null
            : booking?.scheduledStartsAt ?? null,
      });

      if (!preflight.shouldSend) {
        const completed = await prisma.emailLog.updateMany({
          where: {
            id: emailLog.id,
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
            errorMessage: preflight.reason ?? "Reminder delivery skipped.",
          },
        });

        return completed.count === 1
          ? { status: "skipped", errorMessage: preflight.reason }
          : { status: "skipped", errorMessage: "Claim e-mailu mezitím převzal jiný worker." };
      }
    }
  }

  try {
    const rendered = await renderEmailTemplate(
      emailLog.templateKey,
      emailLog.subject,
      emailLog.payload,
    );
    const delivery = await sendEmail({
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
      },
    });

    if (completed.count !== 1) {
      return {
        status: "skipped",
        errorMessage: "Claim e-mailu mezitím převzal jiný worker.",
      };
    }

    if (delivery.provider === "resend" && delivery.messageId) {
      await reconcileUnmatchedResendWebhookEvents(delivery.messageId);
    }

    if (emailLog.type === EmailLogType.BOOKING_REMINDER && emailLog.bookingId) {
      await markBookingReminder24hSent(emailLog.bookingId, new Date());
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
  }
}
