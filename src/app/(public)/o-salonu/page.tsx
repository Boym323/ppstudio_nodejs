import { AboutPage, buildPageMetadata } from '@/features/public/components/public-site';

export const metadata = buildPageMetadata({
  title: 'O salonu',
  description: 'Příběh salonu, hodnoty značky a obsahová struktura připravená pro důvěryhodnou prezentaci.',
});

export default function Page() {
  return <AboutPage />;
}
