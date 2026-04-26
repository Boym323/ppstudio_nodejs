import "server-only";

import { env } from "@/config/env";

export type MatomoVisits = { nb_visits: number };
export type MatomoGoal = { nb_conversions: number };
export type MatomoEvent = { label: string; nb_events: number };
export type MatomoReferrer = { label: string; nb_visits: number };

export type DashboardAnalytics = {
  visits: number;
  conversions: number;
  conversionRate: number;
  topSource: string;
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
  | "Referrers.getReferrerType";

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

async function fetchMatomoJson(method: MatomoMethod) {
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

function getEventCount(events: MatomoEvent[], fullLabel: string) {
  const [, actionLabel = fullLabel] = fullLabel.split(" / ");

  return events
    .filter((event) => event.label === fullLabel || event.label === actionLabel)
    .reduce((sum, event) => sum + event.nb_events, 0);
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

export async function getDashboardAnalytics(): Promise<DashboardAnalytics> {
  try {
    const [visitsSummary, goals, events, referrers] = await Promise.all([
      fetchVisits(),
      fetchGoals(),
      fetchEvents(),
      fetchReferrers(),
    ]);

    const visits = visitsSummary.nb_visits;
    const conversions = goals.reduce((sum, goal) => sum + goal.nb_conversions, 0);
    const topReferrer = referrers.reduce<MatomoReferrer | null>(
      (top, referrer) => (!top || referrer.nb_visits > top.nb_visits ? referrer : top),
      null,
    );

    return {
      visits,
      conversions,
      conversionRate: visits > 0 ? Math.round((conversions / visits) * 10000) / 100 : 0,
      topSource: topReferrer?.label ?? "",
      funnel: {
        service: getEventCount(events, bookingFunnelLabels.service),
        date: getEventCount(events, bookingFunnelLabels.date),
        time: getEventCount(events, bookingFunnelLabels.time),
        created: getEventCount(events, bookingFunnelLabels.created),
      },
    };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Matomo dashboard analytics aggregation failed.", error);
    }

    return DEFAULT_DASHBOARD_ANALYTICS;
  }
}
