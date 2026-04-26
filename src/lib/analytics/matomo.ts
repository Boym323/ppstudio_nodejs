import "server-only";

import { env } from "@/config/env";

export type MatomoVisits = { nb_visits: number };
export type MatomoGoal = { nb_conversions: number };
export type MatomoEvent = { label: string; nb_events: number };
export type MatomoReferrer = { label: string; nb_visits: number };
export type MatomoCampaign = { label: string; nb_visits: number };

export type DashboardAnalyticsSource = {
  label: string;
  visits: number;
  conversions: number;
};

export type MatomoReportingStatus = "ok" | "disabled" | "blocked" | "error";

export type MatomoReportingHealth = {
  status: MatomoReportingStatus;
  message?: string;
};

export type DashboardAnalytics = {
  visits: number;
  conversions: number;
  conversionRate: number;
  topSource: string;
  sources: DashboardAnalyticsSource[];
  funnel: {
    service: number;
    date: number;
    time: number;
    created: number;
  };
};

const MATOMO_REVALIDATE_SECONDS = 300;
const DEFAULT_VISITS: MatomoVisits = { nb_visits: 0 };
const DEFAULT_DASHBOARD_ANALYTICS: DashboardAnalytics = {
  visits: 0,
  conversions: 0,
  conversionRate: 0,
  topSource: "",
  sources: [],
  funnel: {
    service: 0,
    date: 0,
    time: 0,
    created: 0,
  },
};

const bookingFunnelLabels = {
  service: "Booking / Service selected",
  date: "Booking / Date selected",
  time: "Booking / Time selected",
  created: "Booking / Created",
} as const;

type MatomoMethod =
  | "VisitsSummary.get"
  | "Goals.get"
  | "Events.getAction"
  | "Referrers.getReferrerType"
  | "Referrers.getCampaigns";

type MatomoApiErrorPayload = {
  result: string;
  message?: string;
};

function getMatomoConfig() {
  if (!env.MATOMO_URL || !env.MATOMO_SITE_ID || !env.MATOMO_AUTH_TOKEN) {
    return null;
  }

  return {
    url: env.MATOMO_URL,
    siteId: env.MATOMO_SITE_ID,
    authToken: env.MATOMO_AUTH_TOKEN,
  };
}

function buildMatomoApiUrl(method: MatomoMethod) {
  const config = getMatomoConfig();

  if (!config) {
    return null;
  }

  try {
    const apiUrl = new URL(config.url);

    if (!apiUrl.pathname.endsWith(".php")) {
      apiUrl.pathname = `${apiUrl.pathname.replace(/\/$/, "")}/index.php`;
    }

    apiUrl.searchParams.set("module", "API");
    apiUrl.searchParams.set("method", method);
    apiUrl.searchParams.set("idSite", config.siteId);
    apiUrl.searchParams.set("period", "day");
    apiUrl.searchParams.set("date", "today");
    apiUrl.searchParams.set("format", "JSON");
    apiUrl.searchParams.set("token_auth", config.authToken);

    return apiUrl;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Matomo Reporting API URL is invalid.", error);
    }

    return null;
  }
}

function toFiniteNumber(value: unknown) {
  const numberValue = typeof value === "number" ? value : Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function isMatomoApiErrorPayload(value: unknown): value is MatomoApiErrorPayload {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).result === "string" &&
    (value as Record<string, unknown>).result === "error"
  );
}

function getMatomoErrorMessage(value: unknown) {
  if (!isMatomoApiErrorPayload(value)) {
    return null;
  }

  return value.message?.trim() || "Matomo reporting vrátil chybu.";
}

function normalizeVisitsPayload(payload: unknown): MatomoVisits {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return DEFAULT_VISITS;
  }

  return {
    nb_visits: toFiniteNumber((payload as Record<string, unknown>).nb_visits),
  };
}

function normalizeRows<T>(
  payload: unknown,
  normalize: (row: Record<string, unknown>) => T,
): T[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map(normalize);
}

async function fetchMatomoJsonRaw(method: MatomoMethod) {
  const url = buildMatomoApiUrl(method);

  if (!url) {
    return null;
  }

  try {
    const response = await fetch(url, {
      next: { revalidate: MATOMO_REVALIDATE_SECONDS },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`Matomo Reporting API request failed for ${method}.`, error);
    }

    return null;
  }
}

async function fetchMatomoJson(method: MatomoMethod) {
  const payload = await fetchMatomoJsonRaw(method);

  if (getMatomoErrorMessage(payload)) {
    return null;
  }

  return payload;
}

function getEventCount(events: MatomoEvent[], fullLabel: string) {
  const [, actionLabel = fullLabel] = fullLabel.split(" / ");

  return events
    .filter((event) => event.label === fullLabel || event.label === actionLabel)
    .reduce((sum, event) => sum + event.nb_events, 0);
}

function mapReferrerTypeLabel(label: string) {
  const normalizedLabel = label.trim().toLowerCase();

  if (normalizedLabel.includes("social")) {
    return "Instagram";
  }

  if (normalizedLabel.includes("website") || normalizedLabel.includes("websites")) {
    return "Firmy";
  }

  if (normalizedLabel.includes("search")) {
    return "Google";
  }

  if (normalizedLabel.includes("direct")) {
    return "Přímý vstup";
  }

  return label.trim() || "Ostatní";
}

