"use client";

import { useEffect } from "react";

import { trackMetaPixelStandardEvent } from "./meta-pixel";

type MetaPixelViewContentTrackerProps = {
  service: {
    slug: string;
    name: string;
    category: string;
    durationMinutes?: number;
    priceFromCzk?: number | null;
  };
};

export function MetaPixelViewContentTracker({
  service,
}: MetaPixelViewContentTrackerProps) {
  useEffect(() => {
    document.documentElement.dataset.metaPixelViewContent = service.slug;

    trackMetaPixelStandardEvent("ViewContent", {
      content_type: "service",
      content_ids: service.slug,
      content_name: service.name,
      content_category: service.category,
      duration_minutes: service.durationMinutes,
      value: service.priceFromCzk ?? undefined,
      currency: service.priceFromCzk ? "CZK" : undefined,
    });

    return () => {
      if (document.documentElement.dataset.metaPixelViewContent === service.slug) {
        delete document.documentElement.dataset.metaPixelViewContent;
      }
    };
  }, [service.category, service.durationMinutes, service.name, service.priceFromCzk, service.slug]);

  return null;
}
