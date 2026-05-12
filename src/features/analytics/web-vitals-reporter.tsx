"use client";

import { useReportWebVitals } from "next/web-vitals";

import { trackMatomoEvent } from "./matomo";

type ReportWebVitalsCallback = Parameters<typeof useReportWebVitals>[0];

const reportWebVital: ReportWebVitalsCallback = (metric) => {
  const value = Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value);

  trackMatomoEvent("Web Vitals", metric.name, metric.rating, value);
};

export function WebVitalsReporter() {
  const isEnabled = process.env.NEXT_PUBLIC_WEB_VITALS_ENABLED === "true";

  useReportWebVitals((metric) => {
    if (!isEnabled) {
      return;
    }

    reportWebVital(metric);
  });

  return null;
}
