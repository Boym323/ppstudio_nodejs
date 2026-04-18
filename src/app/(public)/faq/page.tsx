import { FaqPage, buildPageMetadata } from '@/features/public/components/public-site';

export const metadata = buildPageMetadata({
  title: 'FAQ',
  description: 'Nejčastější otázky ke službám, první návštěvě, rezervaci a základním provozním pravidlům salonu.',
});

export default function Page() {
  return <FaqPage />;
}
