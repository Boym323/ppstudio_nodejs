import { buildPageMetadata } from '@/features/public/components/public-page-metadata';
import { ContactPage } from '@/features/public/components/contact-page';

export const metadata = buildPageMetadata({
  title: 'Kontakt',
  description: 'Kde najdete PP Studio ve Zlíně a jak se mi ozvat? Zavolejte, napište e-mail nebo zprávu na Instagram. Ráda vám poradím.',
  path: '/kontakt',
});

export default function Page() {
  return <ContactPage />;
}
