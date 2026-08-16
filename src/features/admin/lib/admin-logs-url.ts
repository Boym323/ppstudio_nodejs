import type { AdminLogView, AdminLogsData } from "./admin-data";

type AdminLogFilters = AdminLogsData["filters"];
export type AdminLogUrlChanges = Partial<AdminLogFilters> & { view?: AdminLogView; page?: string };

const filterNamesByView: Record<AdminLogView, Array<keyof AdminLogFilters>> = {
  attention: ["query", "severity", "dateFrom", "dateTo"],
  events: ["query", "severity", "source", "dateFrom", "dateTo"],
  emails: ["query", "severity", "emailType", "dateFrom", "dateTo"],
  system: ["query", "severity", "source", "dateFrom", "dateTo"],
};

/** Vytváří URL pouze s filtry, které daný pohled skutečně používá. */
export function buildAdminLogsSearchParams(view: AdminLogView, filters: AdminLogFilters, changes: AdminLogUrlChanges = {}) {
  const nextView = changes.view ?? view;
  const values: Record<string, string | undefined> = { view: nextView };

  for (const name of filterNamesByView[nextView]) {
    const value = Object.hasOwn(changes, name) ? changes[name] : filters[name];
    if (value && value !== "all") values[name] = value;
  }
  if (changes.page) values.page = changes.page;

  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(values)) if (value) params.set(name, value);
  return params;
}
