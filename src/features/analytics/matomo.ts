"use client";

export type MatomoEventValue = number | undefined;

declare global {
  interface Window {
    _paq?: Array<unknown[]>;
  }
}

const sensitivePattern =
  /(@|(?:\+?\d[\s().-]*){9,}|token|sprava|storno|akce|jmeno|poznám|poznam|\/rezervace\/(?:sprava|storno|akce)\/)/i;

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
    if (sensitiveKeys.test(key) || sensitivePattern.test(value)) {
      return;
    }

    safeSearchParams.set(key, value);
  });

  const queryString = safeSearchParams.toString();

  return queryString ? `${pathname}?${queryString}` : pathname;
}

function isSafeEventLabel(value: string) {
  return !sensitivePattern.test(value);
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

export function trackReservationCtaClick(location: string, page: string) {
  trackMatomoEvent("CTA", "Reservation clicked", `${location} ${page}`);
}

export function trackContactCtaClick(type: "phone" | "email" | "instagram" | "contact form" | "map", location: string) {
  trackMatomoEvent("CTA", "Contact clicked", `${type} ${location}`);
}
