import "server-only";

import { AdminRole } from "@prisma/client";

import { env } from "@/config/env";
import { formatBookingCalendarDate, formatBookingTimeRange } from "@/features/booking/lib/booking-format";
import { prisma } from "@/lib/prisma";

export type PushoverEventType =
  | "NEW_BOOKING"
  | "BOOKING_PENDING"
  | "BOOKING_CONFIRMED"
  | "BOOKING_CANCELLED"
  | "BOOKING_RESCHEDULED"
  | "EMAIL_FAILED"
  | "REMINDER_FAILED"
  | "SYSTEM_ERROR";

export type OwnerPushoverInput = {
  type: PushoverEventType;
  title: string;
  message: string;
  url?: string;
  priority?: -2 | -1 | 0 | 1 | 2;
  context?: Record<string, string | number | boolean | null>;
};

export type DirectOwnerPushoverResult =
  | { status: "sent" }
  | { status: "disabled" }
  | { status: "missing-config" }
  | { status: "missing-user-key" }
  | { status: "not-owner" }
  | { status: "failed"; message: string };

type BookingPushoverEventType =
  | "NEW_BOOKING"
  | "BOOKING_PENDING"
  | "BOOKING_CONFIRMED"
  | "BOOKING_CANCELLED"
  | "BOOKING_RESCHEDULED";

const PUSHOVER_ENDPOINT = "https://api.pushover.net/1/messages.json";
const RATE_LIMIT_WINDOW_MS = 30 * 1000;
const recentEvents = new Map<string, number>();

function isPushoverGloballyEnabled() {
  return env.PUSHOVER_ENABLED === "true";
}

function hasPushoverAppToken() {
  return Boolean(env.PUSHOVER_APP_TOKEN?.trim());
}

