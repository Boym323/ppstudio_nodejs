import { buildPageMetadata } from '@/features/public/components/public-page-metadata';
import { ContactPage } from '@/features/public/components/contact-page';

export const metadata = buildPageMetadata({
  title: 'Kontakt',
  description: 'Ráda vám poradím s výběrem služby nebo odpovím na vaše otázky. Zavolejte, napište e-mail nebo se ozvěte přes Instagram.',
  path: '/kontakt',
});

export default function Page() {
  return <ContactPage />;
}
