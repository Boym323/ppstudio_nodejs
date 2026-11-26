"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useLayoutEffect } from "react";

import {
  buildSafeMatomoPath,
  claimMatomoPageview,
  ensureMatomoTrackingPath,
  isMatomoConfigured,
  normalizeMatomoUrl,
  shouldInitializeMatomoTracking,
  shouldTrackMatomoPath,
} from "./matomo";

type MatomoTrackerProps = {
  disabled?: boolean;
};

export function MatomoTracker({ disabled = false }: MatomoTrackerProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const matomoUrl = process.env.NEXT_PUBLIC_MATOMO_URL;
  const shouldInitialize = isMatomoConfigured() && shouldInitializeMatomoTracking(pathname, { disabled });
  const shouldTrackPageview = shouldTrackMatomoPath(pathname);

  useLayoutEffect(() => {
    if (!shouldInitialize) return;

    const safePath = buildSafeMatomoPath(pathname, searchParams);
    ensureMatomoTrackingPath(safePath, {
      trackPageView: claimMatomoPageview(safePath, shouldTrackPageview),
    });
  }, [pathname, searchParams, shouldInitialize, shouldTrackPageview]);

  if (!shouldInitialize || !matomoUrl) return null;

  return (
    <Script id="matomo-script" src={`${normalizeMatomoUrl(matomoUrl)}matomo.js`} strategy="afterInteractive" />
  );
}
