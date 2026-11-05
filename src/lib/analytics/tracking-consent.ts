export const TRACKING_CONSENT_COOKIE = "ppstudio-tracking-consent-v1";
export const TRACKING_CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export type TrackingConsent = {
  analytics: boolean;
  marketing: boolean;
};

export function parseTrackingConsent(value?: string | null): TrackingConsent | null {
  if (!value || !/^a[01]m[01]$/.test(value)) return null;
  return { analytics: value[1] === "1", marketing: value[3] === "1" };
}

export function serializeTrackingConsent(consent: TrackingConsent): string {
  return `a${consent.analytics ? "1" : "0"}m${consent.marketing ? "1" : "0"}`;
}

export function hasTrackingConsent(category: keyof TrackingConsent): boolean {
  if (typeof document === "undefined") return false;
  const prefix = `${TRACKING_CONSENT_COOKIE}=`;
  const item = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return parseTrackingConsent(item?.slice(prefix.length))?.[category] === true;
}
