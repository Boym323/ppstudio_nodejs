import { LegalPage, buildPageMetadata, getLegalPages } from '@/features/public/components/public-site';
import { getPublicSalonProfile } from '@/lib/site-settings';

export const metadata = buildPageMetadata({
  title: 'GDPR',
  description: 'Přehled zásad zpracování osobních údajů v PP Studiu včetně účelů, doby uchování a kontaktu pro dotazy.',
  path: '/gdpr',
});

export default async function Page() {
  const [legalPages, salonProfile] = await Promise.all([getLegalPages(), getPublicSalonProfile()]);
  const emailHref = `mailto:${salonProfile.email}?subject=${encodeURIComponent('Dotaz k ochraně osobních údajů')}`;
  const phoneHref = `tel:${salonProfile.phone.replace(/\s+/g, '')}`;

  return (
    <LegalPage
      eyebrow="Právní a provozní informace"
      title={legalPages.gdpr.title}
      description={legalPages.gdpr.intro}
      sections={legalPages.gdpr.sections}
      secondaryCta={{ href: emailHref, label: 'Napsat ohledně osobních údajů' }}
      heroAside={{
        eyebrow: 'Kontakt správce',
        title: 'Správce osobních údajů',
        description: 'Pokud máte dotaz ke zpracování osobních údajů, můžete nás kontaktovat.',
        items: [
          { label: 'Studio', value: salonProfile.name },
          { label: 'Adresa', value: salonProfile.addressLine },
          { label: 'E-mail', value: salonProfile.email, href: emailHref },
          { label: 'Telefon', value: salonProfile.phone, href: phoneHref },
        ],
      }}
      showTableOfContents
    />
  );
}
