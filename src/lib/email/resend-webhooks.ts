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

const EMAIL_EVENT_TYPES = new Set([
  "email.sent",
  "email.delivered",
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
      label: "Nedoručeno - odmítnuto serverem (bounce)",
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

export async function applyResendWebhookEvent(event: ResendWebhookEvent) {
  if (!EMAIL_EVENT_TYPES.has(event.type)) {
    return { matched: false, ignored: true } as const;
  }

  const emailId = event.data?.email_id?.trim();

  if (!emailId) {
    return { matched: false, ignored: true } as const;
  }

  const trackedAt = parseEventDate(event.created_at) ?? new Date();

  const emailLog = await prisma.emailLog.findFirst({
    where: {
      providerMessageId: emailId,
    },
    select: {
      id: true,
      bookingId: true,
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
    return { matched: false, ignored: false } as const;
  }

  const update: Parameters<typeof prisma.emailLog.update>[0]["data"] = {
    trackingRawPayload: event,
  };
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

  await prisma.emailLog.update({
    where: {
      id: emailLog.id,
    },
    data: update,
  });

  if (shouldNotifyDeliveryIssue) {
    try {
      const { sendOwnerEmailFailurePushover } = await import("@/lib/notifications/pushover-core");
      await sendOwnerEmailFailurePushover({
        emailLogId: emailLog.id,
        bookingId: emailLog.bookingId,
        emailType: event.type,
        isReminder: false,
      });
    } catch (error) {
      console.error("Resend delivery issue Pushover notification failed", {
        emailLogId: emailLog.id,
        eventType: event.type,
        error,
      });
    }
  }

  return { matched: true, ignored: false } as const;
}
