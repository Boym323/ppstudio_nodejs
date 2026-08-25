import { prisma } from "@/lib/prisma";
import { getUnresolvedEmailDeliveryIncidentRootWhere } from "@/lib/email/incidents";

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

type DeliveryIssue = { emailLogId: string; bookingId: string | null; eventType: string };
type WebhookTransaction = Pick<typeof prisma, "emailLog" | "emailProviderWebhookEvent" | "$executeRaw">;

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

async function lockResendMessage(tx: WebhookTransaction, providerMessageId: string | null) {
  if (!providerMessageId) return;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${providerMessageId}, 0))`;
}

export async function verifyResendWebhookPayload(input: {
  payload: Buffer;
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
      label: "Nahlášeno jako spam",
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

async function applyStoredResendWebhookEvent(tx: WebhookTransaction, input: {
  eventType: string;
  providerMessageId: string | null;
  providerEventAt: Date | null;
}) {
  const { eventType, providerMessageId: emailId } = input;
  if (!EMAIL_EVENT_TYPES.has(eventType) || !emailId) {
    return { matched: false, ignored: true, outcome: "IGNORED", deliveryIssue: null };
  }

  const trackedAt = input.providerEventAt ?? new Date();
  const emailLog = await tx.emailLog.findFirst({
    where: { providerMessageId: emailId },
    select: {
      id: true, bookingId: true, resendRootId: true, trackingLastEventAt: true,
      trackingDeliveredAt: true, trackingOpenedAt: true, trackingClickedAt: true,
      trackingBouncedAt: true, trackingComplainedAt: true, trackingFailedAt: true,
      trackingSuppressedAt: true,
    },
  });

  if (!emailLog) {
    return { matched: false, ignored: false, outcome: "UNMATCHED", deliveryIssue: null };
  }

  const update: Parameters<typeof tx.emailLog.update>[0]["data"] = {};
  let shouldNotifyDeliveryIssue = false;
  if (!emailLog.trackingLastEventAt || trackedAt >= emailLog.trackingLastEventAt) {
    update.trackingLastEvent = eventType;
    update.trackingLastEventAt = trackedAt;
  }
  if (eventType === "email.delivered" && !emailLog.trackingDeliveredAt) update.trackingDeliveredAt = trackedAt;
  if (eventType === "email.opened" && !emailLog.trackingOpenedAt) update.trackingOpenedAt = trackedAt;
  if (eventType === "email.clicked" && !emailLog.trackingClickedAt) update.trackingClickedAt = trackedAt;
  if (eventType === "email.bounced" && !emailLog.trackingBouncedAt) { update.trackingBouncedAt = trackedAt; shouldNotifyDeliveryIssue = true; }
  if (eventType === "email.complained" && !emailLog.trackingComplainedAt) { update.trackingComplainedAt = trackedAt; shouldNotifyDeliveryIssue = true; }
  if (eventType === "email.failed" && !emailLog.trackingFailedAt) { update.trackingFailedAt = trackedAt; shouldNotifyDeliveryIssue = true; }
  if (eventType === "email.suppressed" && !emailLog.trackingSuppressedAt) { update.trackingSuppressedAt = trackedAt; shouldNotifyDeliveryIssue = true; }

  await tx.emailLog.update({ where: { id: emailLog.id }, data: update });
  if (eventType === "email.delivered" && emailLog.resendRootId) {
    await tx.emailLog.updateMany({
      where: {
        AND: [
          { id: emailLog.resendRootId },
          getUnresolvedEmailDeliveryIncidentRootWhere(),
        ],
      },
      data: {
        incidentResolvedAt: trackedAt,
        incidentResolvedByEmailLogId: emailLog.id,
        incidentResolutionKind: "DELIVERED_RESEND",
      },
    });
  }

  return {
    matched: true,
    ignored: false,
    outcome: "MATCHED",
    deliveryIssue: shouldNotifyDeliveryIssue
      ? { emailLogId: emailLog.id, bookingId: emailLog.bookingId, eventType }
      : null,
  };
}

async function notifyDeliveryIssues(issues: DeliveryIssue[], notifyDeliveryIssue: ResendWebhookApplyInput["notifyDeliveryIssue"]) {
  for (const issue of issues) {
    try {
      if (notifyDeliveryIssue) {
        await notifyDeliveryIssue({ ...issue, emailType: issue.eventType });
      } else {
        const { sendOwnerEmailFailurePushover } = await import("@/lib/notifications/pushover-core");
        await sendOwnerEmailFailurePushover({
          emailLogId: issue.emailLogId, bookingId: issue.bookingId, emailType: issue.eventType,
          isReminder: false, failureKind: "provider-delivery",
        });
      }
    } catch (error) {
      console.error("Resend delivery issue Pushover notification failed", {
        emailLogId: issue.emailLogId, eventType: issue.eventType, error,
      });
    }
  }
}

export async function applyResendWebhookEvent({ event, providerEventId, notifyDeliveryIssue }: ResendWebhookApplyInput) {
  const emailId = event.data?.email_id?.trim() || null;
  const providerEventAt = parseEventDate(event.created_at);
  const result = await prisma.$transaction(async (tx) => {
      await lockResendMessage(tx, emailId);
      const eventClaim = await tx.emailProviderWebhookEvent.createMany({
        data: {
          provider: "resend",
          providerEventId,
          eventType: event.type,
          providerMessageId: emailId,
          providerEventAt,
          processedAt: new Date(),
          outcome: "RECEIVED",
        },
        skipDuplicates: true,
      });

      if (eventClaim.count === 0) {
        return { matched: false, ignored: true, outcome: "DUPLICATE", deliveryIssue: null, duplicate: true };
      }

      const applied = await applyStoredResendWebhookEvent(tx, { eventType: event.type, providerMessageId: emailId, providerEventAt });

      await tx.emailProviderWebhookEvent.updateMany({
        where: { provider: "resend", providerEventId },
        data: { outcome: applied.outcome, processedAt: new Date() },
      });

      return { ...applied, duplicate: false };
    });

  if (result.deliveryIssue) await notifyDeliveryIssues([result.deliveryIssue], notifyDeliveryIssue);

  if (!result.duplicate && !result.matched && !result.ignored) {
    console.info("Resend webhook unmatched", { providerEventId, eventType: event.type, providerMessageId: emailId });
  }

  return result;
}

/** Zpracuje pouze dříve ověřené a uložené webhooky, které přišly před zápisem message ID. */
export async function reconcileUnmatchedResendWebhookEvents(providerMessageId: string, notifyDeliveryIssue?: ResendWebhookApplyInput["notifyDeliveryIssue"]) {
  const result = await prisma.$transaction(async (tx) => {
    await lockResendMessage(tx, providerMessageId);
    const events = await tx.emailProviderWebhookEvent.findMany({
      where: { provider: "resend", providerMessageId, outcome: "UNMATCHED" },
      select: { id: true },
    });
    const issues: DeliveryIssue[] = [];
    let reconciled = 0;

    for (const eventRef of events) {
      const claimed = await tx.emailProviderWebhookEvent.updateMany({
        where: { id: eventRef.id, outcome: "UNMATCHED" },
        data: { outcome: "RECONCILING", processedAt: new Date() },
      });
      if (claimed.count === 0) continue;
      const event = await tx.emailProviderWebhookEvent.findUniqueOrThrow({ where: { id: eventRef.id } });
      const applied = await applyStoredResendWebhookEvent(tx, event);
      await tx.emailProviderWebhookEvent.update({
        where: { id: event.id },
        data: { outcome: applied.matched ? "RECONCILED" : "UNMATCHED", processedAt: new Date() },
      });
      if (applied.matched) reconciled += 1;
      if (applied.deliveryIssue) issues.push(applied.deliveryIssue);
    }

    return { reconciled, candidates: events.length, issues };
  });

  if (result.issues.length > 0) await notifyDeliveryIssues(result.issues, notifyDeliveryIssue);
  console.info(result.candidates > 0 ? "Resend webhook reconciliation completed" : "Resend webhook reconciliation no match", { providerMessageId, eventCount: result.candidates });
  return { reconciled: result.reconciled, candidates: result.candidates };
}
