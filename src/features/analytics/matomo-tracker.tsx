"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  buildSafeMatomoPath,
  isMatomoConfigured,
  markMatomoTrackingState,
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
  const siteId = process.env.NEXT_PUBLIC_MATOMO_SITE_ID;
  const shouldInitialize = isMatomoConfigured() && shouldInitializeMatomoTracking(pathname, { disabled });
  const shouldTrackPageview = shouldTrackMatomoPath(pathname);
  const safeCurrentPath = buildSafeMatomoPath(pathname, searchParams);
  const initialPathRef = useRef(safeCurrentPath);
  const trackedPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!shouldInitialize || !matomoUrl || !siteId) {
      return;
    }

    const queue = window._paq ?? [];

    if (!window._paq) {
      window._paq = queue;
    }

    const isInitialBootstrap = trackedPathRef.current === null;
    const safePath = buildSafeMatomoPath(pathname, searchParams);
    const hasBootstrappedCurrentPath =
      window.__matomoTrackerConfigured === true && window.__matomoTrackedPath === safePath;

    if (isInitialBootstrap && safePath === initialPathRef.current && hasBootstrappedCurrentPath) {
      trackedPathRef.current = safePath;
      return;
    }

    if (safePath === trackedPathRef.current) {
      return;
    }

    try {
      if (isInitialBootstrap) {
        queue.push(["setTrackerUrl", `${normalizeMatomoUrl(matomoUrl)}matomo.php`]);
        queue.push(["setSiteId", siteId]);
        queue.push(["enableHeartBeatTimer", 15]);
        queue.push(["enableLinkTracking"]);
      }

      queue.push(["setCustomUrl", safePath]);
      markMatomoTrackingState(safePath);

      if (shouldTrackPageview) {
        queue.push(["setDocumentTitle", document.title]);
        queue.push(["trackPageView"]);
      }

      trackedPathRef.current = safePath;
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("Matomo pageview failed.", error);
      }
    }
  }, [matomoUrl, pathname, searchParams, shouldInitialize, shouldTrackPageview, siteId]);

  if (!shouldInitialize || !matomoUrl || !siteId) {
    return null;
  }

  const trackerUrl = normalizeMatomoUrl(matomoUrl);
  const trackerEndpoint = `${trackerUrl}matomo.php`;

  return (
    <>
      <Script
        id="matomo-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window._paq = window._paq || [];
            window._paq.push(['setTrackerUrl', ${JSON.stringify(trackerEndpoint)}]);
            window._paq.push(['setSiteId', ${JSON.stringify(siteId)}]);
            window._paq.push(['enableHeartBeatTimer', 15]);
            window._paq.push(['setCustomUrl', ${JSON.stringify(safeCurrentPath)}]);
            window.__matomoTrackerConfigured = true;
            window.__matomoTrackedPath = ${JSON.stringify(safeCurrentPath)};
            ${shouldTrackPageview ? "window._paq.push(['setDocumentTitle', document.title]);window._paq.push(['trackPageView']);" : ""}
            window._paq.push(['enableLinkTracking']);
          `,
        }}
      />
      <Script id="matomo-script" src={`${trackerUrl}matomo.js`} strategy="afterInteractive" />
    </>
  );
}
