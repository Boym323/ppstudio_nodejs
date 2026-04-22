import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { CalendarFeedScope, type CalendarFeed } from "@prisma/client";

import { env } from "@/config/env";

const CALENDAR_FEED_TOKEN_VERSION = "v1";

type CalendarFeedTokenSource = Pick<CalendarFeed, "id" | "scope" | "tokenSalt" | "isActive">;

function getCalendarFeedTokenSecret() {
  return env.ADMIN_SESSION_SECRET;
}

function buildCalendarFeedSignaturePayload(feed: Pick<CalendarFeed, "id" | "scope" | "tokenSalt">) {
  return `${feed.id}:${feed.scope}:${feed.tokenSalt}:${CALENDAR_FEED_TOKEN_VERSION}`;
}

function buildCalendarFeedSignature(feed: Pick<CalendarFeed, "id" | "scope" | "tokenSalt">) {
  return createHmac("sha256", getCalendarFeedTokenSecret())
    .update(buildCalendarFeedSignaturePayload(feed))
    .digest("base64url");
}

export function buildCalendarFeedTokenSalt() {
  return randomBytes(32).toString("base64url");
}

export function buildCalendarFeedToken(feed: Pick<CalendarFeed, "id" | "scope" | "tokenSalt">) {
  return `${CALENDAR_FEED_TOKEN_VERSION}.${feed.id}.${buildCalendarFeedSignature(feed)}`;
}

export function buildCalendarFeedUrl(feed: Pick<CalendarFeed, "id" | "scope" | "tokenSalt">) {
  const token = buildCalendarFeedToken(feed);

  switch (feed.scope) {
    case CalendarFeedScope.OWNER_BOOKINGS:
      return `${env.NEXT_PUBLIC_APP_URL}/api/calendar/owner.ics?token=${encodeURIComponent(token)}`;
  }
}

export function parseCalendarFeedToken(rawToken: string) {
  const parts = rawToken.trim().split(".");

  if (parts.length !== 3) {
    return null;
  }

  const [version, feedId, signature] = parts;

  if (version !== CALENDAR_FEED_TOKEN_VERSION || !feedId || !signature) {
    return null;
  }

  return {
    version,
    feedId,
    signature,
  };
}

export function isCalendarFeedTokenValid(feed: CalendarFeedTokenSource, rawToken: string) {
  if (!feed.isActive) {
    return false;
  }

  const parsed = parseCalendarFeedToken(rawToken);

  if (!parsed || parsed.feedId !== feed.id) {
    return false;
  }

  const expectedSignature = buildCalendarFeedSignature(feed);
  const receivedBuffer = Buffer.from(parsed.signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(receivedBuffer, expectedBuffer);
}
