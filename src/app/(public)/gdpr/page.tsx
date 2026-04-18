import { LegalPage, buildPageMetadata, legalPages } from '@/features/public/components/public-site';

export const metadata = buildPageMetadata({
  title: 'GDPR',
  description: 'Zásady zpracování osobních údajů a editovatelný základ pro finální GDPR dokumentaci salonu.',
});

export default function Page() {
  return (
    <LegalPage
      eyebrow="Právní a provozní informace"
      title={legalPages.gdpr.title}
      description={legalPages.gdpr.intro}
      sections={legalPages.gdpr.sections}
    />
  );
}
