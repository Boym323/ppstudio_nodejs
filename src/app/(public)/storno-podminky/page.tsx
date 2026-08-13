import {
  CancellationPolicyPage,
  buildPageMetadata,
  getCancellationPageContent,
} from '@/features/public/components/public-site';

export const metadata = buildPageMetadata({
  title: 'Storno podmínky',
  description: 'Jasně formulované podmínky rušení a přesunu rezervací pro kosmetický salon.',
  path: '/storno-podminky',
});

export default async function Page() {
  await connection();
  const content = await getCancellationPageContent();

  return <CancellationPolicyPage content={content} />;
}
import { connection } from 'next/server';
