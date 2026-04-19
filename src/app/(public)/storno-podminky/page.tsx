import { LegalPage, buildPageMetadata, getLegalPages } from '@/features/public/components/public-site';

export const metadata = buildPageMetadata({
  title: 'Storno podmínky',
  description: 'Jasně formulované podmínky rušení a přesunu rezervací pro kosmetický salon.',
});

export default async function Page() {
  const legalPages = await getLegalPages();

  return (
    <LegalPage
      eyebrow="Právní a provozní informace"
      title={legalPages.cancellation.title}
      description={legalPages.cancellation.intro}
      sections={legalPages.cancellation.sections}
    />
  );
}
