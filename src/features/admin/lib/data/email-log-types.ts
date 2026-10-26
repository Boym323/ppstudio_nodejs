import type { AdminArea } from "@/config/navigation";
import type { EmailLogType } from "@/generated/prisma/client";

export type AdminLogView = "attention" | "events" | "emails" | "system";
export type AdminLogSeverity = "info" | "success" | "warning" | "error";
export type AdminLogSource = "all" | "email" | "booking" | "voucher" | "service" | "settings" | "availability" | "admin" | "submission";

export type AdminLogItem = {
  id: string;
  occurredAt: string;
  category: "event" | "email" | "automation" | "system";
  severity: AdminLogSeverity;
  title: string;
  description: string | null;
  actorLabel: string | null;
  entityLabel: string | null;
  entityHref: string | null;
  sourceType: "email" | "booking" | "voucher" | "service" | "settings" | "availability" | "admin" | "submission";
  sourceId: string;
  primaryAction: "retry" | "release" | "detail" | "open" | null;
  emailLogId?: string;
  queueState?: string;
  trackingState?: string;
  emailBadge?: { label: string; severity: AdminLogSeverity; detail: string | null };
};

export type AdminLogsData = {
  area: AdminArea;
  view: AdminLogView;
  items: AdminLogItem[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  filters: { query: string; severity: "all" | AdminLogSeverity; source: AdminLogSource; emailType: "all" | EmailLogType; dateFrom: string; dateTo: string };
  attention: { failed: number; retry: number; stuck: number; critical: number };
  queueStats: Array<{
    label: string;
    value: string;
    tone?: "default" | "accent" | "muted";
    detail?: string;
  }>;
  workerSummary: string;
};

export const adminLogPageSize = 50;
