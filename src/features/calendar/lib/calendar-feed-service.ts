import { CalendarFeedScope, BookingStatus, type CalendarFeed } from "@prisma/client";

import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";
import { getSalonAddressLine, getSiteSettings } from "@/lib/site-settings";

import { buildCalendarIcs } from "./calendar-ics";
import {
  buildCalendarFeedToken,
  buildCalendarFeedTokenSalt,
  buildCalendarFeedUrl,
  isCalendarFeedTokenValid,
  parseCalendarFeedToken,
} from "./calendar-feed-token";

type CalendarFeedWithActor = CalendarFeed & {
  updatedByUser?: {
    name: string;
  } | null;
};

function getCalendarFeedScopeLabel(scope: CalendarFeedScope) {
  switch (scope) {
    case CalendarFeedScope.OWNER_BOOKINGS:
      return "Rezervace majitelky";
  }
}

function buildCalendarFeedDescription() {
  return "Potvrzené rezervace salonu PP Studio pro read-only přehled v Apple Kalendáři.";
}

function getCalendarEventUidHost() {
  try {
    return new URL(env.NEXT_PUBLIC_APP_URL).host || "ppstudio.local";
  } catch {
    return "ppstudio.local";
  }
}

function buildBookingEventDescription(booking: {
  id: string;
  clientNameSnapshot: string;
  clientPhoneSnapshot: string | null;
  clientEmailSnapshot: string;
  serviceNameSnapshot: string;
  clientNote: string | null;
}) {
  const lines = [
    `Klientka: ${booking.clientNameSnapshot}`,
    `Telefon: ${booking.clientPhoneSnapshot ?? "Neuveden"}`,
    `E-mail: ${booking.clientEmailSnapshot}`,
    `Služba: ${booking.serviceNameSnapshot}`,
  ];

  if (booking.clientNote) {
    lines.push(`Poznámka: ${booking.clientNote}`);
  }

  lines.push(`Rezervace ID: ${booking.id}`);

  return lines.join("\n");
}

export async function getCalendarFeed(scope: CalendarFeedScope) {
  const feed = await prisma.calendarFeed.findUnique({
    where: { scope },
    include: {
      updatedByUser: {
        select: {
          name: true,
        },
      },
    },
  });

  return feed as CalendarFeedWithActor | null;
}

export async function getOrCreateCalendarFeed(scope: CalendarFeedScope, updatedByUserId: string | null) {
  const existingFeed = await getCalendarFeed(scope);

  if (existingFeed) {
    return existingFeed;
  }

  return prisma.calendarFeed.create({
    data: {
      scope,
      tokenSalt: buildCalendarFeedTokenSalt(),
      isActive: false,
      updatedByUserId,
    },
    include: {
      updatedByUser: {
        select: {
          name: true,
        },
      },
    },
  }) as Promise<CalendarFeedWithActor>;
}

export async function activateCalendarFeed(scope: CalendarFeedScope, updatedByUserId: string | null) {
  const feed = await getOrCreateCalendarFeed(scope, updatedByUserId);

  if (feed.isActive) {
    return feed;
  }

  return prisma.calendarFeed.update({
    where: { id: feed.id },
    data: {
      isActive: true,
      revokedAt: null,
      updatedByUserId,
    },
    include: {
      updatedByUser: {
        select: {
          name: true,
        },
      },
    },
  }) as Promise<CalendarFeedWithActor>;
}

export async function rotateCalendarFeed(scope: CalendarFeedScope, updatedByUserId: string | null) {
  const feed = await getOrCreateCalendarFeed(scope, updatedByUserId);
  const now = new Date();

  return prisma.calendarFeed.update({
    where: { id: feed.id },
    data: {
      tokenSalt: buildCalendarFeedTokenSalt(),
      isActive: true,
      rotatedAt: now,
      revokedAt: null,
      updatedByUserId,
    },
    include: {
      updatedByUser: {
        select: {
          name: true,
        },
      },
    },
  }) as Promise<CalendarFeedWithActor>;
}

export async function deactivateCalendarFeed(scope: CalendarFeedScope, updatedByUserId: string | null) {
  const feed = await getCalendarFeed(scope);

  if (!feed) {
    return null;
  }

  return prisma.calendarFeed.update({
    where: { id: feed.id },
    data: {
      isActive: false,
      revokedAt: new Date(),
      updatedByUserId,
    },
    include: {
      updatedByUser: {
        select: {
          name: true,
        },
      },
    },
  }) as Promise<CalendarFeedWithActor>;
}

export async function getOwnerCalendarFeedAdminState() {
  const feed = await getOrCreateCalendarFeed(CalendarFeedScope.OWNER_BOOKINGS, null);

  return {
    scope: feed.scope,
    scopeLabel: getCalendarFeedScopeLabel(feed.scope),
    isActive: feed.isActive,
    subscriptionUrl: feed.isActive ? buildCalendarFeedUrl(feed) : null,
    tokenPreview: buildCalendarFeedToken(feed).slice(-8),
    createdAt: feed.createdAt,
    updatedAt: feed.updatedAt,
    rotatedAt: feed.rotatedAt,
    revokedAt: feed.revokedAt,
    updatedByName: feed.updatedByUser?.name ?? null,
  };
}

export async function validateCalendarFeedRequestToken(scope: CalendarFeedScope, rawToken: string) {
  const parsed = parseCalendarFeedToken(rawToken);

  if (!parsed) {
    return null;
  }

  const feed = await prisma.calendarFeed.findUnique({
    where: { id: parsed.feedId },
  });

  if (!feed || feed.scope !== scope || !isCalendarFeedTokenValid(feed, rawToken)) {
    return null;
  }

  return feed;
}

export async function buildOwnerCalendarFeedIcs() {
  const [settings, bookings] = await Promise.all([
    getSiteSettings(),
    prisma.booking.findMany({
      where: {
        status: BookingStatus.CONFIRMED,
      },
      orderBy: {
        scheduledStartsAt: "asc",
      },
      select: {
        id: true,
        clientNameSnapshot: true,
        clientEmailSnapshot: true,
        clientPhoneSnapshot: true,
        serviceNameSnapshot: true,
        clientNote: true,
        scheduledStartsAt: true,
        scheduledEndsAt: true,
        updatedAt: true,
        confirmedAt: true,
      },
    }),
  ]);

  const location = `${settings.salonName}, ${getSalonAddressLine(settings)}`;
  const uidHost = getCalendarEventUidHost();

  return buildCalendarIcs({
    productId: "-//PP Studio//Owner Booking Feed//CS",
    name: `${settings.salonName} • potvrzené rezervace`,
    description: buildCalendarFeedDescription(),
    events: bookings.map((booking) => ({
      uid: `${booking.id}@${uidHost}`,
      summary: `${booking.serviceNameSnapshot} – ${booking.clientNameSnapshot}`,
      description: buildBookingEventDescription(booking),
      location,
      status: "CONFIRMED" as const,
      startsAt: booking.scheduledStartsAt,
      endsAt: booking.scheduledEndsAt,
      dtStamp: booking.confirmedAt ?? booking.updatedAt,
      lastModified: booking.updatedAt,
      sequence: Math.max(0, Math.floor(booking.updatedAt.getTime() / 1000)),
    })),
  });
}
