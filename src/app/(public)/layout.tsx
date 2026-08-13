import { connection } from "next/server";

import { SiteShell } from "@/components/layout/site-shell";
import { SeoJsonLd, buildLocalBusinessJsonLd } from "@/features/public/components/seo-json-ld";
import { getPublicSalonProfile } from "@/lib/site-settings";

export default async function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Veřejný profil je runtime konfigurace v databázi; jeho čtení proto nepatří
  // do prerenderingu release buildu před aplikováním migrací.
  await connection();
  const salonProfile = await getPublicSalonProfile();

  return (
    <>
      <SeoJsonLd data={buildLocalBusinessJsonLd(salonProfile)} />
      <SiteShell>{children}</SiteShell>
    </>
  );
}
