import { prisma } from "@/lib/prisma";

type ResendWebhookHeaders = {
  id: string;
  timestamp: string;
  signature: string;
};

type ResendWebhookEvent = {
  type: string;
  created_at: string;
  data?: {
    email_id?: string;
  };
};

type ResendWebhookApplyInput = {
  event: ResendWebhookEvent;
  providerEventId: string;
  notifyDeliveryIssue?: (input: {
    emailLogId: string;
    bookingId: string | null;
    emailType: string;
  }) => Promise<void>;
};

const EMAIL_EVENT_TYPES = new Set([
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.opened",
  "email.clicked",
  "email.bounced",
  "email.complained",
  "email.failed",
  "email.suppressed",
]);

export async function verifyResendWebhookPayload(input: {
  payload: string;
  headers: ResendWebhookHeaders;
  webhookSecret: string;
}) {
  const { Webhook } = await import("svix");
  const webhook = new Webhook(input.webhookSecret);

  return webhook.verify(input.payload, {
    "svix-id": input.headers.id,
    "svix-timestamp": input.headers.timestamp,
    "svix-signature": input.headers.signature,
  }) as ResendWebhookEvent;
}

function parseEventDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function deriveTrackingState(input: {
  trackingLastEvent?: string | null;
  trackingClickedAt: Date | null;
  trackingOpenedAt: Date | null;
  trackingDeliveredAt: Date | null;
  trackingBouncedAt: Date | null;
  trackingComplainedAt: Date | null;
  trackingFailedAt: Date | null;
  trackingSuppressedAt: Date | null;
}) {
  if (input.trackingSuppressedAt) {
    return {
      value: "failed",
      label: "Nedoručeno - blokováno (suppressed)",
    } as const;
  }

  if (input.trackingBouncedAt) {
    return {
      value: "failed",
      label: "Nedoručeno - odmítnuto cílovým serverem (bounce)",
    } as const;
  }

  if (input.trackingFailedAt) {
    return {
      value: "failed",
      label: "Nedoručeno - odeslání selhalo",
    } as const;
  }

  if (input.trackingComplainedAt) {
    return {
      value: "retry",
      label: "Doručeno - označeno jako spam",
    } as const;
  }

  if (input.trackingClickedAt) {
    return {
      value: "sent",
      label: "Doručeno - kliknuto",
    } as const;
  }

  if (input.trackingOpenedAt) {
    return {
      value: "sent",
      label: "Doručeno - otevřeno",
    } as const;
  }

  if (input.trackingDeliveredAt) {
    return {
      value: "sent",
      label: "Doručeno",
    } as const;
  }

  if (input.trackingLastEvent === "email.delivery_delayed") {
    return {
      value: "retry",
      label: "Doručení zpožděno",
    } as const;
  }

  if (input.trackingLastEvent === "email.sent") {
    return {
      value: "processing",
      label: "Odesláno - čeká na doručení",
    } as const;
  }

  return {
    value: "pending",
    label: "Čeká na odeslání",
  } as const;
}

