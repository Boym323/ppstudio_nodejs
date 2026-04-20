import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';

import {
  buildContactItems,
  buildFaqItems,
  buildLegalContent,
  buildTrustMetrics,
  homepageContent,
  services,
  type ContactItem,
  type LegalSection,
  type Service,
  type TrustMetric,
} from '@/content/public-site';
import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import { getBookingPolicySettings, getPublicSalonProfile } from '@/lib/site-settings';

function PublicHero({
  eyebrow,
  title,
  description,
  benefits,
  ctaNote,
  logoImage,
  portraitImage,
  primaryCta,
  secondaryCta,
}: {
  eyebrow: string;
  title: string;
  description: string;
  benefits?: string[];
  ctaNote?: string;
  logoImage?: { src: string; alt: string; width: number; height: number };
  portraitImage?: { src: string; alt: string; width: number; height: number };
  primaryCta?: { href: string; label: string };
  secondaryCta?: { href: string; label: string };
}) {
  const isHomepageStyle = Boolean(logoImage && portraitImage);

  return (
    <section className="relative isolate overflow-hidden border-b border-black/5 bg-[radial-gradient(circle_at_top_left,rgba(226,205,182,0.5),transparent_32%),linear-gradient(180deg,#f8f2eb_0%,#f5ede4_48%,#f8f3ed_100%)]">
      <Container className="grid gap-10 py-12 sm:py-16 lg:grid-cols-[1.08fr_0.92fr] lg:items-stretch lg:py-24">
        <div className="space-y-7">
          <div className="space-y-3">
            {!isHomepageStyle ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">{eyebrow}</p>
            ) : null}
            {logoImage ? (
              <div className="relative mx-auto h-[150px] w-[150px] sm:h-[176px] sm:w-[176px]">
                <Image
                  src={logoImage.src}
                  alt={logoImage.alt}
                  fill
                  sizes="(min-width: 640px) 176px, 150px"
                  className="object-contain drop-shadow-[0_8px_20px_rgba(23,19,17,0.2)]"
                  priority
                />
              </div>
            ) : null}
            <h1 className="max-w-3xl font-display text-[2.5rem] leading-[1.04] tracking-tight text-[var(--color-foreground)] sm:text-5xl lg:text-6xl">
              {isHomepageStyle ? (
                <>
                  PP <span className="text-[var(--color-accent)]">Studio</span>
                </>
              ) : (
                title
              )}
            </h1>
            <p className="max-w-2xl text-[15px] leading-7 text-[var(--color-muted)] sm:text-lg sm:leading-8">{description}</p>
            {isHomepageStyle && benefits?.length ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {benefits.map((benefit) => (
                  <span
                    key={benefit}
                    className="rounded-full border border-[var(--color-accent)]/35 bg-[#fff7ef] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent-contrast)]"
                  >
                    {benefit}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          {(primaryCta || secondaryCta) && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {primaryCta ? (
                <Link
                  href={primaryCta.href}
                  className="inline-flex min-h-13 items-center justify-center rounded-full bg-[var(--color-foreground)] px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-[#2c221d] sm:text-sm"
                >
                  {primaryCta.label}
                </Link>
              ) : null}
              {secondaryCta ? (
                <Link
                  href={secondaryCta.href}
                  className="inline-flex min-h-13 items-center justify-center rounded-full border border-black/10 bg-white/75 px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-foreground)] hover:border-black/20 hover:bg-white sm:text-sm"
                >
                  {secondaryCta.label}
                </Link>
              ) : null}
            </div>
          )}
          {isHomepageStyle && ctaNote ? (
            <p className="max-w-2xl text-[13px] leading-6 text-[var(--color-muted)] sm:text-sm">{ctaNote}</p>
          ) : null}
        </div>
        <div className="flex">
          {portraitImage ? (
            <div className="relative w-full overflow-hidden rounded-[calc(var(--radius-panel)-0.25rem)] border border-white/80 bg-white/70 shadow-[var(--shadow-panel)] backdrop-blur">
              <Image
                src={portraitImage.src}
                alt={portraitImage.alt}
                width={portraitImage.width}
                height={portraitImage.height}
                className="h-[16rem] w-full object-cover object-center sm:h-[20rem] lg:h-[24rem]"
                priority
              />
            </div>
          ) : (
            <div className="rounded-[calc(var(--radius-panel)-0.25rem)] border border-white/75 bg-white/82 p-5 shadow-[var(--shadow-panel)] backdrop-blur sm:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">
                PP Studio
              </p>
              <p className="mt-4 max-w-md font-display text-2xl leading-[1.12] text-[var(--color-foreground)] sm:text-3xl">
                Péče vedená osobně, s prostorem pro to, co právě potřebujete.
              </p>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}

function TrustStrip({ metrics }: { metrics: TrustMetric[] }) {
  return (
    <section className="py-5 sm:py-8">
      <Container>
        <div className="grid gap-px overflow-hidden rounded-[var(--radius-panel)] border border-black/6 bg-black/6 shadow-[var(--shadow-panel)] sm:grid-cols-3">
          {metrics.map((metric) => (
            <div key={metric.label} className="space-y-2 bg-white p-5 sm:p-6">
              <p className="font-display text-2xl text-[var(--color-foreground)] sm:text-3xl">{metric.value}</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)]">
                {metric.label}
              </p>
              <p className="text-[13px] leading-6 text-[var(--color-muted)] sm:text-sm">{metric.description}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

function PlaceholderNote({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[calc(var(--radius-panel)-0.5rem)] border border-dashed border-[var(--color-accent)]/45 bg-[#fff8f1] p-5 sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">{title}</p>
      <ul className="mt-4 space-y-2 text-[13px] leading-6 text-[var(--color-muted)] sm:text-sm">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

function ServiceCard({ service }: { service: Service }) {
  return (
    <article className="flex h-full flex-col rounded-[var(--radius-panel)] border border-black/6 bg-white p-5 shadow-[var(--shadow-panel)] sm:p-6">
      <p className="w-fit rounded-full bg-[var(--color-surface)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-contrast)]">
        {service.category}
      </p>
      <h3 className="mt-4 font-display text-2xl leading-[1.08] text-[var(--color-foreground)] sm:text-3xl">{service.name}</h3>
      <p className="mt-4 flex-1 text-[15px] leading-7 text-[var(--color-muted)]">{service.intro}</p>
      <div className="mt-6 space-y-4 border-t border-black/6 pt-5 sm:flex sm:items-end sm:justify-between sm:gap-4 sm:space-y-0">
        <div className="space-y-1">
          <p className="text-sm text-[var(--color-muted)]">Od {service.priceFrom}</p>
          <p className="text-sm text-[var(--color-muted)]">{service.duration}</p>
        </div>
        <Link
          href={`/sluzby/${service.slug}`}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-black/10 px-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-foreground)] hover:border-black/20 hover:bg-[var(--color-surface)] sm:w-auto sm:text-sm"
        >
          Detail služby
        </Link>
      </div>
    </article>
  );
}

type ServiceCategoryGroup = {
  category: string;
  services: Service[];
};

const categoryLeadByName: Record<string, string> = {
  "Péče o pleť": "Ideální volba při řešení hydratace, rozjasnění a pravidelné péče o pleť.",
  "Prémiové rituály": "Delší procedury zaměřené na komfort, liftingový efekt a výraznější relaxační přínos.",
  "Brow & lash": "Úpravy obočí a řas pro upravený, přirozený vzhled bez každodenního složitého stylingu.",
};

function groupServicesByCategory(catalogServices: Service[]): ServiceCategoryGroup[] {
  const groups: ServiceCategoryGroup[] = [];

  for (const service of catalogServices) {
    const lastGroup = groups[groups.length - 1];

    if (lastGroup?.category === service.category) {
      lastGroup.services.push(service);
      continue;
    }

    groups.push({
      category: service.category,
      services: [service],
    });
  }

  return groups;
}

function getCategoryLead(category: string, services: Service[]) {
  if (categoryLeadByName[category]) {
    return categoryLeadByName[category];
  }

  const firstService = services[0];

  if (!firstService) {
    return "Přehled služeb v této kategorii.";
  }

  return firstService.intro;
}

function PricingServiceRow({ service }: { service: Service }) {
  return (
    <article className="grid gap-4 border-b border-[#dfd2c4] px-5 py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-8 sm:px-6 sm:py-5">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-4 sm:block">
          <h3 className="max-w-2xl font-display text-[1.2rem] leading-[1.12] text-[var(--color-foreground)] sm:text-[1.45rem]">
            {service.name}
          </h3>
          <div className="shrink-0 text-right sm:hidden">
            <p className="font-display text-[1.35rem] leading-none text-[var(--color-foreground)]">{service.priceFrom}</p>
            <p className="mt-1 text-[12px] leading-4 text-[var(--color-muted)]">{service.duration}</p>
          </div>
        </div>
        <p className="max-w-3xl text-[15px] leading-[1.65] text-[color:color-mix(in_srgb,var(--color-muted)_82%,#3f3129_18%)] sm:text-[15px]">
          {service.intro}
        </p>
      </div>
      <div className="hidden sm:flex sm:min-w-[11rem] sm:flex-col sm:items-end sm:justify-start sm:pt-0.5 sm:text-right">
        <p className="font-display text-[1.9rem] leading-none tracking-[-0.02em] text-[var(--color-foreground)]">
          {service.priceFrom}
        </p>
        <p className="mt-2 text-[12px] font-medium uppercase tracking-[0.18em] text-[var(--color-muted)]">
          {service.duration}
        </p>
      </div>
    </article>
  );
}

function CtaBand() {
  return (
    <section className="py-12 sm:py-16">
      <Container>
        <div className="rounded-[var(--radius-panel)] bg-[linear-gradient(135deg,#1b1613_0%,#2a211b_55%,#3a2f28_100%)] px-5 py-7 text-white shadow-[0_24px_70px_rgba(34,22,12,0.18)] sm:px-8 sm:py-10 lg:flex lg:items-center lg:justify-between lg:gap-8">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent-soft)]">
              Rezervace bez zbytečných kroků
            </p>
            <h2 className="mt-4 font-display text-3xl leading-[1.08] tracking-tight sm:text-4xl lg:text-5xl">
              Vyberte si službu a termín v několika klidných krocích.
            </h2>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:mt-0">
            <Link
              href="/rezervace"
              className="inline-flex min-h-13 w-full items-center justify-center rounded-full bg-[var(--color-accent)] px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent-contrast)] hover:brightness-105 sm:w-auto sm:text-sm"
            >
              Vybrat termín
            </Link>
            <Link
              href="/kontakt"
              className="inline-flex min-h-13 w-full items-center justify-center rounded-full border border-white/18 px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white hover:border-white/35 hover:bg-white/6 sm:w-auto sm:text-sm"
            >
              Napsat do studia
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}

function ContactCard({ item }: { item: ContactItem }) {
  const content = (
    <>
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">{item.label}</p>
      <p className="mt-3 text-lg text-[var(--color-foreground)]">{item.value}</p>
      {item.note ? <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">{item.note}</p> : null}
    </>
  );

  return (
    <div className="rounded-[calc(var(--radius-panel)-0.5rem)] border border-black/6 bg-white p-5 shadow-[var(--shadow-panel)] sm:p-6">
      {item.href ? (
        <a href={item.href} className="block hover:opacity-80">
          {content}
        </a>
      ) : (
        content
      )}
    </div>
  );
}

function LegalSections({ sections }: { sections: LegalSection[] }) {
  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <section key={section.title} className="rounded-[calc(var(--radius-panel)-0.5rem)] border border-black/6 bg-white p-5 shadow-[var(--shadow-panel)] sm:p-6">
          <h2 className="font-display text-2xl leading-[1.1] text-[var(--color-foreground)] sm:text-3xl">{section.title}</h2>
          <div className="mt-4 space-y-4 text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function buildPageMetadata({
  title,
  description,
}: {
  title: string;
  description: string;
}): Metadata {
  return {
    title,
    description,
  };
}

export async function PublicHomePage({ featuredServices = services.slice(0, 3) }: { featuredServices?: Service[] } = {}) {
  const bookingPolicy = await getBookingPolicySettings();
  const trustMetrics = buildTrustMetrics(bookingPolicy.cancellationHours);

  return (
    <div className="pb-8 sm:pb-12">
      <PublicHero {...homepageContent} />
      <TrustStrip metrics={trustMetrics} />

      <section className="py-12 sm:py-16">
        <Container className="space-y-8 sm:space-y-10">
          <SectionHeading
            eyebrow="Vybrané služby"
            title="Nejoblíbenější služby přehledně: pro koho jsou, co přináší a kolik času zaberou."
            description="Ať řešíte pleť, řasy nebo obočí, cílem je jasná volba bez složitého rozhodování."
          />
          <div className="grid gap-6 lg:grid-cols-3">
            {featuredServices.map((service) => (
              <ServiceCard key={service.slug} service={service} />
            ))}
          </div>
        </Container>
      </section>

      <section className="py-12 sm:py-16">
        <Container className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-6 shadow-[var(--shadow-panel)] sm:p-8">
            <SectionHeading
              eyebrow="Nejste si jistá výběrem?"
              title="Zvolte orientačně termín, službu spolu doladíme na místě."
              description="Pokud váháte mezi variantami, stačí vybrat nejbližší možnost. Před ošetřením vše krátce upřesníme."
            />
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[calc(var(--radius-panel)-0.5rem)] bg-[var(--color-surface)] p-5">
                <p className="font-display text-xl text-[var(--color-foreground)] sm:text-2xl">Jasné doporučení</p>
                <p className="mt-3 text-[13px] leading-6 text-[var(--color-muted)] sm:text-sm">Podle stavu pleti nebo cíle návštěvy vybereme službu, která vám bude dávat smysl.</p>
              </div>
              <div className="rounded-[calc(var(--radius-panel)-0.5rem)] bg-[var(--color-surface)] p-5">
                <p className="font-display text-xl text-[var(--color-foreground)] sm:text-2xl">Rychlé objednání</p>
                <p className="mt-3 text-[13px] leading-6 text-[var(--color-muted)] sm:text-sm">Rezervaci dokončíte online během pár kroků, potvrzení termínu přijde e-mailem.</p>
              </div>
            </div>
          </div>
          <PlaceholderNote
            title="Dobré vědět"
            items={[
              'pokud váháte, zvolte orientační službu a vše doladíme na místě',
              'volné termíny vypisuji průběžně podle reálné kapacity',
              'potvrzení rezervace dostanete e-mailem po dokončení objednání',
              'ceník i podmínky najdete přehledně bez složitých formulací',
            ]}
          />
        </Container>
      </section>

      <CtaBand />
    </div>
  );
}

export function ServicesPage({ services: catalogServices = services }: { services?: Service[] } = {}) {
  return (
    <div className="pb-8 sm:pb-12">
      <PublicHero
        eyebrow="Služby"
        title="Péče rozdělená podle toho, co právě hledáte."
        description="Kosmetická ošetření pracují se stavem pleti, lash & brow služby s výrazem, masáž s uvolněním a líčení s konkrétní příležitostí."
        primaryCta={{ href: '/rezervace', label: 'Vybrat termín' }}
        secondaryCta={{ href: '/cenik', label: 'Zobrazit ceník' }}
      />
      <section className="py-12 sm:py-16">
        <Container className="space-y-8 sm:space-y-10">
          <SectionHeading
            eyebrow="Katalog služeb"
            title="Každá služba shrnuje to podstatné: zaměření péče, délku i cenu."
          />
          <div className="grid gap-6 lg:grid-cols-3">
            {catalogServices.map((service) => (
              <ServiceCard key={service.slug} service={service} />
            ))}
          </div>
        </Container>
      </section>
      <CtaBand />
    </div>
  );
}

export function ServiceDetailPage({ service }: { service: Service }) {
  return (
    <div className="pb-8 sm:pb-12">
      <PublicHero
        eyebrow={service.category}
        title={service.name}
        description={service.description}
        primaryCta={{ href: '/rezervace', label: 'Rezervovat službu' }}
        secondaryCta={{ href: '/sluzby', label: 'Zpět na služby' }}
      />
      <section className="py-12 sm:py-16">
        <Container className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-6 shadow-[var(--shadow-panel)] sm:p-8">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="text-sm text-[var(--color-muted)]">Cena od</p>
                <p className="mt-2 font-display text-3xl text-[var(--color-foreground)] sm:text-4xl">{service.priceFrom}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--color-muted)]">Délka procedury</p>
                <p className="mt-2 font-display text-3xl text-[var(--color-foreground)] sm:text-4xl">{service.duration}</p>
              </div>
            </div>
            <div className="mt-8 space-y-7">
              <div>
                <h2 className="font-display text-2xl leading-[1.1] text-[var(--color-foreground)] sm:text-3xl">Pro koho je služba vhodná</h2>
                <ul className="mt-4 space-y-2 text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">
                  {service.idealFor.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="font-display text-2xl leading-[1.1] text-[var(--color-foreground)] sm:text-3xl">Co služba obvykle obsahuje</h2>
                <ul className="mt-4 space-y-2 text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">
                  {service.includes.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="font-display text-2xl leading-[1.1] text-[var(--color-foreground)] sm:text-3xl">Očekávaný přínos</h2>
                <ul className="mt-4 space-y-2 text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">
                  {service.results.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <PlaceholderNote
              title="Dobré vědět"
              items={[
                'pokud si nejste jistá výběrem, při návštěvě službu společně upřesníme',
                'termín vyberete online během několika kroků',
                'u delších návštěv je vždy prostor i na krátkou konzultaci',
                'konkrétní doporučení k domácí péči dostanete podle průběhu služby',
              ]}
            />
            <div className="rounded-[calc(var(--radius-panel)-0.5rem)] border border-black/6 bg-white p-5 shadow-[var(--shadow-panel)] sm:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">Rezervace</p>
              <p className="mt-4 text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">
                Pokud vám tahle služba dává smysl, můžete si rovnou vybrat termín. Pokud váháte, napište mi a společně zvolíme vhodnější variantu.
              </p>
            </div>
          </div>
        </Container>
      </section>
      <CtaBand />
    </div>
  );
}

export function PricingPage({ services: catalogServices = services }: { services?: Service[] } = {}) {
  const groupedServices = groupServicesByCategory(catalogServices);

  return (
    <div className="pb-8 sm:pb-12">
      <PublicHero
        eyebrow="Ceník"
        title="Ceny přehledně a bez zbytečného hledání."
        description="Najdete tu služby rozdělené do kategorií, abyste si mohla rychle udělat jasnější představu."
        primaryCta={{ href: '/rezervace', label: 'Vybrat termín' }}
        secondaryCta={{ href: '/sluzby', label: 'Porovnat služby' }}
      />
      <section className="py-12 sm:py-16">
        <Container className="space-y-6">
          <SectionHeading
            eyebrow="Aktuální přehled"
            title="Ceník rozdělený tak, aby se v něm dalo rozhodovat s větší jistotou."
            description="Pokud si nejste jistá volbou, ráda vám s výběrem služby pomohu osobně."
          />
          <div className="space-y-8">
            {groupedServices.map((group) => (
              <section
                key={group.category}
                className="overflow-hidden rounded-[calc(var(--radius-panel)+0.15rem)] border border-[#d8c9b8] bg-[#fcf9f5] shadow-[0_18px_50px_rgba(75,49,31,0.05)]"
              >
                <div className="space-y-3 border-b border-[#dfd2c4] bg-[linear-gradient(180deg,#f3ece3_0%,#efe6db_100%)] px-5 py-4 sm:px-6 sm:py-5">
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">Kategorie</p>
                    <h2 className="font-display text-[1.55rem] leading-[1.02] tracking-[-0.02em] text-[var(--color-foreground)] sm:text-[1.95rem]">
                      {group.category}
                    </h2>
                  </div>
                  <p className="max-w-3xl text-[14px] leading-[1.6] text-[color:color-mix(in_srgb,var(--color-muted)_80%,#413129_20%)] sm:text-[15px]">
                    {getCategoryLead(group.category, group.services)}
                  </p>
                </div>
                <div className="bg-white">
                  {group.services.map((service) => (
                    <PricingServiceRow key={service.slug} service={service} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </Container>
      </section>
      <CtaBand />
    </div>
  );
}

export async function ContactPage() {
  const salonProfile = await getPublicSalonProfile();
  const contactItems = buildContactItems({
    phone: salonProfile.phone,
    email: salonProfile.email,
    addressLine: salonProfile.addressLine,
    instagramUrl: salonProfile.instagramUrl,
  });

  return (
    <div className="pb-8 sm:pb-12">
      <PublicHero
        eyebrow="Kontakt"
        title="Pokud si nejste jistá, napište mi."
        description="Ráda vám pomohu s výběrem služby i termínu. Najdete mě ve Zlíně a ozvat se můžete telefonicky, e-mailem i přes Instagram."
        primaryCta={{ href: '/rezervace', label: 'Přejít k rezervaci' }}
      />
      <section className="py-12 sm:py-16">
        <Container className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
          <div className="grid gap-6 sm:grid-cols-2">
            {contactItems.map((item) => (
              <ContactCard key={item.label} item={item} />
            ))}
          </div>
          <div className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-6 shadow-[var(--shadow-panel)] sm:p-8">
            <SectionHeading
              eyebrow="Když váháte"
              title="S výběrem služby vám ráda pomohu."
            />
            <div className="mt-8 space-y-4 text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">
              <p>Pokud si nejste jistá, kterou službu zvolit, napište mi nebo si rezervujte nejbližší variantu.</p>
              <p>Podle stavu pleti, vašeho přání nebo konkrétní příležitosti spolu vybereme péči, která vám bude sedět nejlépe.</p>
            </div>
          </div>
        </Container>
      </section>
      <CtaBand />
    </div>
  );
}

export async function FaqPage() {
  const bookingPolicy = await getBookingPolicySettings();
  const faqItems = buildFaqItems(bookingPolicy.cancellationHours);

  return (
    <div className="pb-8 sm:pb-12">
      <PublicHero
        eyebrow="FAQ"
        title="Odpovědi na otázky, které klientce pomáhají rozhodnout se bez nejistoty."
        description="FAQ je krátké, jasné a psané s důrazem na první návštěvu, způsob rezervace i základní provozní očekávání."
        primaryCta={{ href: '/rezervace', label: 'Najít volný termín' }}
        secondaryCta={{ href: '/kontakt', label: 'Napsat do studia' }}
      />
      <section className="py-12 sm:py-16">
        <Container className="space-y-6">
          {faqItems.map((item) => (
            <section key={item.question} className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-5 shadow-[var(--shadow-panel)] sm:p-8">
              <h2 className="font-display text-2xl leading-[1.1] text-[var(--color-foreground)] sm:text-3xl">{item.question}</h2>
              <p className="mt-4 max-w-3xl text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">{item.answer}</p>
            </section>
          ))}
        </Container>
      </section>
      <CtaBand />
    </div>
  );
}

export function LegalPage({
  eyebrow,
  title,
  description,
  sections,
}: {
  eyebrow: string;
  title: string;
  description: string;
  sections: LegalSection[];
}) {
  return (
    <div className="pb-8 sm:pb-12">
      <PublicHero eyebrow={eyebrow} title={title} description={description} secondaryCta={{ href: '/kontakt', label: 'Potřebuji upřesnění' }} />
      <section className="py-12 sm:py-16">
        <Container className="space-y-6">
          <LegalSections sections={sections} />
        </Container>
      </section>
    </div>
  );
}

export async function getLegalPages() {
  const bookingPolicy = await getBookingPolicySettings();
  const legalContent = buildLegalContent(bookingPolicy.cancellationHours);

  return {
    cancellation: legalContent.cancellation,
    terms: legalContent.terms,
    gdpr: legalContent.gdpr,
  };
}
