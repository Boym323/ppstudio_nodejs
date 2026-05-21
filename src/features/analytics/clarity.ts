"use client";

export function isClarityConfigured() {
  return (
    process.env.NEXT_PUBLIC_CLARITY_ENABLED === "true" &&
    Boolean(process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID)
  );
}

function shouldInitializeClarity(pathname: string) {
  if (!isClarityConfigured()) {
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

type ShouldInitializeClarityTrackingOptions = {
  disabled?: boolean;
};

export function shouldInitializeClarityTracking(
  pathname: string,
  options?: ShouldInitializeClarityTrackingOptions,
) {
  return !options?.disabled && shouldInitializeClarity(pathname);
}
