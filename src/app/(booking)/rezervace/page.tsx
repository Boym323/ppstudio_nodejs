import type { Metadata } from "next";
import { connection } from "next/server";

import { getPublicBookingCatalog } from "@/features/booking/lib/booking-public";
import { BookingPage } from "@/features/booking/components/booking-page";

export const metadata: Metadata = {
  title: "Rezervace",
  description: "Online rezervace s rychlým výběrem služby, nejbližších termínů a potvrzením po schválení.",
};

export default async function ReservationPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();

  const catalog = await getPublicBookingCatalog();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const serviceSlug = Array.isArray(resolvedSearchParams?.service)
    ? resolvedSearchParams?.service[0]
    : resolvedSearchParams?.service;
  const initialSelectedServiceSlug =
    typeof serviceSlug === "string" && serviceSlug.length > 0 ? serviceSlug : undefined;

  return <BookingPage catalog={catalog} initialSelectedServiceSlug={initialSelectedServiceSlug} />;
}
