import { Suspense } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";

import { getPublicSalonProfile } from "@/lib/site-settings";
import { getSessionCookie } from "@/lib/auth/session";
import { ClarityTracker } from "@/features/analytics/clarity-tracker";
import { GoogleAdsTracker } from "@/features/analytics/google-ads-tracker";
import { MatomoTracker } from "@/features/analytics/matomo-tracker";
import { MetaPixelTracker } from "@/features/analytics/meta-pixel-tracker";
import { WebVitalsReporter } from "@/features/analytics/web-vitals-reporter";

import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

type SiteShellProps = {
  children: React.ReactNode;
  variant?: "public" | "booking";
};

export async function SiteShell({ children, variant = "public" }: SiteShellProps) {
  await connection();
  const cookieStore = await cookies();
  const hasAdminSessionCookie = cookieStore.has(getSessionCookie().name);
  const salonProfile = await getPublicSalonProfile();

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-background)] overflow-x-clip">
      <Suspense fallback={null}>
        <ClarityTracker disabled={hasAdminSessionCookie} />
        <GoogleAdsTracker disabled={hasAdminSessionCookie} />
        <MatomoTracker disabled={hasAdminSessionCookie} />
        <MetaPixelTracker disabled={hasAdminSessionCookie} />
        <WebVitalsReporter />
      </Suspense>
      <SiteHeader variant={variant} brandName={salonProfile.name} />
      <main className="flex-1">{children}</main>
      <SiteFooter compact={variant === "booking"} />
    </div>
  );
}
