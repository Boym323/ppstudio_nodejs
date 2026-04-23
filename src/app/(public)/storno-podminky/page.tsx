import {
  CancellationPolicyPage,
  buildPageMetadata,
  getCancellationPageContent,
} from '@/features/public/components/public-site';

export const metadata = buildPageMetadata({
  title: 'Storno podmínky',
  description: 'Jasně formulované podmínky rušení a přesunu rezervací pro kosmetický salon.',
});

export default async function Page() {
  const content = await getCancellationPageContent();

  return <CancellationPolicyPage content={content} />;
}
