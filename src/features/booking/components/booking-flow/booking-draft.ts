const STORAGE_KEY = "ppstudio:booking-draft:v1";
export const BOOKING_DRAFT_TTL_MS = 30 * 60 * 1000;

export type BookingDraft = {
  entryServiceSlug: string;
  serviceId: string;
  timeOptionKey: string;
  fullName: string;
  email: string;
  phone: string;
};

export function clearBookingDraft() {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Soukromý režim nebo zakázané úložiště nesmí blokovat rezervaci.
  }
}

export function readBookingDraft(now = Date.now()): BookingDraft | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (
      !value || value.version !== 1
      || typeof value.savedAt !== "number" || !Number.isFinite(value.savedAt)
      || value.savedAt > now || now - value.savedAt >= BOOKING_DRAFT_TTL_MS
      || typeof value.entryServiceSlug !== "string" || value.entryServiceSlug.length > 256
      || typeof value.serviceId !== "string" || value.serviceId.length > 64
      || typeof value.timeOptionKey !== "string" || value.timeOptionKey.length > 256
      || typeof value.fullName !== "string" || value.fullName.length > 120
      || typeof value.email !== "string" || value.email.length > 254
      || typeof value.phone !== "string" || value.phone.length > 32
    ) {
      clearBookingDraft();
      return null;
    }
    return {
      entryServiceSlug: value.entryServiceSlug,
      serviceId: value.serviceId, timeOptionKey: value.timeOptionKey,
      fullName: value.fullName, email: value.email, phone: value.phone,
    };
  } catch {
    clearBookingDraft();
    return null;
  }
}

export function saveBookingDraft(draft: BookingDraft, now = Date.now()) {
  try {
    if (!draft.serviceId && !draft.fullName && !draft.email && !draft.phone) {
      clearBookingDraft();
      return;
    }
    // Výslovný výčet brání uložení poznámky, voucheru či dalších polí formuláře.
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1, savedAt: now,
      entryServiceSlug: draft.entryServiceSlug,
      serviceId: draft.serviceId, timeOptionKey: draft.timeOptionKey,
      fullName: draft.fullName, email: draft.email, phone: draft.phone,
    }));
  } catch {
    // Ukládání konceptu je nepovinné, formulář musí fungovat i bez něj.
  }
}

export const BOOKING_DRAFT_RESTORE_TIMEOUT_MS = 5_000;

/** Dokončí obnovu právě jednou; po timeoutu či unmountu ignoruje pozdní výsledek. */
export function restoreBookingDraftCatalog<T>(
  refresh: () => Promise<T>,
  complete: (catalog: T | null) => void,
) {
  let settled = false;
  const finish = (catalog: T | null) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    complete(catalog);
  };
  const timeout = setTimeout(() => finish(null), BOOKING_DRAFT_RESTORE_TIMEOUT_MS);
  void Promise.resolve().then(refresh).then(finish, () => finish(null));
  return () => {
    settled = true;
    clearTimeout(timeout);
  };
}
