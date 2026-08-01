const publicAvailabilityErrorCodes = new Set([
  "SLOT_UNAVAILABLE",
  "SLOT_NOT_ALLOWED",
  "SLOT_TOO_SHORT",
]);

const rescheduleAvailabilityErrorCodes = new Set([
  "SLOT_UNAVAILABLE",
  "SLOT_NOT_ALLOWED",
  "SLOT_TOO_SHORT",
  "CONFLICT",
  "CONCURRENT_MODIFICATION",
]);

export const availabilityRefreshMessage =
  "Tento termín byl mezitím obsazen. Nabídku jsme aktualizovali, vyberte prosím jiný čas.";

export function isPublicBookingAvailabilityError(errorCode?: string, suggestedStep?: number) {
  return Boolean(
    errorCode
      && (publicAvailabilityErrorCodes.has(errorCode)
        || (errorCode === "BOOKING_CONFLICT" && suggestedStep === 2)),
  );
}

export function isRescheduleAvailabilityError(errorCode?: string) {
  return Boolean(errorCode && rescheduleAvailabilityErrorCodes.has(errorCode));
}

export function getRefreshedSelectedDateKey(currentDateKey: string, availableDateKeys: string[]) {
  return availableDateKeys.includes(currentDateKey) ? currentDateKey : availableDateKeys[0] ?? "";
}

export function getRefreshedDateSelection(currentDateKey: string, availableDateKeys: string[]) {
  const selectedDateKey = getRefreshedSelectedDateKey(currentDateKey, availableDateKeys);

  return {
    selectedDateKey,
    visibleMonthKey: selectedDateKey.slice(0, 7),
  };
}
