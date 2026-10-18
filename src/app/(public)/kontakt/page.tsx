import { buildPageMetadata } from '@/features/public/components/public-page-metadata';
import { ContactPage } from '@/features/public/components/contact-page';

export const metadata = buildPageMetadata({
  title: 'Kontakt',
  description: 'Kontaktujte PP Studio ve Zlíně. Najdete zde telefon, e-mail, praktické informace i možnost rezervace kosmetického ošetření.',
  path: '/kontakt',
});

export default function Page() {
  return <ContactPage />;
}
