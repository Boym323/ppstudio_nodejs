"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  BOOKING_ACQUISITION_COOKIE,
  buildBookingAcquisitionCookieHeader,
  buildBookingAcquisitionCookieValue,
} from "@/features/booking/lib/booking-acquisition";

function readCookieValue(name: string) {
  if (typeof document === "undefined") {
    return undefined;
  }

  const encodedName = `${encodeURIComponent(name)}=`;

  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();

    if (trimmed.startsWith(encodedName)) {
      return trimmed.slice(encodedName.length);
    }
  }

  return undefined;
}

export function BookingAcquisitionTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();

  useEffect(() => {
    if (pathname.startsWith("/admin")) {
      return;
    }

    const existingValue = readCookieValue(BOOKING_ACQUISITION_COOKIE);
    const cookieValue = buildBookingAcquisitionCookieValue({
      pathname,
      search: searchParamsKey.length > 0 ? `?${searchParamsKey}` : "",
      hostname: window.location.hostname,
      referrer: document.referrer,
      existingCookieValue: existingValue,
    });

    if (!cookieValue) {
      return;
    }

    document.cookie = buildBookingAcquisitionCookieHeader(cookieValue);
  }, [pathname, searchParamsKey]);

  return null;
}
