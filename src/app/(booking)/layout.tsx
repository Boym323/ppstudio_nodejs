import { connection } from "next/server";

import { SiteShell } from "@/components/layout/site-shell";
import { SeoJsonLd, buildLocalBusinessJsonLd } from "@/features/public/components/seo-json-ld";

import "./booking-layout.css";
import { getPublicSalonProfile } from "@/lib/site-settings";

export default async function BookingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Rezervační shell používá runtime SiteSettings. `connection()` garantuje,
  // že Next.js jeho databázové čtení nespustí při release buildu.
  await connection();
  const salonProfile = await getPublicSalonProfile();

  return (
    <>
      <SeoJsonLd data={buildLocalBusinessJsonLd(salonProfile)} />
      <SiteShell variant="booking">{children}</SiteShell>
    </>
  );
}
