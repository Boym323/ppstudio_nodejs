/** Trvalá značka archivovaného profilu a jeho auditního záznamu. */
export const CLIENT_MERGE_AUDIT_MARKER = "[CLIENT_MERGE_AUDIT_V1]";

export function isMergedClientProfile(client: { isActive: boolean; internalNote: string | null }) {
  return !client.isActive && Boolean(client.internalNote?.includes(CLIENT_MERGE_AUDIT_MARKER));
}

export function mergedClientTargetId(client: { isActive: boolean; internalNote: string | null }): string | null {
  if (!isMergedClientProfile(client) || !client.internalNote) return null;
  try {
    const payload: unknown = JSON.parse(client.internalNote.slice(client.internalNote.indexOf(CLIENT_MERGE_AUDIT_MARKER) + CLIENT_MERGE_AUDIT_MARKER.length));
    if (!payload || typeof payload !== "object" || !("targetBefore" in payload)) return null;
    const target = payload.targetBefore;
    if (!target || typeof target !== "object" || !("id" in target) || typeof target.id !== "string") return null;
    return /^[a-z0-9]{1,64}$/i.test(target.id) ? target.id : null;
  } catch {
    return null;
  }
}
