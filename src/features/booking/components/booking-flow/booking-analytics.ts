"use client";

const termConflictErrorCodes = new Set([
  "BOOKING_CONFLICT",
  "SLOT_UNAVAILABLE",
  "SLOT_NOT_ALLOWED",
  "SLOT_TOO_SHORT",
]);

export function isBookingTermConflictErrorCode(errorCode?: string) {
  return Boolean(errorCode && termConflictErrorCodes.has(errorCode));
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
