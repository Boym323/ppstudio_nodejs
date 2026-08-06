"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  isMetaPixelConfigured,
  shouldInitializeMetaPixelTracking,
  shouldTrackMetaPixelPageView,
  trackMetaPixelPageView,
} from "./meta-pixel";

type MetaPixelTrackerProps = {
  disabled?: boolean;
};

export function MetaPixelTracker({ disabled = false }: MetaPixelTrackerProps) {
  const pathname = usePathname();
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const shouldInitialize = isMetaPixelConfigured() && shouldInitializeMetaPixelTracking(pathname, { disabled });
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (!shouldTrackMetaPixelPageView(previousPathname.current, pathname)) {
      return;
    }

    previousPathname.current = pathname;

    if (!shouldInitialize) {
      return;
    }

    trackMetaPixelPageView();
  }, [pathname, shouldInitialize]);

  if (!shouldInitialize || !pixelId) {
    return null;
  }

  return (
    <>
      <Script
        id="meta-pixel-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', ${JSON.stringify(pixelId)});
            fbq('track', 'PageView');
          `,
        }}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt=""
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${encodeURIComponent(pixelId)}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