export async function applyResendWebhookEvent({ event, providerEventId, notifyDeliveryIssue }: ResendWebhookApplyInput) {
  const emailId = event.data?.email_id?.trim() || null;

  const result = await prisma.$transaction(async (tx) => {
      const eventClaim = await tx.emailProviderWebhookEvent.createMany({
        data: {
          provider: "resend",
          providerEventId,
          eventType: event.type,
          providerMessageId: emailId,
          processedAt: new Date(),
          outcome: "RECEIVED",
        },
        skipDuplicates: true,
      });

      if (eventClaim.count === 0) {
        return { matched: false, ignored: true, deliveryIssue: null, duplicate: true };
      }

      let matched = false;
      let ignored = false;
      let deliveryIssue: { emailLogId: string; bookingId: string | null } | null = null;
      let outcome = "UNMATCHED";

      if (!EMAIL_EVENT_TYPES.has(event.type) || !emailId) {
        ignored = true;
        outcome = "IGNORED";
      } else {
        const trackedAt = parseEventDate(event.created_at) ?? new Date();
        const emailLog = await tx.emailLog.findFirst({
          where: { providerMessageId: emailId },
          select: {
            id: true,
            bookingId: true,
            resendRootId: true,
            trackingLastEventAt: true,
            trackingDeliveredAt: true,
            trackingOpenedAt: true,
            trackingClickedAt: true,
            trackingBouncedAt: true,
            trackingComplainedAt: true,
            trackingFailedAt: true,
            trackingSuppressedAt: true,
          },
        });

        if (!emailLog) {
          outcome = "UNMATCHED";
        } else {
          matched = true;
          outcome = "MATCHED";
          const update: Parameters<typeof tx.emailLog.update>[0]["data"] = {};
          let shouldNotifyDeliveryIssue = false;

          if (!emailLog.trackingLastEventAt || trackedAt >= emailLog.trackingLastEventAt) {
            update.trackingLastEvent = event.type;
            update.trackingLastEventAt = trackedAt;
          }

          if (event.type === "email.delivered" && !emailLog.trackingDeliveredAt) {
            update.trackingDeliveredAt = trackedAt;
          }

          if (event.type === "email.opened" && !emailLog.trackingOpenedAt) {
            update.trackingOpenedAt = trackedAt;
          }

          if (event.type === "email.clicked" && !emailLog.trackingClickedAt) {
            update.trackingClickedAt = trackedAt;
          }

          if (event.type === "email.bounced" && !emailLog.trackingBouncedAt) {
            update.trackingBouncedAt = trackedAt;
            shouldNotifyDeliveryIssue = true;
          }

          if (event.type === "email.complained" && !emailLog.trackingComplainedAt) {
            update.trackingComplainedAt = trackedAt;
            shouldNotifyDeliveryIssue = true;
          }

          if (event.type === "email.failed" && !emailLog.trackingFailedAt) {
            update.trackingFailedAt = trackedAt;
            shouldNotifyDeliveryIssue = true;
          }

          if (event.type === "email.suppressed" && !emailLog.trackingSuppressedAt) {
            update.trackingSuppressedAt = trackedAt;
            shouldNotifyDeliveryIssue = true;
          }

          await tx.emailLog.update({ where: { id: emailLog.id }, data: update });

          // Pouze explicitní resend může uzavřít incident původní zprávy. Samotný
          // jiný lifecycle e-mail se proto do této cesty nikdy nedostane.
          if (event.type === "email.delivered" && emailLog.resendRootId) {
            await tx.emailLog.updateMany({
              where: {
                id: emailLog.resendRootId,
                incidentResolvedAt: null,
              },
              data: {
                incidentResolvedAt: trackedAt,
                incidentResolvedByEmailLogId: emailLog.id,
              },
            });
          }

          if (shouldNotifyDeliveryIssue) {
            deliveryIssue = { emailLogId: emailLog.id, bookingId: emailLog.bookingId };
          }
        }
      }

      await tx.emailProviderWebhookEvent.updateMany({
        where: { provider: "resend", providerEventId },
        data: { outcome, processedAt: new Date() },
      });

      return { matched, ignored, deliveryIssue, duplicate: false };
    });

  if (result.deliveryIssue) {
    try {
      if (notifyDeliveryIssue) {
        await notifyDeliveryIssue({ ...result.deliveryIssue, emailType: event.type });
      } else {
        const { sendOwnerEmailFailurePushover } = await import("@/lib/notifications/pushover-core");
        await sendOwnerEmailFailurePushover({
          emailLogId: result.deliveryIssue.emailLogId,
          bookingId: result.deliveryIssue.bookingId,
          emailType: event.type,
          isReminder: false,
          failureKind: "provider-delivery",
        });
      }
    } catch (error) {
      console.error("Resend delivery issue Pushover notification failed", {
        emailLogId: result.deliveryIssue.emailLogId,
        eventType: event.type,
        error,
      });
    }
  }

  return result;
}
