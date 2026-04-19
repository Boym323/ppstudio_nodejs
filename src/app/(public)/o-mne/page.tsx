import { AboutPage } from '@/features/public/components/about-page';
import { buildPageMetadata } from '@/features/public/components/public-site';

export const metadata = buildPageMetadata({
  title: 'O mně',
  description: 'Poznejte příběh a přístup Pavlíny Pomykalové v PP Studiu.',
});

export default function Page() {
  return <AboutPage />;
}
