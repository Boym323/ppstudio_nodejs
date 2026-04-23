import { FaqPage, buildPageMetadata } from '@/features/public/components/public-site';

export const metadata = buildPageMetadata({
  title: 'FAQ',
  description: 'Praktické odpovědi k rezervaci, první návštěvě, komfortu i storno podmínkám, které pomáhají rozhodnout se bez nejistoty.',
});

export default function Page() {
  return <FaqPage />;
}
