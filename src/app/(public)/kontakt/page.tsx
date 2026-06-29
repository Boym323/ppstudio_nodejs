import { buildPageMetadata } from '@/features/public/components/public-page-metadata';
import { ContactPage } from '@/features/public/components/contact-page';

export const metadata = buildPageMetadata({
  title: 'Kontakt',
  description: 'Kontaktní údaje, praktické informace a jasná cesta k rezervaci termínu.',
  path: '/kontakt',
});

export default function Page() {
  return <ContactPage />;
}
