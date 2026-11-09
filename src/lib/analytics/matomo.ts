import "server-only";

import { env } from "@/config/env";
import { BOOKING_FUNNEL_ACTIONS } from "@/features/analytics/booking-funnel";
import { buildSourceRows, mapReferrerTypeLabel } from "./matomo-sources";

export type MatomoVisits = { nb_visits: number };
export type MatomoEvent = { label: string; nb_events: number; nb_visits: number | null };
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
  funnelTrackingActive: boolean;
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
  funnelTrackingActive: false,
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

function getEventCount(events: MatomoEvent[], fullLabel: string) {
  const actionLabel = fullLabel.split(" / ")[1] ?? fullLabel;

  return events
    .filter((event) => event.label === fullLabel || event.label === actionLabel)
    .reduce((sum, event) => sum + event.nb_events, 0);
}

/** Jednotlivá návštěva s opakovanou volbou termínu se počítá právě jednou. */
function getFunnelVisitCount(events: MatomoEvent[], action: string) {
  return events.reduce((max, event) => (
    event.label === action || event.label === `Rezervační průchod / ${action}`
      ? Math.max(max, event.nb_visits ?? 0)
      : max
  ), 0);
}

export async function fetchVisits(): Promise<MatomoVisits> {
  return normalizeVisitsPayload(await fetchMatomoJson("VisitsSummary.get"));
}

export async function fetchEvents(): Promise<MatomoEvent[]> {
  return normalizeRows(await fetchMatomoJson("Events.getAction", { filter_limit: "-1" }), (row) => ({
    label: String(row.label ?? ""),
    nb_events: toFiniteNumber(row.nb_events),
    nb_visits: row.nb_visits === undefined ? null : toFiniteNumber(row.nb_visits),
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
    const [visitsSummary, bookingGoal, events, referrers, campaigns, searchEngines, socials] = await Promise.all([
      fetchVisits(),
      fetchBookingGoal(),
      fetchEvents(),
      fetchReferrers(),
      fetchCampaigns(),
      fetchSearchEngines(),
      fetchSocials(),
    ]);

    const visits = visitsSummary.nb_visits;
    const funnel = {
      viewed: getFunnelVisitCount(events, BOOKING_FUNNEL_ACTIONS.viewed),
      service: getFunnelVisitCount(events, BOOKING_FUNNEL_ACTIONS.service),
      term: getFunnelVisitCount(events, BOOKING_FUNNEL_ACTIONS.term),
      contact: getFunnelVisitCount(events, BOOKING_FUNNEL_ACTIONS.contact),
      submitted: getFunnelVisitCount(events, BOOKING_FUNNEL_ACTIONS.submitted),
      created: getFunnelVisitCount(events, BOOKING_FUNNEL_ACTIONS.created),
    };
    const funnelTrackingActive = events.some((event) =>
      event.nb_visits !== null &&
      Object.values(BOOKING_FUNNEL_ACTIONS).some((action) =>
        event.label === action || event.label === `Rezervační průchod / ${action}`
      ),
    );
    const conversions = bookingGoal.nb_conversions;
    const contactStepStarted = getEventCount(events, bookingContactQualityLabels.started);
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
      funnelTrackingActive,
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
