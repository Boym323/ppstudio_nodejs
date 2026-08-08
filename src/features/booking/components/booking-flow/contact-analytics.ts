import type { ContactAnalyticsField, ContactFieldKey } from "./types";

export function shouldTrackFirstContactFieldEvent<T extends string>(
  trackedFields: Set<T>,
  field: T,
) {
  if (trackedFields.has(field)) {
    return false;
  }

  trackedFields.add(field);
  return true;
}

export function shouldTrackContactFieldInput(
  trackedFields: Set<ContactAnalyticsField>,
  field: ContactAnalyticsField,
  value: string,
) {
  if (!value.trim()) {
    return false;
  }

  return shouldTrackFirstContactFieldEvent(trackedFields, field);
}

export function shouldTrackContactFieldError(
  trackedFields: Set<ContactFieldKey>,
  field: ContactFieldKey,
  hasFieldError: boolean,
) {
  if (!hasFieldError) {
    return false;
  }

  return shouldTrackFirstContactFieldEvent(trackedFields, field);
}
