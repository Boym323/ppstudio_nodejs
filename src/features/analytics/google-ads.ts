"use client";

export function isGoogleAdsConfigured() {
  return (
    process.env.NEXT_PUBLIC_GOOGLE_ADS_ENABLED === "true" &&
    Boolean(process.env.NEXT_PUBLIC_GOOGLE_ADS_ID)
  );
}

function shouldInitializeGoogleAds(pathname: string) {
  if (!isGoogleAdsConfigured()) {
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

type ShouldInitializeGoogleAdsTrackingOptions = {
  disabled?: boolean;
};

export function shouldInitializeGoogleAdsTracking(
  pathname: string,
  options?: ShouldInitializeGoogleAdsTrackingOptions,
) {
  return !options?.disabled && shouldInitializeGoogleAds(pathname);
}
