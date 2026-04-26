import {
  BookingActionTokenType,
  BookingStatus,
  EmailLogStatus,
  EmailLogType,
  Prisma,
} from "@prisma/client";

import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";

import {
  buildBookingActionExpiry,
  buildBookingActionToken,
  buildBookingCancellationUrl,
  buildBookingManagementUrl,
} from "./booking-action-tokens";

const BOOKING_REMINDER_24H_WINDOW_START_HOURS = 25;
const BOOKING_REMINDER_24H_WINDOW_END_HOURS = 26;
const BOOKING_REMINDER_24H_MAX_ITERATIONS = 1_000;

export const BOOKING_REMINDER_SCAN_INTERVAL_MS = 5 * 60 * 1000;

export type BookingReminder24hWindow = {
  windowStart: Date;
  windowEnd: Date;
};

export type BookingReminderCandidate = {
  id: string;
  clientId: string;
  clientEmailSnapshot: string;
  clientNameSnapshot: string;
  serviceNameSnapshot: string;
  scheduledStartsAt: Date;
  scheduledEndsAt: Date;
};

export type EnqueueBookingReminder24hResult = {
  foundBookings: number;
  enqueued: number;
  failed: number;
};

export function getBookingReminder24hWindow(now = new Date()): BookingReminder24hWindow {
  const windowStart = new Date(
    now.getTime() + BOOKING_REMINDER_24H_WINDOW_START_HOURS * 60 * 60 * 1000,
  );
  const windowEnd = new Date(
    now.getTime() + BOOKING_REMINDER_24H_WINDOW_END_HOURS * 60 * 60 * 1000,
  );

  return {
    windowStart,
    windowEnd,
  };
}

export async function getBookingsFor24hReminder(now = new Date()): Promise<BookingReminderCandidate[]> {
  const { windowStart, windowEnd } = getBookingReminder24hWindow(now);

  return prisma.booking.findMany({
    where: {
      status: BookingStatus.CONFIRMED,
      clientEmailSnapshot: {
        not: "",
      },
      reminder24hQueuedAt: null,
      reminder24hSentAt: null,
      scheduledStartsAt: {
        gte: windowStart,
        lte: windowEnd,
      },
    },
    orderBy: {
      scheduledStartsAt: "asc",
    },
    select: {
      id: true,
      clientId: true,
      clientEmailSnapshot: true,
      clientNameSnapshot: true,
      serviceNameSnapshot: true,
      scheduledStartsAt: true,
      scheduledEndsAt: true,
    },
  });
}

function buildExcludedBookingIdsClause(excludedBookingIds: string[]) {
  if (excludedBookingIds.length === 0) {
    return Prisma.empty;
  }

  return Prisma.sql`AND booking."id" NOT IN (${Prisma.join(excludedBookingIds)})`;
}

