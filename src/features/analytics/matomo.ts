"use client";

export type MatomoEventValue = number | undefined;

export type BookingEventAction =
  | "Rezervace zahájena"
  | "Služba vybrána"
  | "Čas vybrán"
  | "Kontakt zahájen"
  | "Kontaktní pole zahájeno"
  | "Souhrn zobrazen"
  | "Odeslána rezervace"
  | "Vytvořena"
  | "Neúspěšná rezervace"
  | "Služba změněna"
  | "Čas změněn";

declare global {
  interface Window {
    _paq?: Array<unknown[]>;
    __matomoTrackerConfigured?: boolean;
    __matomoTrackedPath?: string;
  }
}

const sensitivePathValuePattern =
  /(@|(?:\+?\d[\s().-]*){9,}|token|jmeno|poznám|poznam|\/rezervace\/(?:sprava|storno|akce)\/)/i;
const sensitiveEventLabelPattern =
  /(@|(?:\+?\d[\s().-]*){9,}|token|jmeno|poznám|poznam|\/rezervace\/(?:sprava|storno|akce)\/)/i;

type SearchParamsLike = {
  size: number;
  forEach(callback: (value: string, key: string) => void): void;
};

export function isMatomoConfigured() {
  return (
    process.env.NEXT_PUBLIC_MATOMO_ENABLED === "true" &&
    Boolean(process.env.NEXT_PUBLIC_MATOMO_URL) &&
    Boolean(process.env.NEXT_PUBLIC_MATOMO_SITE_ID)
  );
}

export function normalizeMatomoUrl(url: string) {
  return url.endsWith("/") ? url : `${url}/`;
}

export function markMatomoTrackingState(path: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.__matomoTrackerConfigured = true;
  window.__matomoTrackedPath = path;
}

export function shouldTrackMatomoPath(pathname: string) {
  if (!isMatomoConfigured()) {
    return false;
  }

  return !(
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/rezervace/sprava") ||
    pathname.startsWith("/rezervace/storno") ||
    pathname.startsWith("/rezervace/akce") ||
    pathname.includes("/preview") ||
    pathname.includes("/nahled") ||
    pathname.includes("/lock") ||
    pathname.includes("/zamk")
  );
}

export function shouldInitializeMatomo(pathname: string) {
  if (!isMatomoConfigured()) {
    return false;
  }

  return !(
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.includes("/preview") ||
    pathname.includes("/nahled") ||
    pathname.includes("/lock") ||
    pathname.includes("/zamk")
  );
}

type ShouldInitializeMatomoTrackingOptions = {
  disabled?: boolean;
};

export function shouldInitializeMatomoTracking(
  pathname: string,
  options?: ShouldInitializeMatomoTrackingOptions,
) {
  return !options?.disabled && shouldInitializeMatomo(pathname);
}

export function buildSafeMatomoPath(pathname: string, searchParams?: SearchParamsLike | null) {
  if (pathname.startsWith("/rezervace/sprava/")) {
    return "/rezervace/sprava/[token]";
  }

  if (pathname.startsWith("/rezervace/storno/")) {
    return "/rezervace/storno/[token]";
  }

  if (pathname.startsWith("/rezervace/akce/")) {
    return "/rezervace/akce/[intent]/[token]";
  }

  if (!searchParams || searchParams.size === 0) {
    return pathname;
  }

  const safeSearchParams = new URLSearchParams();
  const sensitiveKeys = /token|email|e-mail|mail|phone|telefon|tel|name|jmeno|client|note|poznam/i;

  searchParams.forEach((value, key) => {
    if (sensitiveKeys.test(key) || sensitivePathValuePattern.test(value)) {
      return;
    }

    safeSearchParams.set(key, value);
  });

  const queryString = safeSearchParams.toString();

  return queryString ? `${pathname}?${queryString}` : pathname;
}

function isSafeEventLabel(value: string) {
  return !sensitiveEventLabelPattern.test(value);
}

export function ensureMatomoTrackingPath(path: string, options?: { trackPageView?: boolean }) {
  if (typeof window === "undefined" || !isMatomoConfigured()) {
    return;
  }

  const queue = window._paq ?? [];

  if (!window._paq) {
    window._paq = queue;
  }

  try {
    if (!window.__matomoTrackerConfigured) {
      const trackerUrl = normalizeMatomoUrl(process.env.NEXT_PUBLIC_MATOMO_URL ?? "");
      queue.push(["setTrackerUrl", `${trackerUrl}matomo.php`]);
      queue.push(["setSiteId", process.env.NEXT_PUBLIC_MATOMO_SITE_ID ?? ""]);
      queue.push(["enableHeartBeatTimer", 15]);
      queue.push(["enableLinkTracking"]);
    }

    if (window.__matomoTrackedPath !== path) {
      queue.push(["setCustomUrl", path]);
    }

    markMatomoTrackingState(path);

    if (options?.trackPageView) {
      queue.push(["setDocumentTitle", document.title]);
      queue.push(["trackPageView"]);
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Matomo path bootstrap failed.", error);
    }
  }
}

export function trackMatomoEvent(
  category: string,
  action: string,
  name?: string,
  value?: MatomoEventValue,
) {
  if (typeof window === "undefined" || !isMatomoConfigured() || !window._paq) {
    return;
  }

  if (!isSafeEventLabel(category) || !isSafeEventLabel(action) || (name && !isSafeEventLabel(name))) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Matomo event skipped because it looked sensitive.");
    }
    return;
  }

  try {
    const eventPayload: unknown[] = ["trackEvent", category, action];

    if (name !== undefined) {
      eventPayload.push(name);
    }

    if (value !== undefined && Number.isFinite(value)) {
      eventPayload.push(value);
    }

    window._paq.push(eventPayload);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Matomo event failed.", error);
    }
  }
}

/**
 * Jediná česká taxonomie veřejného rezervačního funnelu. Název události je vždy
 * technický slug služby nebo bezpečný kontext kroku; nikdy osobní údaje.
 */
export function trackBookingEvent(
  action: BookingEventAction,
  name?: string,
) {
  trackMatomoEvent("Rezervace", action, name);
}

export function trackContactCtaClick(type: "phone" | "email" | "instagram" | "contact form" | "map", location: string) {
  trackMatomoEvent("CTA", "Kontakt klik", `${type} ${location}`);
}
