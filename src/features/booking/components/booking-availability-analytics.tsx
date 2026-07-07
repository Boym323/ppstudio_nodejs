"use client";

import { useEffect, useRef } from "react";

import { trackMatomoEvent } from "@/features/analytics/matomo";

type BookingAvailabilityAnalyticsProps = {
  eventAction: "Bez služeb" | "Bez termínů";
};

export function BookingAvailabilityAnalytics({ eventAction }: BookingAvailabilityAnalyticsProps) {
  const trackedRef = useRef(false);

  useEffect(() => {
    if (trackedRef.current) {
      return;
    }

    trackedRef.current = true;
    trackMatomoEvent("Rezervace", eventAction);
  }, [eventAction]);

  return null;
}
