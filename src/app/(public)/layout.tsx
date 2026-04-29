import { SiteShell } from "@/components/layout/site-shell";
import { SeoJsonLd, buildSalonJsonLd } from "@/features/public/components/seo-json-ld";
import { getPublicSalonProfile } from "@/lib/site-settings";

export default async function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const salonProfile = await getPublicSalonProfile();

  return (
    <>
      <SeoJsonLd data={buildSalonJsonLd(salonProfile)} />
      <SiteShell>{children}</SiteShell>
    </>
  );
}
