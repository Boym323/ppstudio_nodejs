import { connection } from 'next/server';
import { getPublicCertificates } from '@/features/public/lib/public-certificates';
import { AboutPage } from '@/features/public/components/about-page';
import { buildPageMetadata } from '@/features/public/components/public-site';
import { getPrimaryPublicAboutPortrait } from '@/features/public/lib/public-media';

export const metadata = buildPageMetadata({
  title: 'O mně',
  description: 'Poznejte příběh a přístup Pavlíny Pomykalové v PP Studiu.',
});

export default async function Page() {
  await connection();
  const [certificates, portrait] = await Promise.all([
    getPublicCertificates(),
    getPrimaryPublicAboutPortrait(),
  ]);

  return <AboutPage certificates={certificates} portrait={portrait} />;
}