async function claimNextBookingFor24hReminder(
  tx: Prisma.TransactionClient,
  now: Date,
  excludedBookingIds: string[],
): Promise<BookingReminderCandidate | null> {
  const { windowStart, windowEnd } = getBookingReminder24hWindow(now);
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT booking."id"
    FROM "Booking" AS booking
    WHERE booking."status" = ${BookingStatus.CONFIRMED}
      AND trim(booking."clientEmailSnapshot") <> ''
      AND booking."reminder24hQueuedAt" IS NULL
      AND booking."reminder24hSentAt" IS NULL
      AND booking."scheduledStartsAt" >= ${windowStart}
      AND booking."scheduledStartsAt" <= ${windowEnd}
      ${buildExcludedBookingIdsClause(excludedBookingIds)}
    ORDER BY booking."scheduledStartsAt" ASC, booking."createdAt" ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  `);

  const bookingId = rows[0]?.id;

  if (!bookingId) {
    return null;
  }

  return tx.booking.findUnique({
    where: {
      id: bookingId,
    },
    select: {
      id: true,
      clientId: true,
      clientEmailSnapshot: true,
      clientNameSnapshot: true,
      serviceNameSnapshot: true,
      scheduledStartsAt: true,
      scheduledEndsAt: true,
    },
  });
}

export async function enqueueBookingReminder24hJobs(
  now = new Date(),
): Promise<EnqueueBookingReminder24hResult> {
  const candidates = await getBookingsFor24hReminder(now);
  const result: EnqueueBookingReminder24hResult = {
    foundBookings: candidates.length,
    enqueued: 0,
    failed: 0,
  };
  const failedBookingIds = new Set<string>();

  while (result.enqueued + result.failed < Math.min(result.foundBookings, BOOKING_REMINDER_24H_MAX_ITERATIONS)) {
    let claimedBookingId: string | null = null;

    try {
      const enqueuedBookingId = await prisma.$transaction(async (tx) => {
        const booking = await claimNextBookingFor24hReminder(tx, now, Array.from(failedBookingIds));

        if (!booking) {
          return null;
        }

        claimedBookingId = booking.id;

        const manageToken = buildBookingActionToken();
        const cancellationToken = buildBookingActionToken();
        const manageReservationUrl = buildBookingManagementUrl(manageToken.rawToken);
        const cancellationUrl = buildBookingCancellationUrl(cancellationToken.rawToken);

        const manageActionToken = await tx.bookingActionToken.create({
          data: {
            bookingId: booking.id,
            type: BookingActionTokenType.RESCHEDULE,
            tokenHash: manageToken.tokenHash,
            expiresAt: buildBookingActionExpiry(now),
            lastSentAt: now,
          },
          select: {
            id: true,
          },
        });

        await tx.bookingActionToken.create({
          data: {
            bookingId: booking.id,
            type: BookingActionTokenType.CANCEL,
            tokenHash: cancellationToken.tokenHash,
            expiresAt: buildBookingActionExpiry(now),
            lastSentAt: now,
          },
        });

        await tx.emailLog.create({
          data: {
            bookingId: booking.id,
            clientId: booking.clientId,
            actionTokenId: manageActionToken.id,
            type: EmailLogType.BOOKING_REMINDER,
            status: env.EMAIL_DELIVERY_MODE === "background" ? undefined : EmailLogStatus.SENT,
            attemptCount: env.EMAIL_DELIVERY_MODE === "background" ? undefined : 1,
            nextAttemptAt: env.EMAIL_DELIVERY_MODE === "background" ? now : undefined,
            processingStartedAt: null,
            processingToken: null,
            recipientEmail: booking.clientEmailSnapshot,
            subject: "Připomínka rezervace - zítra v PP Studio",
            templateKey: "booking-reminder-24h-v1",
            payload: {
              bookingId: booking.id,
              serviceName: booking.serviceNameSnapshot,
              clientName: booking.clientNameSnapshot,
              scheduledStartsAt: booking.scheduledStartsAt.toISOString(),
              scheduledEndsAt: booking.scheduledEndsAt.toISOString(),
              manageReservationUrl,
              cancellationUrl,
            },
            provider: env.EMAIL_DELIVERY_MODE === "background" ? undefined : "log",
            sentAt: env.EMAIL_DELIVERY_MODE === "background" ? undefined : now,
          },
        });

        if (env.EMAIL_DELIVERY_MODE === "log") {
          await tx.booking.update({
            where: {
              id: booking.id,
            },
            data: {
              reminder24hQueuedAt: now,
              reminder24hSentAt: now,
            },
          });
        } else {
          await tx.booking.update({
            where: {
              id: booking.id,
            },
            data: {
              reminder24hQueuedAt: now,
            },
          });
        }

        return booking.id;
      });

      if (!enqueuedBookingId) {
        break;
      }

      result.enqueued += 1;
    } catch (error) {
      result.failed += 1;

      if (claimedBookingId) {
        failedBookingIds.add(claimedBookingId);
      }

      console.error("Booking reminder 24h enqueue failed", {
        bookingId: claimedBookingId,
        error,
      });
    }
  }

  return result;
}

export async function markBookingReminder24hSent(bookingId: string, sentAt: Date) {
  await prisma.booking.updateMany({
    where: {
      id: bookingId,
      reminder24hSentAt: null,
    },
    data: {
      reminder24hQueuedAt: sentAt,
      reminder24hSentAt: sentAt,
    },
  });
}

export type BookingReminderDeliveryPreflight = {
  shouldSend: boolean;
  reason?: string;
};

export function evaluateBookingReminderDelivery({
  bookingStatus,
  reminder24hSentAt,
  scheduledStartsAt,
  now = new Date(),
}: {
  bookingStatus: BookingStatus | null;
  reminder24hSentAt: Date | null;
  scheduledStartsAt: Date | null;
  now?: Date;
}): BookingReminderDeliveryPreflight {
  if (bookingStatus !== BookingStatus.CONFIRMED) {
    return {
      shouldSend: false,
      reason: "Booking is no longer confirmed.",
    };
  }

  if (reminder24hSentAt) {
    return {
      shouldSend: false,
      reason: "Booking reminder was already marked as sent.",
    };
  }

  if (!scheduledStartsAt) {
    return {
      shouldSend: false,
      reason: "Booking is missing scheduled start time.",
    };
  }

  if (scheduledStartsAt <= now) {
    return {
      shouldSend: false,
      reason: "Booking already started.",
    };
  }

  const latestAllowedStart = new Date(
    now.getTime() + BOOKING_REMINDER_24H_WINDOW_END_HOURS * 60 * 60 * 1000,
  );

  if (scheduledStartsAt > latestAllowedStart) {
    return {
      shouldSend: false,
      reason: "Booking moved outside the reminder window.",
    };
  }

  return {
    shouldSend: true,
  };
}
