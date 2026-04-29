import type { Metadata } from "next";
import { connection } from "next/server";

import { getPublicBookingCatalog } from "@/features/booking/lib/booking-public";
import { BookingPage } from "@/features/booking/components/booking-page";
import { buildPageMetadata } from "@/features/public/components/public-site";
import { getPublicSalonProfile } from "@/lib/site-settings";

export const metadata: Metadata = buildPageMetadata({
  title: "Rezervace",
  description: "Online rezervace s rychlým výběrem služby, nejbližších termínů a potvrzením po schválení.",
  path: "/rezervace",
});

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

  return (
    <BookingPage
      catalog={catalog}
      initialSelectedServiceSlug={initialSelectedServiceSlug}
      salonProfile={salonProfile}
    />
  );
}
