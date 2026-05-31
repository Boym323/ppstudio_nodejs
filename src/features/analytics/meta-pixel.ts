"use client";

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
