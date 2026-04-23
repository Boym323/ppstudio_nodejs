import { EmailLogStatus, EmailLogType } from "@prisma/client";

import {
  evaluateBookingReminderDelivery,
  markBookingReminder24hSent,
} from "@/features/booking/lib/booking-reminders";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/provider";
import { getEmailDeliveryRetryDelayMs, getMaxEmailDeliveryAttempts } from "@/lib/email/retry";
import { renderEmailTemplate } from "@/lib/email/templates";

export type EmailLogDeliveryOutcome = {
  status: "sent" | "failed" | "skipped";
  errorMessage?: string;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Neznámá chyba při odeslání e-mailu.";
}

export async function deliverEmailLog(emailLogId: string): Promise<EmailLogDeliveryOutcome> {
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

  if (emailLog.status === EmailLogStatus.SENT) {
    return {
      status: "skipped",
    };
  }

  if (emailLog.type === EmailLogType.BOOKING_REMINDER && emailLog.bookingId) {
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
    const preflight = evaluateBookingReminderDelivery({
      bookingStatus: booking?.status ?? null,
      reminder24hSentAt: booking?.reminder24hSentAt ?? null,
      scheduledStartsAt: booking?.scheduledStartsAt ?? null,
    });

    if (!preflight.shouldSend) {
      await prisma.emailLog.update({
        where: {
          id: emailLog.id,
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

      return {
        status: "skipped",
        errorMessage: preflight.reason,
      };
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
    });

    await prisma.emailLog.update({
      where: {
        id: emailLog.id,
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

    await prisma.emailLog.update({
      where: {
        id: emailLog.id,
      },
      data: {
        status: shouldRetry ? EmailLogStatus.PENDING : EmailLogStatus.FAILED,
        nextAttemptAt: nextAttemptAt ?? undefined,
        processingStartedAt: null,
        processingToken: null,
        errorMessage,
      },
    });

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
