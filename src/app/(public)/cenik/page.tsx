import { PricingPage, buildPageMetadata } from '@/features/public/components/public-site';

export const metadata = buildPageMetadata({
  title: 'Ceník',
  description: 'Přehledný ceník kosmetických služeb navržený pro rychlé rozhodnutí a pohodlné čtení na mobilu.',
});

export default function Page() {
  return <PricingPage />;
}