function mapCampaignLabel(label: string) {
  const trimmedLabel = label.trim();
  const normalizedLabel = trimmedLabel.toLowerCase();

  if (normalizedLabel.includes("instagram") || normalizedLabel.includes("social")) {
    return "Instagram";
  }

  if (
    normalizedLabel.includes("firmy") ||
    normalizedLabel.includes("website") ||
    normalizedLabel.includes("catalog")
  ) {
    return "Firmy";
  }

  if (normalizedLabel.includes("google") || normalizedLabel.includes("search")) {
    return "Google";
  }

  if (normalizedLabel.includes("direct")) {
    return "Přímý vstup";
  }

  if (normalizedLabel.includes("offline")) {
    return "Offline";
  }

  return trimmedLabel || "Ostatní";
}

function buildSourceRows(
  referrers: MatomoReferrer[],
  campaigns: MatomoCampaign[],
  createdCount: number,
): DashboardAnalyticsSource[] {
  const sourceVisits = new Map<string, number>();
  const rows = campaigns.length > 0
    ? campaigns.map((campaign) => ({
        label: mapCampaignLabel(campaign.label),
        visits: campaign.nb_visits,
      }))
    : referrers.map((referrer) => ({
        label: mapReferrerTypeLabel(referrer.label),
        visits: referrer.nb_visits,
      }));

  for (const row of rows) {
    sourceVisits.set(row.label, (sourceVisits.get(row.label) ?? 0) + row.visits);
  }

  const totalSourceVisits = [...sourceVisits.values()].reduce((sum, visits) => sum + visits, 0);

  const sources = [...sourceVisits.entries()]
    .map(([label, visits]) => ({
      label,
      visits,
      conversions:
        totalSourceVisits > 0 ? Math.round((visits / totalSourceVisits) * createdCount) : 0,
    }))
    .sort((left, right) => right.visits - left.visits);

  const visibleSources = sources.slice(0, 4);
  const otherSources = sources.slice(4);

  if (otherSources.length === 0) {
    return visibleSources;
  }

  return [
    ...visibleSources,
    {
      label: "Ostatní",
      visits: otherSources.reduce((sum, source) => sum + source.visits, 0),
      conversions: otherSources.reduce((sum, source) => sum + source.conversions, 0),
    },
  ];
}

export async function fetchVisits(): Promise<MatomoVisits> {
  return normalizeVisitsPayload(await fetchMatomoJson("VisitsSummary.get"));
}

export async function fetchGoals(): Promise<MatomoGoal[]> {
  return normalizeRows(await fetchMatomoJson("Goals.get"), (row) => ({
    nb_conversions: toFiniteNumber(row.nb_conversions),
  }));
}

export async function fetchEvents(): Promise<MatomoEvent[]> {
  return normalizeRows(await fetchMatomoJson("Events.getAction"), (row) => ({
    label: String(row.label ?? ""),
    nb_events: toFiniteNumber(row.nb_events),
  }));
}

export async function fetchReferrers(): Promise<MatomoReferrer[]> {
  return normalizeRows(await fetchMatomoJson("Referrers.getReferrerType"), (row) => ({
    label: String(row.label ?? ""),
    nb_visits: toFiniteNumber(row.nb_visits),
  }));
}

export async function fetchCampaigns(): Promise<MatomoCampaign[]> {
  return normalizeRows(await fetchMatomoJson("Referrers.getCampaigns"), (row) => ({
    label: String(row.label ?? ""),
    nb_visits: toFiniteNumber(row.nb_visits),
  }));
}

export async function getMatomoReportingHealth(): Promise<MatomoReportingHealth> {
  if (!getMatomoConfig()) {
    return {
      status: "disabled",
      message: "Matomo není nakonfigurované.",
    };
  }

  const payload = await fetchMatomoJsonRaw("VisitsSummary.get");

  if (payload === null) {
    return {
      status: "error",
      message: "Matomo reporting je dočasně nedostupný.",
    };
  }

  const errorMessage = getMatomoErrorMessage(payload);

  if (!errorMessage) {
    return { status: "ok" };
  }

  if (errorMessage.toLowerCase().includes("too many failed logins")) {
    return {
      status: "blocked",
      message: "Matomo reporting je dočasně zablokovaný. Zkontroluj API token nebo lockout v Matomu.",
    };
  }

  return {
    status: "error",
    message: "Matomo reporting vrátil chybu. Zkontroluj konfiguraci nebo oprávnění API tokenu.",
  };
}

export async function getDashboardAnalytics(): Promise<DashboardAnalytics> {
  try {
    const [visitsSummary, goals, events, referrers, campaigns] = await Promise.all([
      fetchVisits(),
      fetchGoals(),
      fetchEvents(),
      fetchReferrers(),
      fetchCampaigns(),
    ]);

    const visits = visitsSummary.nb_visits;
    const conversions = goals.reduce((sum, goal) => sum + goal.nb_conversions, 0);
    const funnel = {
      service: getEventCount(events, bookingFunnelLabels.service),
      date: getEventCount(events, bookingFunnelLabels.date),
      time: getEventCount(events, bookingFunnelLabels.time),
      created: getEventCount(events, bookingFunnelLabels.created),
    };
    const topReferrer = referrers.reduce<MatomoReferrer | null>(
      (top, referrer) => (!top || referrer.nb_visits > top.nb_visits ? referrer : top),
      null,
    );
    const sources = buildSourceRows(referrers, campaigns, funnel.created);

    return {
      visits,
      conversions,
      conversionRate: visits > 0 ? Math.round((conversions / visits) * 10000) / 100 : 0,
      topSource: sources[0]?.label ?? (topReferrer ? mapReferrerTypeLabel(topReferrer.label) : ""),
      sources,
      funnel,
    };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Matomo dashboard analytics aggregation failed.", error);
    }

    return DEFAULT_DASHBOARD_ANALYTICS;
  }
}
