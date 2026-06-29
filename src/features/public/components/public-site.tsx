import Link from 'next/link';

import {
  buildCancellationPageContent,
  buildLegalContent,
  buildTrustMetrics,
  homepageContent,
  services,
  type CancellationPageContent,
  type LegalSection,
  type Service,
  type TrustMetric,
} from '@/content/public-site';
import { Container } from '@/components/ui/container';
import { Breadcrumbs, type BreadcrumbItem } from '@/components/ui/breadcrumbs';
import { SectionHeading } from '@/components/ui/section-heading';
import {
  ActionLink,
  PlaceholderNote,
  PublicHero,
} from '@/features/public/components/public-page-primitives';
import { getPrimaryPublicHomePortrait } from '@/features/public/lib/public-media';
import { getBookingPolicySettings, getPublicSalonProfile } from '@/lib/site-settings';

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
          <p className="text-sm text-[var(--color-muted)]">{service.priceFrom}</p>
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

function LegalSections({ sections }: { sections: LegalSection[] }) {
  return (
    <div className="space-y-3 sm:space-y-4">
      {sections.map((section) => (
        <section
          key={section.id ?? section.title}
          id={section.id}
          className="scroll-mt-28 rounded-[calc(var(--radius-panel)-0.55rem)] border border-black/6 bg-white p-5 shadow-[var(--shadow-panel)] sm:p-6"
        >
          {section.eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">{section.eyebrow}</p>
          ) : null}
          <h2 className="mt-2 font-display text-[1.75rem] leading-[1.08] text-[var(--color-foreground)] sm:text-[2rem]">{section.title}</h2>
          <div className="mt-4 space-y-3.5 text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.items?.length ? (
              <ul className="grid gap-2.5 border-t border-black/6 pt-4 text-[14px] leading-6 text-[var(--color-muted)] sm:text-[15px]">
                {section.items.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {section.note ? (
              <p className="rounded-2xl bg-[var(--color-surface)] px-4 py-3 text-[14px] leading-6 text-[var(--color-accent-contrast)] sm:text-[15px]">
                {section.note}
              </p>
            ) : null}
          </div>
        </section>
      ))}
    </div>
  );
}

