"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

import { isClarityConfigured, shouldInitializeClarityTracking } from "./clarity";

type ClarityTrackerProps = {
  disabled?: boolean;
};

export function ClarityTracker({ disabled = false }: ClarityTrackerProps) {
  const pathname = usePathname();
  const projectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
  const shouldInitialize = isClarityConfigured() && shouldInitializeClarityTracking(pathname, { disabled });

  if (!shouldInitialize || !projectId) {
    return null;
  }

  return (
    <Script
      id="clarity-init"
      strategy="lazyOnload"
      dangerouslySetInnerHTML={{
        __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window, document, "clarity", "script", ${JSON.stringify(projectId)});`,
      }}
    />
  );
}
