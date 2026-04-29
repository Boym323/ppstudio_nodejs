import { ContactPage, buildPageMetadata } from '@/features/public/components/public-site';

export const metadata = buildPageMetadata({
  title: 'Kontakt',
  description: 'Kontaktní údaje, praktické informace a jasná cesta k rezervaci termínu.',
  path: '/kontakt',
});

export default function Page() {
  return <ContactPage />;
}
