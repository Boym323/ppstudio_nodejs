"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { buildSafeMatomoPath } from "./matomo";
import { isGoogleAdsConfigured, shouldInitializeGoogleAdsTracking } from "./google-ads";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

type GoogleAdsTrackerProps = {
  disabled?: boolean;
};

export function GoogleAdsTracker({ disabled = false }: GoogleAdsTrackerProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tagId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  const shouldInitialize = isGoogleAdsConfigured() && shouldInitializeGoogleAdsTracking(pathname, { disabled });
  const trackedPathRef = useRef(buildSafeMatomoPath(pathname, searchParams));

  useEffect(() => {
    if (!shouldInitialize || !tagId || !window.gtag) {
      return;
    }

    const safePath = buildSafeMatomoPath(pathname, searchParams);

    if (safePath === trackedPathRef.current) {
      return;
    }

    try {
      window.gtag("config", tagId, {
        page_path: safePath,
        page_title: document.title,
      });
      trackedPathRef.current = safePath;
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("Google Ads pageview failed.", error);
      }
    }
  }, [pathname, searchParams, shouldInitialize, tagId]);

  if (!shouldInitialize || !tagId) {
    return null;
  }

  const safeInitialPath = buildSafeMatomoPath(pathname, searchParams);

  return (
    <>
      <Script
        id="google-ads-script"
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(tagId)}`}
        strategy="afterInteractive"
      />
      <Script
        id="google-ads-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            window.gtag = window.gtag || function gtag(){window.dataLayer.push(arguments);};
            window.gtag('js', new Date());
            window.gtag('config', ${JSON.stringify(tagId)}, {
              page_path: ${JSON.stringify(safeInitialPath)}
            });
          `,
        }}
      />
    </>
  );
}
