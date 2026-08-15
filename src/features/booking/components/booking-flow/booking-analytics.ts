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

type SlotWithCanonicalKey = {
  key: string;
};

function getSafeBookingServiceSlug(serviceSlug: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(serviceSlug)
    ? serviceSlug
    : "unknown-service";
}

/**
 * Klíč reprezentuje konkrétní sadu, kterou UI nabídlo. Canonical `key` je
 * stejná identita jako při výběru času, ne pouhá shoda data nebo času.
 */
export function getSuggestedSlotsDisplayKey(
  serviceSlug: string,
  suggestedSlots: readonly SlotWithCanonicalKey[],
) {
  if (suggestedSlots.length === 0) {
    return "";
  }

  return `${getSafeBookingServiceSlug(serviceSlug)}:${suggestedSlots.map((slot) => slot.key).join(",")}`;
}

export function formatSuggestedSlotsDisplayedMatomoName(serviceSlug: string) {
  return getSafeBookingServiceSlug(serviceSlug);
}

export function shouldTrackSuggestedSlotsDisplay(
  lastTrackedDisplayKey: string | null,
  nextDisplayKey: string,
) {
  return Boolean(nextDisplayKey && nextDisplayKey !== lastTrackedDisplayKey);
}

/** Vrací 1-based pořadí pouze pro shodu canonical klíče doporučeného slotu. */
export function getSuggestedSlotPosition(
  selectedSlot: SlotWithCanonicalKey,
  suggestedSlots: readonly SlotWithCanonicalKey[],
) {
  const index = suggestedSlots.findIndex((slot) => slot.key === selectedSlot.key);
  return index === -1 ? null : index + 1;
}

export function formatSuggestedSlotSelectionMatomoName(
  startsAt: string,
  endsAt: string,
  serviceSlug: string,
  position: number,
) {
  return `${formatBookingMatomoSlotName(startsAt, endsAt, serviceSlug)} | pozice ${position}`;
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
  const safeServiceSlug = getSafeBookingServiceSlug(serviceSlug);

  return `${getSlotDateKey(startsAt)} | ${formatSlotTime(startsAt)}–${formatSlotTime(endsAt)} | ${safeServiceSlug}`;
}

export function shouldTrackBookingServiceSelectedForPrefill(isPrefilledSelection: boolean) {
  return !isPrefilledSelection;
}
