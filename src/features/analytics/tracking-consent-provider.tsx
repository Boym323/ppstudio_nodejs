"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

import {
  TRACKING_CONSENT_COOKIE,
  TRACKING_CONSENT_MAX_AGE_SECONDS,
  serializeTrackingConsent,
  type TrackingConsent,
} from "@/lib/analytics/tracking-consent";
import { BOOKING_ACQUISITION_COOKIE } from "@/features/booking/lib/booking-acquisition";

type TrackingConsentContextValue = {
  consent: TrackingConsent | null;
  openSettings: () => void;
};
const TrackingConsentContext = createContext<TrackingConsentContextValue | null>(null);

const anyTrackingEnabled =
  process.env.NEXT_PUBLIC_META_PIXEL_ENABLED === "true" ||
  process.env.NEXT_PUBLIC_GOOGLE_ADS_ENABLED === "true" ||
  process.env.NEXT_PUBLIC_MATOMO_ENABLED === "true" ||
  process.env.NEXT_PUBLIC_CLARITY_ENABLED === "true";

export function useTrackingConsent(category: keyof TrackingConsent): boolean {
  return useContext(TrackingConsentContext)?.consent?.[category] === true;
}

export function TrackingConsentSettingsButton() {
  const context = useContext(TrackingConsentContext);
  if (!anyTrackingEnabled || !context) return null;
  return (
    <button
      type="button"
      className="underline underline-offset-4 hover:text-[var(--color-foreground)]"
      onClick={context.openSettings}
    >
      Nastavení cookies
    </button>
  );
}

export function TrackingConsentProvider({
  children,
  initialConsent,
}: {
  children: ReactNode;
  initialConsent: TrackingConsent | null;
}) {
  const [consent, setConsent] = useState<TrackingConsent | null>(initialConsent);
  const [showSettings, setShowSettings] = useState(initialConsent === null);
  const [analytics, setAnalytics] = useState(initialConsent?.analytics ?? false);
  const [marketing, setMarketing] = useState(initialConsent?.marketing ?? false);

  function saveChoice(next: TrackingConsent) {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie =
      `${TRACKING_CONSENT_COOKIE}=${serializeTrackingConsent(next)}; Max-Age=${TRACKING_CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
    if (!next.analytics) {
      document.cookie = `${BOOKING_ACQUISITION_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
    }

    const wasGrantedAndRevoked = Boolean(
      (consent?.analytics && !next.analytics) ||
      (consent?.marketing && !next.marketing),
    );
    setConsent(next);
    setAnalytics(next.analytics);
    setMarketing(next.marketing);
    setShowSettings(false);
    window.dispatchEvent(new Event("ppstudio:tracking-consent-changed"));

    // Already loaded third-party scripts (including Matomo heartbeat) cannot
    // reliably be unloaded; reload after revocation so no tracker stays active.
    if (wasGrantedAndRevoked) window.location.reload();
  }

  function openSettings() {
    setAnalytics(consent?.analytics ?? false);
    setMarketing(consent?.marketing ?? false);
    setShowSettings(true);
  }

  return (
    <TrackingConsentContext.Provider value={{ consent, openSettings }}>
      {children}
      {anyTrackingEnabled && showSettings ? (
        <section
          role="dialog"
          aria-label="Nastavení cookies"
          aria-modal="false"
          className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-2xl rounded-2xl border border-black/10 bg-[var(--color-surface)] p-5 shadow-2xl sm:bottom-6 sm:p-6"
        >
          <h2 className="font-display text-xl text-[var(--color-foreground)]">Nastavení cookies</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
            Nezbytné cookies slouží provozu rezervací. Analytické a marketingové
            nástroje zapneme pouze s vaším souhlasem. Volbu můžete kdykoliv změnit v patičce.
          </p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm text-[var(--color-foreground)]">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} />
              Analytické cookies
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
              Marketingové cookies
            </label>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={() => saveChoice({ analytics: false, marketing: false })}
              className="rounded-full border border-black/20 px-4 py-2 text-sm">
              Odmítnout volitelné
            </button>
            <button type="button" onClick={() => saveChoice({ analytics, marketing })}
              className="rounded-full border border-black/20 px-4 py-2 text-sm">
              Uložit volbu
            </button>
            <button type="button" onClick={() => saveChoice({ analytics: true, marketing: true })}
              className="rounded-full bg-[var(--color-foreground)] px-4 py-2 text-sm text-[var(--color-background)]">
              Povolit vše
            </button>
          </div>
        </section>
      ) : null}
    </TrackingConsentContext.Provider>
  );
}
