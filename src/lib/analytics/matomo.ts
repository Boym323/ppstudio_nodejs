import "server-only";

import { env } from "@/config/env";
import { buildSourceRows, mapReferrerTypeLabel } from "./matomo-sources";

export type MatomoVisits = { nb_visits: number };
export type MatomoEvent = { label: string; nb_events: number };
export type MatomoReferrer = { label: string; nb_visits: number; nb_conversions: number };
export type MatomoCampaign = { label: string; nb_visits: number; nb_conversions: number };
export type MatomoPageUrl = { label: string; nb_hits: number };
export type MatomoGoal = { nb_conversions: number; conversion_rate: number; revenue: number };

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
  periodLabel: string;
  visits: number;
  conversions: number;
  conversionRate: number;
  topSource: string;
  sources: DashboardAnalyticsSource[];
  funnel: {
    viewed: number;
    service: number;
    term: number;
    contact: number;
    submitted: number;
    created: number;
  };
  contactStepQuality: {
    started: number;
    fieldFocus: number;
    fieldInputStarted: number;
    fieldError: number;
    focusRate: number;
    inputRate: number;
    errorRate: number;
  };
};

const MATOMO_REVALIDATE_SECONDS = 300;
const BOOKING_GOAL_ID = "1";
const DASHBOARD_ANALYTICS_PERIOD_LABEL = "Dnes";
const DEFAULT_VISITS: MatomoVisits = { nb_visits: 0 };
const DEFAULT_DASHBOARD_ANALYTICS: DashboardAnalytics = {
  periodLabel: DASHBOARD_ANALYTICS_PERIOD_LABEL,
  visits: 0,
  conversions: 0,
  conversionRate: 0,
  topSource: "",
  sources: [],
  funnel: {
    viewed: 0,
    service: 0,
    term: 0,
    contact: 0,
    submitted: 0,
    created: 0,
  },
  contactStepQuality: {
    started: 0,
    fieldFocus: 0,
    fieldInputStarted: 0,
    fieldError: 0,
    focusRate: 0,
    inputRate: 0,
    errorRate: 0,
  },
};

const bookingFunnelLabels = {
  started: "Rezervace / Rezervace zahájena",
  service: "Rezervace / Služba vybrána",
  term: "Rezervace / Čas vybrán",
  contact: "Rezervace / Kontakt zahájen",
  submitted: "Rezervace / Odeslána rezervace",
  created: "Rezervace / Vytvořena",
} as const;

const bookingFunnelLegacyAliases = {
  started: [],
  service: ["Rezervace / Služba předvyplněna"],
  term: [],
  contact: [],
  submitted: [],
  created: [],
} as const;

const bookingContactQualityLabels = {
  started: "Rezervace / Kontakt zahájen",
  fieldFocus: "Rezervace / Kontakt pole fokus",
  fieldInputStarted: "Rezervace / Kontaktní pole zahájeno",
  fieldError: "Rezervace / Kontakt pole chyba",
} as const;

type MatomoMethod =
  | "VisitsSummary.get"
  | "Actions.getPageUrls"
  | "Events.getAction"
  | "Goals.get"
  | "Referrers.getReferrerType"
  | "Referrers.getCampaigns"
  | "Referrers.getSearchEngines"
  | "Referrers.getSocials";

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

