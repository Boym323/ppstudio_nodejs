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

  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("\\")) {
    return "/";
  }

  try {
    const parsed = new URL(trimmed, "https://ppstudio.local");
    const relativePath = `${parsed.pathname}${parsed.search}${parsed.hash}`;

    return relativePath.startsWith("/") && !relativePath.startsWith("//") ? relativePath.slice(0, 512) : "/";
  } catch {
    return "/";
  }
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
    const parsed = new URL(sanitized.includes("://") ? sanitized : `https://${sanitized}`);
    const hostname = parsed.hostname.toLowerCase();

    return hostname.length > 0 ? hostname : undefined;
  } catch {
    return undefined;
  }
}

function hostMatchesDomain(host: string, domain: string) {
  return host === domain || host.endsWith(`.${domain}`);
}

function hostMatchesGoogleDomain(host: string) {
  if (hostMatchesDomain(host, "google.com")) {
    return true;
  }

  const googleCountryDomainPattern = /(^|\.)google\.[a-z]{2,3}(\.[a-z]{2})?$/;
  return googleCountryDomainPattern.test(host);
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

  if (hostMatchesDomain(referrerHost, "facebook.com") || hostMatchesDomain(referrerHost, "fb.com")) {
    return "FACEBOOK" as const;
  }

  if (hostMatchesDomain(referrerHost, "instagram.com")) {
    return "INSTAGRAM" as const;
  }

  if (hostMatchesGoogleDomain(referrerHost)) {
    return "GOOGLE" as const;
  }

  if (
    hostMatchesDomain(referrerHost, "firmy.cz") ||
    hostMatchesDomain(referrerHost, "mapy.cz") ||
    hostMatchesDomain(referrerHost, "seznam.cz")
  ) {
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

  const utmSource = sanitizeTextValue(
    params.get("utm_source") ?? params.get("mtm_source") ?? existing?.utmSource,
  );
  const utmMedium = sanitizeTextValue(
    params.get("utm_medium") ?? params.get("mtm_medium") ?? existing?.utmMedium,
  );
  const utmCampaign = sanitizeTextValue(
    params.get("utm_campaign") ?? params.get("mtm_campaign") ?? existing?.utmCampaign,
  );

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
  const secureAttribute = process.env.NODE_ENV === "production" ? "; Secure" : "";

  return `${BOOKING_ACQUISITION_COOKIE}=${cookieValue}; Max-Age=${BOOKING_ACQUISITION_COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secureAttribute}`;
}
