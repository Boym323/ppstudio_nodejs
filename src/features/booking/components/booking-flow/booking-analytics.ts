"use client";

import { isPublicBookingAvailabilityError } from "./availability-refresh";
import { formatSlotTime, getSlotDateKey } from "./helpers";

export function isBookingTermConflictErrorCode(errorCode?: string, suggestedStep?: number) {
  return isPublicBookingAvailabilityError(errorCode, suggestedStep);
}

export function shouldTrackBookingDateSelection(
  lastTrackedDateKey: string | null,
  nextDateKey: string,
) {
  return Boolean(nextDateKey && nextDateKey !== lastTrackedDateKey);
}

export function shouldTrackBookingTimeSelection(
  lastTrackedSlotKey: string | null,
  nextSlotKey: string,
) {
  return Boolean(nextSlotKey && nextSlotKey !== lastTrackedSlotKey);
}

/**
 * Neosobní název Matomo události: termín se formátuje přímo v Europe/Prague,
 * aby převod na UTC nemohl posunout den ani hodinu rezervace.
 */
export function formatBookingMatomoSlotName(
  startsAt: string,
  endsAt: string,
  serviceSlug: string,
) {
  const safeServiceSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(serviceSlug)
    ? serviceSlug
    : "unknown-service";

  return `${getSlotDateKey(startsAt)} | ${formatSlotTime(startsAt)}–${formatSlotTime(endsAt)} | ${safeServiceSlug}`;
}

export function shouldTrackBookingServiceSelectedForPrefill(isPrefilledSelection: boolean) {
  return !isPrefilledSelection;
}
