import { ServicesPage, buildPageMetadata } from '@/features/public/components/public-site';

export const metadata = buildPageMetadata({
  title: 'Služby',
  description: 'Přehled kosmetických služeb s důrazem na srozumitelnost, důvěru a jednoduchý výběr vhodné péče.',
});

export default function Page() {
  return <ServicesPage />;
}
