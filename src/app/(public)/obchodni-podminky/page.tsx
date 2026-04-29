import { LegalPage, buildPageMetadata, getLegalPages } from '@/features/public/components/public-site';
import { getPublicSalonProfile } from '@/lib/site-settings';

export const metadata = buildPageMetadata({
  title: 'Obchodní podmínky',
  description: 'Přehled obchodních podmínek PP Studia včetně rezervací, storna, plateb, průběhu služeb a reklamací.',
  path: '/obchodni-podminky',
});

export default async function Page() {
  const [legalPages, salonProfile] = await Promise.all([getLegalPages(), getPublicSalonProfile()]);
  const emailHref = `mailto:${salonProfile.email}?subject=${encodeURIComponent('Dotaz k rezervaci')}`;
  const phoneHref = `tel:${salonProfile.phone.replace(/\s+/g, '')}`;

  return (
    <LegalPage
      eyebrow="Právní a provozní informace"
      title={legalPages.terms.title}
      description={legalPages.terms.intro}
      ctaPrompt="Máte dotaz k rezervaci?"
      sections={legalPages.terms.sections}
      secondaryCta={{ href: '/kontakt', label: 'Kontaktovat studio' }}
      heroAside={{
        eyebrow: 'Poskytovatel služeb',
        title: 'PP Studio',
        description: 'Praktické kontaktní údaje a identifikace provozovatelky pro rezervace i reklamace.',
        items: [
          { label: 'Provozovatelka', value: salonProfile.operatorName },
          { label: 'Adresa', value: salonProfile.addressLine },
          { label: 'IČO', value: salonProfile.businessId },
          { label: 'E-mail', value: salonProfile.email, href: emailHref },
          { label: 'Telefon', value: salonProfile.phone, href: phoneHref },
        ],
      }}
      showTableOfContents
    />
  );
}
