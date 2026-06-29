import { buildPageMetadata } from '@/features/public/components/public-page-metadata';
import { FaqPage } from '@/features/public/components/faq-page';

export const metadata = buildPageMetadata({
  title: 'FAQ | Časté otázky',
  description: 'Praktické odpovědi k rezervaci, první návštěvě, výběru služby, parkování, voucherům i storno podmínkám v PP Studiu ve Zlíně.',
  path: '/faq',
});

export default function Page() {
  return <FaqPage />;
}