function LegalHeroAside({
  eyebrow,
  title,
  description,
  items,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  items: Array<{ label: string; value: string; href?: string }>;
}) {
  return (
    <aside className="h-full rounded-[calc(var(--radius-panel)-0.25rem)] border border-white/75 bg-white/82 p-5 shadow-[var(--shadow-panel)] backdrop-blur sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">{eyebrow}</p>
      <h2 className="mt-4 font-display text-2xl leading-[1.12] text-[var(--color-foreground)] sm:text-3xl">{title}</h2>
      {description ? <p className="mt-3 text-[14px] leading-6 text-[var(--color-muted)] sm:text-[15px]">{description}</p> : null}
      <dl className="mt-6 grid gap-3">
        {items.map((item) => (
          <div key={`${item.label}-${item.value}`} className="rounded-2xl border border-black/[0.06] bg-white/70 px-4 py-3">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">{item.label}</dt>
            <dd className="mt-2 text-[15px] leading-6 text-[var(--color-foreground)]">
              {item.href ? (
                <a href={item.href} className="underline-offset-4 hover:underline">
                  {item.value}
                </a>
              ) : (
                item.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

function LegalToc({ items }: { items: Array<{ id: string; label: string }> }) {
  return (
    <nav
      aria-label="Obsah stránky"
      className="rounded-[calc(var(--radius-panel)-0.5rem)] border border-black/6 bg-white px-4 py-4 shadow-[var(--shadow-panel)] sm:px-5"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)]">Obsah stránky</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="rounded-full border border-black/10 bg-[var(--color-surface)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent-contrast)] hover:border-black/15 hover:bg-[#f3e7da] sm:text-[12px]"
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

function CancellationSummary({
  title,
  items,
}: {
  title: string;
  items: CancellationPageContent['summaryCards'];
}) {
  return (
    <section className="py-4 sm:py-6">
      <Container className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-2xl leading-[1.08] text-[var(--color-foreground)] sm:text-[2rem]">{title}</h2>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {items.map((item) => (
            <article
              key={`${item.title}-${item.value}`}
              className="rounded-[calc(var(--radius-panel)-0.45rem)] border border-[#d8c9b8] bg-[#fcf9f5] p-5 shadow-[0_16px_38px_rgba(75,49,31,0.05)] sm:p-6"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)]">{item.title}</p>
              <p className="mt-3 font-display text-[1.6rem] leading-[1.02] text-[var(--color-foreground)] sm:text-[1.9rem]">{item.value}</p>
              <p className="mt-3 text-[14px] leading-6 text-[var(--color-muted)] sm:text-[15px]">{item.description}</p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

function CancellationContactAside({
  title,
  description,
  note,
  items,
}: {
  title: string;
  description: string;
  note: string;
  items: CancellationPageContent['contactItems'];
}) {
  return (
    <aside className="h-full rounded-[calc(var(--radius-panel)-0.25rem)] border border-white/75 bg-white/88 p-5 shadow-[var(--shadow-panel)] backdrop-blur sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">Prakticky</p>
      <h2 className="mt-4 font-display text-2xl leading-[1.08] text-[var(--color-foreground)] sm:text-3xl">{title}</h2>
      <p className="mt-3 text-[14px] leading-6 text-[var(--color-muted)] sm:text-[15px]">{description}</p>
      <div className="mt-6 grid gap-3">
        {items.map((item) => (
          <a
            key={`${item.label}-${item.value}`}
            href={item.href}
            className="rounded-2xl border border-black/[0.06] bg-[var(--color-surface)] px-4 py-3 transition hover:border-black/10 hover:bg-[#f4eadf]"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">{item.label}</p>
            <p className="mt-2 text-[15px] leading-6 text-[var(--color-foreground)]">{item.value}</p>
          </a>
        ))}
      </div>
      <p className="mt-5 rounded-2xl bg-[var(--color-surface)] px-4 py-3 text-[14px] leading-6 text-[var(--color-accent-contrast)] sm:text-[15px]">
        {note}
      </p>
    </aside>
  );
}

export { buildPageMetadata } from '@/features/public/components/public-page-metadata';

export async function PublicHomePage({ featuredServices = services.slice(0, 3) }: { featuredServices?: Service[] } = {}) {
  const bookingPolicy = await getBookingPolicySettings();
  const portrait = await getPrimaryPublicHomePortrait();
  const trustMetrics = buildTrustMetrics(bookingPolicy.cancellationHours);
  const homepageServices = featuredServices.length > 0 ? featuredServices : services.slice(0, 3);
  const heroContent = {
    ...homepageContent,
    portraitImage: portrait
      ? {
          src: portrait.imageUrl,
          alt: portrait.altText,
          width: portrait.width ?? homepageContent.portraitImage.width,
          height: portrait.height ?? homepageContent.portraitImage.height,
        }
      : homepageContent.portraitImage,
  };

  return (
    <div className="pb-8 sm:pb-12">
      <PublicHero {...heroContent} />
      <TrustStrip metrics={trustMetrics} />

      <section className="py-10 sm:py-14 lg:py-16">
        <Container className="space-y-8 sm:space-y-10">
          <SectionHeading
            eyebrow="Doporučené služby"
            title="Služby, se kterými se dobře začíná: pro koho jsou, co přináší a kolik času zaberou."
            description="Ať řešíte pleť, řasy nebo obočí, cílem je jasná volba bez složitého rozhodování."
          />
          <div className="grid gap-6 lg:grid-cols-3">
            {homepageServices.map((service) => (
              <ServiceCard key={service.slug} service={service} />
            ))}
          </div>
        </Container>
      </section>

      <section className="py-10 sm:py-14 lg:py-16">
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
            <div className="mt-6 rounded-[calc(var(--radius-panel)-0.45rem)] border border-[#d8c9b8] bg-[#f7efe5] p-5 sm:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">Dárkové vouchery</p>
              <p className="mt-3 text-[15px] leading-7 text-[var(--color-accent-contrast)] sm:text-base">
                Pokud hledáte péči jako dárek, voucher lze vystavit na konkrétní službu i podle individuální domluvy.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <ActionLink
                  href="/vouchery"
                  trackingLocation="home-voucher"
                  trackingPage="home"
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-foreground)] px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#2c221d]"
                >
                  Zobrazit vouchery
                </ActionLink>
                <ActionLink
                  href="/vouchery/overeni"
                  trackingLocation="home-voucher"
                  trackingPage="home"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 py-3 text-center text-sm font-semibold text-[var(--color-foreground)] transition hover:border-black/18 hover:bg-white/80"
                >
                  Ověřit kód
                </ActionLink>
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
      <section className="py-10 sm:py-14 lg:py-16">
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
    </div>
  );
}

export function buildServiceBreadcrumbItems(service: Pick<Service, "name">): BreadcrumbItem[] {
  return [
    { label: "Domů", href: "/" },
    { label: "Služby", href: "/sluzby" },
    { label: service.name },
  ];
}

export function ServiceDetailPage({ service }: { service: Service }) {
  const breadcrumbItems = buildServiceBreadcrumbItems(service);

  return (
    <div className="pb-8 sm:pb-12">
      <div className="bg-[#f8f2eb]">
        <Container className="py-5 sm:py-6">
          <Breadcrumbs items={breadcrumbItems} />
        </Container>
      </div>
      <PublicHero
        eyebrow={service.category}
        title={service.name}
        description={service.description}
        primaryCta={{ href: `/rezervace?service=${encodeURIComponent(service.slug)}`, label: 'Rezervovat službu' }}
        secondaryCta={{ href: '/sluzby', label: 'Zpět na všechny služby' }}
      />
      <section className="py-10 sm:py-14 lg:py-16">
        <Container className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-6 shadow-[var(--shadow-panel)] sm:p-8">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="text-sm text-[var(--color-muted)]">Cena</p>
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
              items={service.goodToKnow ?? [
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
    </div>
  );
}

export { ContactPage } from '@/features/public/components/contact-page';
export { FaqPage } from '@/features/public/components/faq-page';

export { VoucherLandingPage } from '@/features/public/components/voucher-landing-page';

export function LegalPage({
  eyebrow,
  title,
  description,
  ctaPrompt,
  sections,
  secondaryCta = { href: '/kontakt', label: 'Kontaktovat studio' },
  heroAside,
  showTableOfContents = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  ctaPrompt?: string;
  sections: LegalSection[];
  secondaryCta?: { href: string; label: string };
  heroAside?: {
    eyebrow: string;
    title: string;
    description?: string;
    items: Array<{ label: string; value: string; href?: string }>;
  };
  showTableOfContents?: boolean;
}) {
  const tableOfContentsItems = sections
    .filter((section): section is LegalSection & { id: string } => Boolean(section.id))
    .map((section) => ({ id: section.id, label: section.title }));

  return (
    <div className="pb-6 sm:pb-10">
      <PublicHero
        eyebrow={eyebrow}
        title={title}
        description={description}
        ctaPrompt={ctaPrompt}
        secondaryCta={secondaryCta}
        aside={heroAside ? <LegalHeroAside {...heroAside} /> : undefined}
      />
      <section className="py-8 sm:py-10 lg:py-12">
        <Container className="space-y-4 sm:space-y-5">
          {showTableOfContents && tableOfContentsItems.length ? <LegalToc items={tableOfContentsItems} /> : null}
          <LegalSections sections={sections} />
        </Container>
      </section>
    </div>
  );
}

export function CancellationPolicyPage({ content }: { content: CancellationPageContent }) {
  const tableOfContentsItems = content.sections
    .filter((section): section is LegalSection & { id: string } => Boolean(section.id))
    .map((section) => ({ id: section.id, label: section.title }));

  return (
    <div className="pb-8 sm:pb-12">
      <PublicHero
        eyebrow="Právní a provozní informace"
        title={content.title}
        description={content.intro}
        ctaPrompt={content.ctaPrompt}
        secondaryCta={{ href: '/kontakt', label: 'Kontaktovat studio' }}
        aside={(
          <CancellationContactAside
            title={content.contactCardTitle}
            description={content.contactCardDescription}
            note={content.contactCardNote}
            items={content.contactItems}
          />
        )}
      />
      <CancellationSummary title={content.summaryTitle} items={content.summaryCards} />
      <section className="py-6 sm:py-8 lg:py-10">
        <Container className="space-y-4 sm:space-y-5">
          <LegalToc items={tableOfContentsItems} />
          <LegalSections sections={content.sections} />
          <div className="rounded-[calc(var(--radius-panel)-0.45rem)] border border-[#d8c9b8] bg-[#f7efe5] px-5 py-4 text-[14px] leading-6 text-[var(--color-accent-contrast)] shadow-[0_16px_38px_rgba(75,49,31,0.05)] sm:px-6 sm:py-5 sm:text-[15px]">
            {content.footerNote}
          </div>
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

export async function getCancellationPageContent() {
  const [bookingPolicy, salonProfile] = await Promise.all([
    getBookingPolicySettings(),
    getPublicSalonProfile(),
  ]);

  return buildCancellationPageContent({
    cancellationHours: bookingPolicy.cancellationHours,
    phone: salonProfile.phone,
    email: salonProfile.email,
  });
}
