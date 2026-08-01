import type { Metadata } from "next";
import { connection } from "next/server";

import { getPublicBookingCatalog } from "@/features/booking/lib/booking-public";
import { BookingPage } from "@/features/booking/components/booking-page";
import { buildPageMetadata } from "@/features/public/components/public-site";
import { normalizeVoucherCode } from "@/features/vouchers/lib/voucher-code";
import { getPublicSalonProfile } from "@/lib/site-settings";

const reservationMetadata = buildPageMetadata({
  title: "Rezervace",
  description: "Online rezervace s rychlým výběrem služby, nejbližších termínů a potvrzením po schválení.",
  path: "/rezervace",
});

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

  const [catalog, salonProfile] = await Promise.all([
    getPublicBookingCatalog(),
    getPublicSalonProfile(),
  ]);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const serviceSlug = Array.isArray(resolvedSearchParams?.service)
    ? resolvedSearchParams?.service[0]
    : resolvedSearchParams?.service;
  const initialSelectedServiceSlug =
    typeof serviceSlug === "string" && serviceSlug.length > 0 ? serviceSlug : undefined;
  const voucherCode = Array.isArray(resolvedSearchParams?.voucher)
    ? resolvedSearchParams?.voucher[0]
    : resolvedSearchParams?.voucher;
  const normalizedVoucherCode = normalizeVoucherCode(voucherCode ?? "");

  return (
    <BookingPage
      catalog={catalog}
      initialSelectedServiceSlug={initialSelectedServiceSlug}
      initialVoucherCode={normalizedVoucherCode || undefined}
      salonProfile={salonProfile}
    />
  );
}
