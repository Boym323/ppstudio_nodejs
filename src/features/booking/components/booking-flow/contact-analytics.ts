import type { ContactFieldKey } from "./types";

export function shouldTrackFirstContactFieldEvent(
  trackedFields: Set<ContactFieldKey>,
  field: ContactFieldKey,
) {
  if (trackedFields.has(field)) {
    return false;
  }

  trackedFields.add(field);
  return true;
}

export function shouldTrackContactFieldInput(
  trackedFields: Set<ContactFieldKey>,
  field: ContactFieldKey,
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
