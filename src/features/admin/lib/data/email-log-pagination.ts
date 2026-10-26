import type { AdminLogItem } from "./email-log-types";
import { adminLogPageSize } from "./email-log-types";

export function sortAndPageAdminLogItems(items: AdminLogItem[], page: number, pageSize = adminLogPageSize) {
  const sorted = [...items].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.id.localeCompare(a.id));
  const offset = (page - 1) * pageSize;
  return sorted.slice(offset, offset + pageSize);
}

export function getAdminLogPageMeta(total: number, requestedPage: number, pageSize = adminLogPageSize) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, pageCount) : 1;
  return { page, pageCount, rangeStart: total === 0 ? 0 : (page - 1) * pageSize + 1, rangeEnd: Math.min(page * pageSize, total) };
}

export function getAdminLogCandidatePlan(total: number, requestedPage: number, pageSize = adminLogPageSize) {
  const meta = getAdminLogPageMeta(total, requestedPage, pageSize);
  const offset = (meta.page - 1) * pageSize;
  return { ...meta, offset, take: offset + pageSize + 1 };
}
