export const BOOKING_ACQUISITION_COOKIE = "ppstudio-booking-acq";
const BOOKING_ACQUISITION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const MAX_VALUE_LENGTH = 120;

export type BookingAcquisitionSourceKey =
  | "DIRECT"
  | "FACEBOOK"
  | "GOOGLE"
  | "INSTAGRAM"
  | "FIRMY_CZ"
  | "OTHER";

export type BookingAcquisitionData = {
  source: BookingAcquisitionSourceKey;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrerHost: string | null;
};

type BookingAcquisitionCookiePayload = {
  v: 1;
  firstSeenAt: string;
  lastSeenAt: string;
  landingPath: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referrerHost?: string;
};

function sanitizeTextValue(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().slice(0, MAX_VALUE_LENGTH).toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

function sanitizePathValue(value: unknown) {
  if (typeof value !== "string") {
    return "/";
  }

  const trimmed = value.trim();

  if (!trimmed.startsWith("/")) {
    return "/";
  }

  return trimmed.slice(0, 512);
}

function sanitizeIsoDateValue(value: unknown, fallbackIso: string) {
  if (typeof value !== "string") {
    return fallbackIso;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? fallbackIso : new Date(parsed).toISOString();
}

function normalizeHost(value: unknown) {
  const sanitized = sanitizeTextValue(value);

  if (!sanitized) {
    return undefined;
  }

  try {
    const parsed = new URL(`https://${sanitized}`);
    return parsed.hostname.toLowerCase();
  } catch {
    return sanitized.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}

function classifyKnownSourceByUtm(utmSource?: string) {
  if (!utmSource) {
    return undefined;
  }

  if (utmSource.includes("facebook") || utmSource === "fb") {
    return "FACEBOOK" as const;
  }

  if (utmSource.includes("instagram") || utmSource === "ig") {
    return "INSTAGRAM" as const;
  }

  if (utmSource.includes("google") || utmSource === "gmb") {
    return "GOOGLE" as const;
  }

  if (utmSource.includes("firmy") || utmSource.includes("seznam")) {
    return "FIRMY_CZ" as const;
  }

  return undefined;
}

function classifyKnownSourceByHost(referrerHost?: string) {
  if (!referrerHost) {
    return undefined;
  }

  if (referrerHost.includes("facebook.com") || referrerHost.includes("fb.com") || referrerHost.includes("m.facebook")) {
    return "FACEBOOK" as const;
  }

  if (referrerHost.includes("instagram.com")) {
    return "INSTAGRAM" as const;
  }

  if (referrerHost.includes("google.")) {
    return "GOOGLE" as const;
  }

  if (referrerHost.includes("firmy.cz") || referrerHost.includes("mapy.cz") || referrerHost.includes("seznam.cz")) {
    return "FIRMY_CZ" as const;
  }

  return undefined;
}

export function resolveBookingAcquisitionSource(input: {
  utmSource?: string;
  referrerHost?: string;
}): BookingAcquisitionSourceKey {
  const sourceByUtm = classifyKnownSourceByUtm(input.utmSource);
  if (sourceByUtm) {
    return sourceByUtm;
  }

  const sourceByHost = classifyKnownSourceByHost(input.referrerHost);
  if (sourceByHost) {
    return sourceByHost;
  }

  if (!input.utmSource && !input.referrerHost) {
    return "DIRECT";
  }

  return "OTHER";
}

function decodeCookiePayload(value?: string): BookingAcquisitionCookiePayload | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(value));

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const candidate = parsed as Partial<BookingAcquisitionCookiePayload>;

    if (candidate.v !== 1) {
      return null;
    }

    return {
      v: 1,
      firstSeenAt: sanitizeIsoDateValue(candidate.firstSeenAt, new Date().toISOString()),
      lastSeenAt: sanitizeIsoDateValue(candidate.lastSeenAt, new Date().toISOString()),
      landingPath: sanitizePathValue(candidate.landingPath),
      utmSource: sanitizeTextValue(candidate.utmSource),
      utmMedium: sanitizeTextValue(candidate.utmMedium),
      utmCampaign: sanitizeTextValue(candidate.utmCampaign),
      referrerHost: normalizeHost(candidate.referrerHost),
    };
  } catch {
    return null;
  }
}

export function parseBookingAcquisitionCookie(value?: string): BookingAcquisitionData {
  const parsed = decodeCookiePayload(value);
  const utmSource = sanitizeTextValue(parsed?.utmSource);
  const utmMedium = sanitizeTextValue(parsed?.utmMedium);
  const utmCampaign = sanitizeTextValue(parsed?.utmCampaign);
  const referrerHost = normalizeHost(parsed?.referrerHost);

  return {
    source: resolveBookingAcquisitionSource({ utmSource, referrerHost }),
    utmSource: utmSource ?? null,
    utmMedium: utmMedium ?? null,
    utmCampaign: utmCampaign ?? null,
    referrerHost: referrerHost ?? null,
  };
}

function getHostFromReferrer(referrer: string) {
  if (!referrer) {
    return undefined;
  }

  try {
    return new URL(referrer).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

export function buildBookingAcquisitionCookieValue(input: {
  pathname: string;
  search: string;
  hostname: string;
  referrer: string;
  existingCookieValue?: string;
}): string | null {
  const nowIso = new Date().toISOString();
  const existing = decodeCookiePayload(input.existingCookieValue);
  const params = new URLSearchParams(input.search);

  const utmSource = sanitizeTextValue(params.get("utm_source") ?? existing?.utmSource);
  const utmMedium = sanitizeTextValue(params.get("utm_medium") ?? existing?.utmMedium);
  const utmCampaign = sanitizeTextValue(params.get("utm_campaign") ?? existing?.utmCampaign);

  const referrerHost = getHostFromReferrer(input.referrer);
  const isExternalReferrer = referrerHost && referrerHost !== input.hostname.toLowerCase();
  const normalizedReferrerHost = normalizeHost(existing?.referrerHost ?? (isExternalReferrer ? referrerHost : undefined));

  const shouldPersist = Boolean(utmSource || utmMedium || utmCampaign || normalizedReferrerHost || existing);

  if (!shouldPersist) {
    return null;
  }

  const payload: BookingAcquisitionCookiePayload = {
    v: 1,
    firstSeenAt: existing?.firstSeenAt ?? nowIso,
    lastSeenAt: nowIso,
    landingPath: existing?.landingPath ?? sanitizePathValue(`${input.pathname}${input.search}`),
    utmSource,
    utmMedium,
    utmCampaign,
    referrerHost: normalizedReferrerHost,
  };

  return encodeURIComponent(JSON.stringify(payload));
}

export function buildBookingAcquisitionCookieHeader(cookieValue: string) {
  return `${BOOKING_ACQUISITION_COOKIE}=${cookieValue}; Max-Age=${BOOKING_ACQUISITION_COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
}
