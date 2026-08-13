import { SeoJsonLd, buildPersonJsonLd } from "@/features/public/components/seo-json-ld";
import { connection } from "next/server";
import { getPublicCertificates } from '@/features/public/lib/public-certificates';
import { AboutPage } from '@/features/public/components/about-page';
import { buildPageMetadata } from '@/features/public/components/public-site';
import { getPrimaryPublicAboutPortrait } from '@/features/public/lib/public-media';
import { getPublicSalonProfile } from "@/lib/site-settings";

export const metadata = buildPageMetadata({
  title: 'O mně | Pavlína Pomykalová',
  description: 'Poznejte příběh a přístup Pavlíny Pomykalové v PP Studiu.',
  path: '/o-mne',
});

export default async function Page() {
  await connection();
  const [certificates, portrait, salonProfile] = await Promise.all([
    getPublicCertificates(),
    getPrimaryPublicAboutPortrait(),
    getPublicSalonProfile(),
  ]);

  return (
    <>
      <SeoJsonLd
        data={buildPersonJsonLd({
          operatorName: salonProfile.operatorName,
          instagramUrl: salonProfile.instagramUrl,
          city: salonProfile.city,
          businessName: salonProfile.name,
        })}
      />
      <AboutPage certificates={certificates} portrait={portrait} />
    </>
  );
}
