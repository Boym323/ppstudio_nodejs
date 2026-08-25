export function serializeFormEntries(entries: Iterable<[string, FormDataEntryValue]>) {
  return JSON.stringify(
    Array.from(entries, ([name, value]) => [
      name,
      typeof value === "string" ? value : `${value.name}:${value.size}:${value.type}`,
    ]),
  );
}

export function isFormDirty(initialSnapshot: string, currentSnapshot: string) {
  return initialSnapshot !== currentSnapshot;
}

export function resolveSavedFormSnapshot(
  initialSnapshot: string,
  currentSnapshot: string,
  saveStatus: "idle" | "success" | "error",
) {
  return saveStatus === "success" ? currentSnapshot : initialSnapshot;
}

export function canCloseAdminDetail(
  hasUnsavedChanges: boolean,
  confirmDiscard: () => boolean,
) {
  return !hasUnsavedChanges || confirmDiscard();
}
