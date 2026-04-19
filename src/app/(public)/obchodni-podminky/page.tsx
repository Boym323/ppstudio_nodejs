import { LegalPage, buildPageMetadata, getLegalPages } from '@/features/public/components/public-site';

export const metadata = buildPageMetadata({
  title: 'Obchodní podmínky',
  description: 'Základ obchodních podmínek pro rezervační a provozní fungování kosmetického salonu.',
});

export default async function Page() {
  const legalPages = await getLegalPages();

  return (
    <LegalPage
      eyebrow="Právní a provozní informace"
      title={legalPages.terms.title}
      description={legalPages.terms.intro}
      sections={legalPages.terms.sections}
    />
  );
}
