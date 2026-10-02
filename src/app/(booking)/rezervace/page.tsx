import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { connection } from "next/server";

import { getPublicBookingCatalog } from "@/features/booking/lib/booking-public";
import { BookingPage } from "@/features/booking/components/booking-page";
import type { BookingEntrySource } from "@/features/booking/components/booking-flow/types";
import { buildPageMetadata } from "@/features/public/components/public-site";
import { resolvePublicBookingServiceSlug } from "@/features/public/lib/public-services";
import { normalizeVoucherCode } from "@/features/vouchers/lib/voucher-code";
import { getPublicSalonProfile } from "@/lib/site-settings";

const reservationMetadata = buildPageMetadata({
  title: "Rezervace",
  description: "Online rezervace s rychlým výběrem služby, nejbližších termínů a potvrzením po schválení.",
  path: "/rezervace",
});

const bookingEntrySources = new Set<BookingEntrySource>([
  "service_detail", "price_list", "homepage", "voucher", "direct_booking", "other",
]);

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;

  if (Object.keys(resolvedSearchParams).length === 0) return reservationMetadata;

  return {
    ...reservationMetadata,
    robots: {
      index: false,
      follow: true,
    },
  };
}

export default async function ReservationPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const serviceSlug = Array.isArray(resolvedSearchParams.service)
    ? resolvedSearchParams.service[0]
    : resolvedSearchParams.service;
  const serviceSlugResolution = typeof serviceSlug === "string" && serviceSlug.length > 0
    ? await resolvePublicBookingServiceSlug(serviceSlug)
    : null;

  if (serviceSlugResolution && !serviceSlugResolution.isCanonical) {
    const canonicalSearchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(resolvedSearchParams)) {
      if (key === "service" || value === undefined) continue;
      for (const item of Array.isArray(value) ? value : [value]) {
        canonicalSearchParams.append(key, item);
      }
    }

    canonicalSearchParams.set("service", serviceSlugResolution.slug);
    permanentRedirect(`/rezervace?${canonicalSearchParams.toString()}`);
  }

  const [catalog, salonProfile] = await Promise.all([
    getPublicBookingCatalog(),
    getPublicSalonProfile(),
  ]);
  const initialSelectedServiceSlug =
    typeof serviceSlug === "string" && serviceSlug.length > 0 ? serviceSlug : undefined;
  const voucherCode = Array.isArray(resolvedSearchParams.voucher)
    ? resolvedSearchParams.voucher[0]
    : resolvedSearchParams.voucher;
  const normalizedVoucherCode = normalizeVoucherCode(voucherCode ?? "");
  const source = Array.isArray(resolvedSearchParams.source)
    ? resolvedSearchParams.source[0]
    : resolvedSearchParams.source;
  const bookingEntrySource = typeof source === "string" && bookingEntrySources.has(source as BookingEntrySource)
    ? source as BookingEntrySource
    : "direct_booking";

  return (
    <BookingPage
      catalog={catalog}
      initialSelectedServiceSlug={initialSelectedServiceSlug}
      initialVoucherCode={normalizedVoucherCode || undefined}
      bookingEntrySource={bookingEntrySource}
      salonProfile={salonProfile}
    />
  );
}