function getContextId(context?: OwnerPushoverInput["context"]) {
  if (!context) {
    return null;
  }

  const value = context.bookingId ?? context.contextId ?? context.emailLogId;

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function isRateLimited(input: OwnerPushoverInput) {
  const contextId = getContextId(input.context);

  if (!contextId) {
    return false;
  }

  const key = `${input.type}:${contextId}`;
  const now = Date.now();
  const previousSentAt = recentEvents.get(key);

  for (const [eventKey, sentAt] of recentEvents.entries()) {
    if (now - sentAt > RATE_LIMIT_WINDOW_MS) {
      recentEvents.delete(eventKey);
    }
  }

  if (previousSentAt && now - previousSentAt < RATE_LIMIT_WINDOW_MS) {
    return true;
  }

  recentEvents.set(key, now);

  return false;
}

function isEventEnabled(
  type: PushoverEventType,
  settings: {
    notifyNewBooking: boolean;
    notifyBookingPending: boolean;
    notifyBookingConfirmed: boolean;
    notifyBookingCancelled: boolean;
    notifyBookingRescheduled: boolean;
    notifyEmailFailed: boolean;
    notifyReminderFailed: boolean;
    notifySystemErrors: boolean;
  },
) {
  switch (type) {
    case "NEW_BOOKING":
      return settings.notifyNewBooking;
    case "BOOKING_PENDING":
      return settings.notifyBookingPending;
    case "BOOKING_CONFIRMED":
      return settings.notifyBookingConfirmed;
    case "BOOKING_CANCELLED":
      return settings.notifyBookingCancelled;
    case "BOOKING_RESCHEDULED":
      return settings.notifyBookingRescheduled;
    case "EMAIL_FAILED":
      return settings.notifyEmailFailed;
    case "REMINDER_FAILED":
      return settings.notifyReminderFailed;
    case "SYSTEM_ERROR":
      return settings.notifySystemErrors;
  }
}

async function postPushoverMessage({
  userKey,
  input,
}: {
  userKey: string;
  input: OwnerPushoverInput;
}) {
  const payload = new URLSearchParams({
    token: env.PUSHOVER_APP_TOKEN ?? "",
    user: userKey,
    title: input.title,
    message: input.message,
    priority: String(input.priority ?? 0),
  });

  if (input.url) {
    payload.set("url", input.url);
  }

  const response = await fetch(PUSHOVER_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: payload,
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    throw new Error(`Pushover API responded with ${response.status}: ${responseText.slice(0, 300)}`);
  }
}

export async function sendOwnerPushover(input: OwnerPushoverInput): Promise<void> {
  try {
    if (!isPushoverGloballyEnabled() || !hasPushoverAppToken() || isRateLimited(input)) {
      return;
    }

    const owners = await prisma.adminUser.findMany({
      where: {
        role: AdminRole.OWNER,
        isActive: true,
        notificationSettings: {
          is: {
            pushoverEnabled: true,
          },
        },
      },
      select: {
        id: true,
        notificationSettings: {
          select: {
            pushoverUserKey: true,
            notifyNewBooking: true,
            notifyBookingPending: true,
            notifyBookingConfirmed: true,
            notifyBookingCancelled: true,
            notifyBookingRescheduled: true,
            notifyEmailFailed: true,
            notifyReminderFailed: true,
            notifySystemErrors: true,
          },
        },
      },
    });

    await Promise.allSettled(
      owners.map(async (owner) => {
        const settings = owner.notificationSettings;

        if (!settings?.pushoverUserKey?.trim() || !isEventEnabled(input.type, settings)) {
          return;
        }

        await postPushoverMessage({
          userKey: settings.pushoverUserKey.trim(),
          input,
        });
      }),
    ).then((results) => {
      results.forEach((result) => {
        if (result.status === "rejected") {
          console.error("Owner Pushover notification failed", {
            type: input.type,
            context: input.context,
            error: result.reason,
          });
        }
      });
    });
  } catch (error) {
    console.error("Owner Pushover notification flow failed", {
      type: input.type,
      context: input.context,
      error,
    });
  }
}

export async function sendDirectOwnerPushover(
  userId: string,
  input: OwnerPushoverInput,
): Promise<DirectOwnerPushoverResult> {
  if (!isPushoverGloballyEnabled()) {
    return { status: "disabled" };
  }

  if (!hasPushoverAppToken()) {
    return { status: "missing-config" };
  }

  const owner = await prisma.adminUser.findUnique({
    where: {
      id: userId,
    },
    select: {
      role: true,
      isActive: true,
      notificationSettings: {
        select: {
          pushoverUserKey: true,
        },
      },
    },
  });

  if (!owner || !owner.isActive || owner.role !== AdminRole.OWNER) {
    return { status: "not-owner" };
  }

  const userKey = owner.notificationSettings?.pushoverUserKey?.trim();

  if (!userKey) {
    return { status: "missing-user-key" };
  }

  try {
    await postPushoverMessage({
      userKey,
      input,
    });

    return { status: "sent" };
  } catch (error) {
    console.error("Direct owner Pushover notification failed", {
      userId,
      type: input.type,
      error,
    });

    return {
      status: "failed",
      message: error instanceof Error ? error.message : "Pushover test selhal.",
    };
  }
}

function buildAdminBookingUrl(bookingId: string) {
  return `${env.NEXT_PUBLIC_APP_URL}/admin/rezervace/${bookingId}`;
}

function getBookingTitle(type: BookingPushoverEventType) {
  switch (type) {
    case "NEW_BOOKING":
      return "PP Studio - nova rezervace";
    case "BOOKING_PENDING":
      return "PP Studio - rezervace ceka na potvrzeni";
    case "BOOKING_CONFIRMED":
      return "PP Studio - rezervace potvrzena";
    case "BOOKING_CANCELLED":
      return "PP Studio - rezervace zrusena";
    case "BOOKING_RESCHEDULED":
      return "PP Studio - termin presunut";
  }
}

export async function sendOwnerBookingPushover(input: {
  type: BookingPushoverEventType;
  bookingId: string;
  sourceLabel?: string;
  previousStartsAt?: Date;
  previousEndsAt?: Date;
}) {
  try {
    const booking = await prisma.booking.findUnique({
      where: {
        id: input.bookingId,
      },
      select: {
        id: true,
        serviceNameSnapshot: true,
        scheduledStartsAt: true,
        scheduledEndsAt: true,
        source: true,
      },
    });

    if (!booking) {
      return;
    }

    const currentTerm = `${formatBookingCalendarDate(booking.scheduledStartsAt)}, ${formatBookingTimeRange(
      booking.scheduledStartsAt,
      booking.scheduledEndsAt,
    )}`;
    const source = input.sourceLabel ?? booking.source;
    const message =
      input.type === "BOOKING_RESCHEDULED" && input.previousStartsAt && input.previousEndsAt
        ? `${booking.serviceNameSnapshot}\nPuvodne: ${formatBookingCalendarDate(input.previousStartsAt)}, ${formatBookingTimeRange(
            input.previousStartsAt,
            input.previousEndsAt,
          )}\nNove: ${currentTerm}`
        : `${booking.serviceNameSnapshot}\n${currentTerm}\nZdroj: ${source}`;

    await sendOwnerPushover({
      type: input.type,
      title: getBookingTitle(input.type),
      message,
      url: buildAdminBookingUrl(booking.id),
      priority: 0,
      context: {
        bookingId: booking.id,
      },
    });
  } catch (error) {
    console.error("Owner booking Pushover notification failed", {
      bookingId: input.bookingId,
      type: input.type,
      error,
    });
  }
}

export async function sendOwnerEmailFailurePushover(input: {
  emailLogId: string;
  bookingId?: string | null;
  emailType: string;
  isReminder: boolean;
}) {
  const type = input.isReminder ? "REMINDER_FAILED" : "EMAIL_FAILED";

  await sendOwnerPushover({
    type,
    title: input.isReminder ? "PP Studio - chyba reminderu" : "PP Studio - chyba emailu",
    message: `Nepodarilo se odeslat email po vycerpani pokusu.\nTyp: ${input.emailType}`,
    url: input.bookingId ? buildAdminBookingUrl(input.bookingId) : `${env.NEXT_PUBLIC_APP_URL}/admin/email-logy/${input.emailLogId}`,
    priority: 1,
    context: {
      contextId: input.bookingId ?? input.emailLogId,
      emailLogId: input.emailLogId,
    },
  });
}
