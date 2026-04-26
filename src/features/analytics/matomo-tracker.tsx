"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  buildSafeMatomoPath,
  isMatomoConfigured,
  normalizeMatomoUrl,
  shouldInitializeMatomo,
  shouldTrackMatomoPath,
} from "./matomo";

export function MatomoTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const matomoUrl = process.env.NEXT_PUBLIC_MATOMO_URL;
  const siteId = process.env.NEXT_PUBLIC_MATOMO_SITE_ID;
  const shouldInitialize = isMatomoConfigured() && shouldInitializeMatomo(pathname);
  const shouldTrackPageview = shouldTrackMatomoPath(pathname);
  const initialPathname = useRef(pathname);
  const initialScriptTrackedPageview = useRef(shouldTrackPageview);

  useEffect(() => {
    if (!shouldInitialize || !shouldTrackPageview || !window._paq) {
      return;
    }

    if (
      initialScriptTrackedPageview.current
      && pathname === initialPathname.current
    ) {
      return;
    }

    const safePath = buildSafeMatomoPath(pathname, searchParams);

    try {
      window._paq.push(["setCustomUrl", safePath]);
      window._paq.push(["setDocumentTitle", document.title]);
      window._paq.push(["trackPageView"]);
      window._paq.push(["enableLinkTracking"]);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("Matomo pageview failed.", error);
      }
    }
  }, [pathname, searchParams, shouldInitialize, shouldTrackPageview]);

  if (!shouldInitialize || !matomoUrl || !siteId) {
    return null;
  }

  const trackerUrl = normalizeMatomoUrl(matomoUrl);
  const safeInitialPath = buildSafeMatomoPath(pathname, searchParams);
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
            window._paq.push(['setCustomUrl', ${JSON.stringify(safeInitialPath)}]);
            ${shouldTrackPageview ? "window._paq.push(['trackPageView']);" : ""}
            window._paq.push(['enableLinkTracking']);
          `,
        }}
      />
      <Script id="matomo-script" src={`${trackerUrl}matomo.js`} strategy="afterInteractive" />
    </>
  );
}
