"use client";

import { isPublicBookingAvailabilityError } from "./availability-refresh";

export function isBookingTermConflictErrorCode(errorCode?: string, suggestedStep?: number) {
  return isPublicBookingAvailabilityError(errorCode, suggestedStep);
}

export function shouldTrackBookingDateSelection(
  lastTrackedDateKey: string | null,
  nextDateKey: string,
) {
  return Boolean(nextDateKey && nextDateKey !== lastTrackedDateKey);
}

export function shouldTrackBookingServiceSelectedForPrefill(isPrefilledSelection: boolean) {
  return !isPrefilledSelection;
}
