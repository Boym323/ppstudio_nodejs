"use client";

import { useReportWebVitals } from "next/web-vitals";

import { trackMatomoEvent } from "./matomo";

type ReportWebVitalsCallback = Parameters<typeof useReportWebVitals>[0];

const reportWebVital: ReportWebVitalsCallback = (metric) => {
  const value = Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value);

  trackMatomoEvent("Web Vitals", metric.name, metric.rating, value);
};

export function WebVitalsReporter() {
  useReportWebVitals(reportWebVital);

  return null;
}