function buildMatomoApiUrl(
  method: MatomoMethod,
  extraSearchParams?: Record<string, string>,
) {
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
    for (const [key, value] of Object.entries(extraSearchParams ?? {})) {
      apiUrl.searchParams.set(key, value);
    }

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

function toFinitePercent(value: unknown) {
  return toFiniteNumber(typeof value === "string" ? value.replace(/\s*%$/, "") : value);
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

function normalizeGoalPayload(payload: unknown): MatomoGoal {
  const candidate = Array.isArray(payload)
    ? payload[0]
    : payload && typeof payload === "object"
      ? ((payload as Record<string, unknown>)[BOOKING_GOAL_ID] ?? payload)
      : null;

  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return { nb_conversions: 0, conversion_rate: 0, revenue: 0 };
  }

  const row = candidate as Record<string, unknown>;
  return {
    nb_conversions: toFiniteNumber(row.nb_conversions),
    conversion_rate: toFinitePercent(row.conversion_rate),
    revenue: toFiniteNumber(row.revenue),
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

async function fetchMatomoJsonRaw(
  method: MatomoMethod,
  extraSearchParams?: Record<string, string>,
) {
  const url = buildMatomoApiUrl(method, extraSearchParams);

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

async function fetchMatomoJson(
  method: MatomoMethod,
  extraSearchParams?: Record<string, string>,
) {
  const payload = await fetchMatomoJsonRaw(method, extraSearchParams);

  if (getMatomoErrorMessage(payload)) {
    return null;
  }

  return payload;
}

function getEventCount(events: MatomoEvent[], fullLabel: string, legacyFullLabels: readonly string[] = []) {
  const candidateLabels = [fullLabel, ...legacyFullLabels];
  const candidateActionLabels = candidateLabels.map((label) => label.split(" / ")[1] ?? label);

  return events
    .filter((event) => candidateLabels.includes(event.label) || candidateActionLabels.includes(event.label))
    .reduce((sum, event) => sum + event.nb_events, 0);
}

export async function fetchVisits(): Promise<MatomoVisits> {
  return normalizeVisitsPayload(await fetchMatomoJson("VisitsSummary.get"));
}

export async function fetchEvents(): Promise<MatomoEvent[]> {
  return normalizeRows(await fetchMatomoJson("Events.getAction"), (row) => ({
    label: String(row.label ?? ""),
    nb_events: toFiniteNumber(row.nb_events),
  }));
}

export async function fetchBookingGoal(): Promise<MatomoGoal> {
  return normalizeGoalPayload(await fetchMatomoJson("Goals.get", { idGoal: BOOKING_GOAL_ID }));
}

export async function fetchPageUrls(): Promise<MatomoPageUrl[]> {
  return normalizeRows(
    await fetchMatomoJson("Actions.getPageUrls", { flat: "1" }),
    (row) => ({
      label: String(row.label ?? ""),
      nb_hits: toFiniteNumber(row.nb_hits),
    }),
  );
}

export async function fetchReferrers(): Promise<MatomoReferrer[]> {
  return normalizeRows(await fetchMatomoJson("Referrers.getReferrerType", { idGoal: BOOKING_GOAL_ID }), (row) => ({
    label: String(row.label ?? ""),
    nb_visits: toFiniteNumber(row.nb_visits),
    nb_conversions: toFiniteNumber(row.nb_conversions ?? row[`goal_${BOOKING_GOAL_ID}_nb_conversions`]),
  }));
}

export async function fetchCampaigns(): Promise<MatomoCampaign[]> {
  return normalizeRows(await fetchMatomoJson("Referrers.getCampaigns", { idGoal: BOOKING_GOAL_ID }), (row) => ({
    label: String(row.label ?? ""),
    nb_visits: toFiniteNumber(row.nb_visits),
    nb_conversions: toFiniteNumber(row.nb_conversions ?? row[`goal_${BOOKING_GOAL_ID}_nb_conversions`]),
  }));
}

export async function fetchSearchEngines(): Promise<MatomoReferrer[]> {
  return normalizeRows(
    await fetchMatomoJson("Referrers.getSearchEngines", {
      idGoal: BOOKING_GOAL_ID,
      filter_limit: "100",
    }),
    (row) => ({
      label: String(row.label ?? ""),
      nb_visits: toFiniteNumber(row.nb_visits),
      nb_conversions: toFiniteNumber(row.nb_conversions ?? row[`goal_${BOOKING_GOAL_ID}_nb_conversions`]),
    }),
  );
}

export async function fetchSocials(): Promise<MatomoReferrer[]> {
  return normalizeRows(
    await fetchMatomoJson("Referrers.getSocials", {
      idGoal: BOOKING_GOAL_ID,
      filter_limit: "100",
    }),
    (row) => ({
      label: String(row.label ?? ""),
      nb_visits: toFiniteNumber(row.nb_visits),
      nb_conversions: toFiniteNumber(row.nb_conversions ?? row[`goal_${BOOKING_GOAL_ID}_nb_conversions`]),
    }),
  );
}

function getBookingFlowPageviewCount(pageUrls: MatomoPageUrl[]) {
  return pageUrls.reduce((sum, row) => {
    const rawLabel = row.label.trim();

    if (!rawLabel) {
      return sum;
    }

    let normalizedPath = rawLabel;

    try {
      if (rawLabel.startsWith("http://") || rawLabel.startsWith("https://")) {
        const parsedUrl = new URL(rawLabel);
        normalizedPath = parsedUrl.pathname + parsedUrl.search;
      }
    } catch {
      normalizedPath = rawLabel;
    }

    if (normalizedPath === "/rezervace" || normalizedPath.startsWith("/rezervace?")) {
      return sum + row.nb_hits;
    }

    return sum;
  }, 0);
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
    const [visitsSummary, bookingGoal, pageUrls, events, referrers, campaigns, searchEngines, socials] = await Promise.all([
      fetchVisits(),
      fetchBookingGoal(),
      fetchPageUrls(),
      fetchEvents(),
      fetchReferrers(),
      fetchCampaigns(),
      fetchSearchEngines(),
      fetchSocials(),
    ]);

    const visits = visitsSummary.nb_visits;
    const funnel = {
      viewed: getEventCount(events, bookingFunnelLabels.started, bookingFunnelLegacyAliases.started) || getBookingFlowPageviewCount(pageUrls),
      service: getEventCount(events, bookingFunnelLabels.service, bookingFunnelLegacyAliases.service),
      term: getEventCount(events, bookingFunnelLabels.term, bookingFunnelLegacyAliases.term),
      contact: getEventCount(events, bookingFunnelLabels.contact, bookingFunnelLegacyAliases.contact),
      submitted: getEventCount(events, bookingFunnelLabels.submitted, bookingFunnelLegacyAliases.submitted),
      created: getEventCount(events, bookingFunnelLabels.created, bookingFunnelLegacyAliases.created),
    };
    const conversions = bookingGoal.nb_conversions;
    const contactStepStarted = getEventCount(
      events,
      bookingContactQualityLabels.started,
      bookingFunnelLegacyAliases.contact,
    );
    const contactFieldFocus = getEventCount(events, bookingContactQualityLabels.fieldFocus);
    const contactFieldInputStarted = getEventCount(events, bookingContactQualityLabels.fieldInputStarted);
    const contactFieldError = getEventCount(events, bookingContactQualityLabels.fieldError);
    const topReferrer = referrers.reduce<MatomoReferrer | null>(
      (top, referrer) => (!top || referrer.nb_visits > top.nb_visits ? referrer : top),
      null,
    );
    const sources = buildSourceRows(referrers, campaigns, searchEngines, socials);
    const focusRate = contactStepStarted > 0 ? Math.round((contactFieldFocus / contactStepStarted) * 10000) / 100 : 0;
    const inputRate =
      contactStepStarted > 0 ? Math.round((contactFieldInputStarted / contactStepStarted) * 10000) / 100 : 0;
    const errorRate = contactStepStarted > 0 ? Math.round((contactFieldError / contactStepStarted) * 10000) / 100 : 0;

    return {
      periodLabel: DASHBOARD_ANALYTICS_PERIOD_LABEL,
      visits,
      conversions,
      conversionRate: bookingGoal.conversion_rate || (visits > 0 ? Math.round((conversions / visits) * 10000) / 100 : 0),
      topSource: sources[0]?.label ?? (topReferrer ? mapReferrerTypeLabel(topReferrer.label) : ""),
      sources,
      funnel,
      contactStepQuality: {
        started: contactStepStarted,
        fieldFocus: contactFieldFocus,
        fieldInputStarted: contactFieldInputStarted,
        fieldError: contactFieldError,
        focusRate,
        inputRate,
        errorRate,
      },
    };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Matomo dashboard analytics aggregation failed.", error);
    }

    return DEFAULT_DASHBOARD_ANALYTICS;
  }
}
