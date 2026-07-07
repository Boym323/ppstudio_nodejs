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
