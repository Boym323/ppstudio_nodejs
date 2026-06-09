"use client";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: (...args: unknown[]) => void;
    __metaPixelCalls?: unknown[][];
  }
}

type MetaPixelPrimitive = boolean | number | string;
type MetaPixelPayload = Record<string, MetaPixelPrimitive | null | undefined>;

const sensitiveValuePattern =
  /(@|(?:\+?\d[\s().-]*){9,}|token|sprava|storno|akce|jmeno|poznám|poznam|\/rezervace\/(?:sprava|storno|akce)\/)/i;
const sensitiveKeyPattern = /email|e-mail|mail|phone|telefon|tel|token|note|poznam|client/i;

export function isMetaPixelConfigured() {
  return (
    process.env.NEXT_PUBLIC_META_PIXEL_ENABLED === "true" &&
    Boolean(process.env.NEXT_PUBLIC_META_PIXEL_ID)
  );
}

function shouldInitializeMetaPixel(pathname: string) {
  if (!isMetaPixelConfigured()) {
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

type ShouldInitializeMetaPixelTrackingOptions = {
  disabled?: boolean;
};

export function shouldInitializeMetaPixelTracking(
  pathname: string,
  options?: ShouldInitializeMetaPixelTrackingOptions,
) {
  return !options?.disabled && shouldInitializeMetaPixel(pathname);
}

function isSafeMetaPixelKey(key: string) {
  return !sensitiveKeyPattern.test(key);
}

function isSafeMetaPixelStringValue(value: string) {
  return value.trim().length > 0 && !sensitiveValuePattern.test(value);
}

export function sanitizeMetaPixelPayload(payload?: MetaPixelPayload) {
  if (!payload) {
    return undefined;
  }

  const sanitizedEntries: Array<[string, MetaPixelPrimitive]> = [];

  for (const [key, value] of Object.entries(payload)) {
    if (!isSafeMetaPixelKey(key) || value === undefined || value === null) {
      continue;
    }

    if (typeof value === "string") {
      if (isSafeMetaPixelStringValue(value)) {
        sanitizedEntries.push([key, value.trim()]);
      }
      continue;
    }

    if (typeof value === "number") {
      if (Number.isFinite(value)) {
        sanitizedEntries.push([key, value]);
      }
      continue;
    }

    if (typeof value === "boolean") {
      sanitizedEntries.push([key, value]);
    }
  }

  if (sanitizedEntries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(sanitizedEntries);
}

function trackMetaPixel(
  method: "track" | "trackCustom",
  eventName: string,
  payload?: MetaPixelPayload,
  retryCount = 30,
  recordDebugCall = true,
) {
  if (typeof window === "undefined" || !isMetaPixelConfigured() || !isSafeMetaPixelStringValue(eventName)) {
    return;
  }

  const sanitizedPayload = sanitizeMetaPixelPayload(payload);

  if (recordDebugCall && Array.isArray(window.__metaPixelCalls)) {
    if (sanitizedPayload) {
      window.__metaPixelCalls.push([method, eventName, sanitizedPayload]);
    } else {
      window.__metaPixelCalls.push([method, eventName]);
    }
  }

  if (!window.fbq) {
    if (retryCount > 0) {
      window.setTimeout(() => {
        trackMetaPixel(method, eventName, payload, retryCount - 1, false);
      }, 100);
    }

    return;
  }

  try {
    if (sanitizedPayload) {
      window.fbq(method, eventName, sanitizedPayload);
      return;
    }

    window.fbq(method, eventName);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`Meta Pixel ${method} event failed.`, error);
    }
  }
}

export function trackMetaPixelStandardEvent(eventName: string, payload?: MetaPixelPayload) {
  trackMetaPixel("track", eventName, payload);
}

export function trackMetaPixelCustomEvent(eventName: string, payload?: MetaPixelPayload) {
  trackMetaPixel("trackCustom", eventName, payload);
}
