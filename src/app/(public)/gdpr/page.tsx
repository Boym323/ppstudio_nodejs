import { LegalPage, buildPageMetadata, getLegalPages } from '@/features/public/components/public-site';

export const metadata = buildPageMetadata({
  title: 'GDPR',
  description: 'Zásady zpracování osobních údajů a editovatelný základ pro finální GDPR dokumentaci salonu.',
});

export default async function Page() {
  const legalPages = await getLegalPages();

  return (
    <LegalPage
      eyebrow="Právní a provozní informace"
      title={legalPages.gdpr.title}
      description={legalPages.gdpr.intro}
      sections={legalPages.gdpr.sections}
    />
  );
}
