import { PublicHomePage, buildPageMetadata } from '@/features/public/components/public-site';

export const metadata = buildPageMetadata({
  title: 'Luxusní kosmetický salon',
  description:
    'Moderní prezentační web pro kosmetický salon s důrazem na důvěru, čisté UX a silnou cestu k rezervaci.',
});

export default function Page() {
  return <PublicHomePage />;
}
