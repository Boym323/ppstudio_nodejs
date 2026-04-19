import Link from 'next/link';
import type { Metadata } from 'next';

import {
  aboutContent,
  buildContactItems,
  buildFaqItems,
  buildLegalContent,
  buildTrustMetrics,
  contentStructureGuide,
  homepageContent,
  priceNotes,
  salonHighlights,
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
  primaryCta,
  secondaryCta,
}: {
  eyebrow: string;
  title: string;
  description: string;
  primaryCta?: { href: string; label: string };
  secondaryCta?: { href: string; label: string };
}) {
  return (
    <section className="relative isolate overflow-hidden border-b border-black/5 bg-[radial-gradient(circle_at_top_left,rgba(226,205,182,0.5),transparent_32%),linear-gradient(180deg,#f8f2eb_0%,#f5ede4_48%,#f8f3ed_100%)]">
      <Container className="grid gap-10 py-12 sm:py-16 lg:grid-cols-[1.08fr_0.92fr] lg:items-end lg:py-24">
        <div className="space-y-7">
          <div className="space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">
              {eyebrow}
            </p>
            <h1 className="max-w-3xl font-display text-[2.5rem] leading-[1.04] tracking-tight text-[var(--color-foreground)] sm:text-5xl lg:text-6xl">
              {title}
            </h1>
            <p className="max-w-2xl text-[15px] leading-7 text-[var(--color-muted)] sm:text-lg sm:leading-8">{description}</p>
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
        </div>
        <div className="grid gap-4">
          <div className="rounded-[calc(var(--radius-panel)-0.25rem)] border border-white/75 bg-white/82 p-5 shadow-[var(--shadow-panel)] backdrop-blur sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">
              Připraveno pro produkční obsah
            </p>
            <p className="mt-4 max-w-md font-display text-2xl leading-[1.12] text-[var(--color-foreground)] sm:text-3xl">
              Texty, fotky i nabídka služeb jsou oddělené do editovatelné struktury bez demo chaosu.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {salonHighlights.map((item) => (
              <div
                key={item.label}
                className="rounded-[calc(var(--radius-panel)-0.5rem)] border border-black/6 bg-[#fffaf6] p-4"
              >
                <p className="text-[13px] text-[var(--color-muted)]">{item.label}</p>
                <p className="mt-2 text-[15px] font-medium leading-6 text-[var(--color-foreground)]">{item.value}</p>
              </div>
            ))}
          </div>
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
              Volné termíny budou vždy vedené ručně, ale cesta klientky zůstane jednoduchá.
            </h2>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:mt-0">
            <Link
              href="/rezervace"
              className="inline-flex min-h-13 w-full items-center justify-center rounded-full bg-[var(--color-accent)] px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent-contrast)] hover:brightness-105 sm:w-auto sm:text-sm"
            >
              Přejít na rezervaci
            </Link>
            <Link
              href="/kontakt"
              className="inline-flex min-h-13 w-full items-center justify-center rounded-full border border-white/18 px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white hover:border-white/35 hover:bg-white/6 sm:w-auto sm:text-sm"
            >
              Kontaktovat salon
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
            title="Přehled služeb je stručný, srozumitelný a připravený pro pozdější rozšíření bez přepisování layoutu."
            description="Každá služba má vlastní detail pro SEO, důvěru i lepší orientaci klientky. Níže uvedené texty jsou realistické placeholdery oddělené od kódu v centrálním obsahu."
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
              eyebrow="Důvěra a jasnost"
              title="Web mluví klidně, ale přesně."
              description="Veřejná část vede návštěvnici přes služby, ceník, odpovědi na běžné otázky i právní informace bez zahlcení a bez prázdných marketingových frází."
            />
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[calc(var(--radius-panel)-0.5rem)] bg-[var(--color-surface)] p-5">
                <p className="font-display text-xl text-[var(--color-foreground)] sm:text-2xl">Silné CTA</p>
                <p className="mt-3 text-[13px] leading-6 text-[var(--color-muted)] sm:text-sm">Rezervace je v navigaci, v hero sekci i v kontextových blocích napříč webem.</p>
              </div>
              <div className="rounded-[calc(var(--radius-panel)-0.5rem)] bg-[var(--color-surface)] p-5">
                <p className="font-display text-xl text-[var(--color-foreground)] sm:text-2xl">Perfektní mobil</p>
                <p className="mt-3 text-[13px] leading-6 text-[var(--color-muted)] sm:text-sm">Sekce drží rytmus, typografii i čitelnost na menších displejích bez nadbytečných efektů.</p>
              </div>
            </div>
          </div>
          <PlaceholderNote
            title="Doplnit před spuštěním"
            items={[
              'finální headline a brand voice hero sekce',
              'autentické fotografie majitelky a interiéru',
              'reálné ceny, délky procedur a používané značky',
              'reference klientek a přesné kontaktní údaje',
            ]}
          />
        </Container>
      </section>

      <section className="py-12 sm:py-16">
        <Container className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-6 shadow-[var(--shadow-panel)] sm:p-8">
            <SectionHeading
              eyebrow="Obsahová osnova"
              title="Doporučená struktura pro budoucí texty a fotky."
              description="Obsah je rozdělený do přirozených bloků, takže copywriter nebo majitelka salonu může doplňovat jednotlivé části postupně."
            />
            <div className="mt-8 grid gap-4">
              {contentStructureGuide.map((group) => (
                <PlaceholderNote key={group.title} title={group.title} items={[...group.items]} />
              ))}
            </div>
          </div>
          <div className="rounded-[var(--radius-panel)] border border-black/6 bg-[#fcf8f4] p-6 shadow-[var(--shadow-panel)] sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">Připravené další kroky</p>
            <div className="mt-5 space-y-5 text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">
              <p>
                Jakmile budou k dispozici reálné podklady, stačí vyměnit centrální obsah a není nutné přepisovat komponenty ani routy.
              </p>
              <p>
                Tím zůstává prezentace čistá, SEO konzistentní a další navazující práce na booking flow nebo administraci se nepromíchá s veřejným obsahem.
              </p>
            </div>
          </div>
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
        title="Nabídka, která ukazuje výsledek i průběh bez zahlcení detaily."
        description="Výpis služeb je navržený tak, aby si klientka rychle našla vhodný směr a teprve pak šla do detailu. To je přirozenější pro UX i následné SEO rozšíření katalogu."
        primaryCta={{ href: '/rezervace', label: 'Vybrat termín' }}
        secondaryCta={{ href: '/cenik', label: 'Zobrazit ceník' }}
      />
      <section className="py-12 sm:py-16">
        <Container className="space-y-8 sm:space-y-10">
          <SectionHeading
            eyebrow="Katalog služeb"
            title="Každá karta shrnuje to podstatné: pro koho služba je, jak dlouho trvá a od jaké ceny začíná."
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
              title="Doplnit reálný obsah"
              items={[
                `foto brief: ${service.placeholderAssetBrief}`,
                'přesná metodika a použité produkty',
                'kontraindikace nebo doporučení před návštěvou',
                'reference nebo mini FAQ ke službě',
              ]}
            />
            <div className="rounded-[calc(var(--radius-panel)-0.5rem)] border border-black/6 bg-white p-5 shadow-[var(--shadow-panel)] sm:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">Poznámka k obsahu</p>
              <p className="mt-4 text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">
                Tento detail služby je připravený jako produkční šablona. Reálné texty lze měnit centrálně bez zásahu do komponent, routingu ani SEO struktury.
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
  return (
    <div className="pb-8 sm:pb-12">
      <PublicHero
        eyebrow="Ceník"
        title="Přehled cen navržený pro rychlé rozhodnutí i pohodlné čtení na mobilu."
        description="Ceník drží jen to podstatné. Detailní vysvětlení služeb zůstává na samostatných stránkách, takže ceny nepůsobí přeplácaně a klientka se neztrácí."
        primaryCta={{ href: '/rezervace', label: 'Pokračovat k rezervaci' }}
        secondaryCta={{ href: '/sluzby', label: 'Porovnat služby' }}
      />
      <section className="py-12 sm:py-16">
        <Container className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-6 shadow-[var(--shadow-panel)] sm:p-8">
            <SectionHeading
              eyebrow="Aktuální přehled"
              title="Jednoduchý ceník bez marketingového šumu."
            />
            <div className="mt-8 divide-y divide-black/6">
              {catalogServices.map((service) => (
                <div key={service.slug} className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-display text-2xl text-[var(--color-foreground)] sm:text-3xl">{service.name}</p>
                    <p className="mt-2 text-[15px] leading-6 text-[var(--color-muted)] sm:text-sm">{service.intro}</p>
                  </div>
                  <div className="shrink-0 text-left sm:text-right">
                    <p className="text-lg font-semibold text-[var(--color-foreground)]">od {service.priceFrom}</p>
                    <p className="text-sm text-[var(--color-muted)]">{service.duration}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <PlaceholderNote title="Poznámky k ceníku" items={priceNotes} />
        </Container>
      </section>
      <CtaBand />
    </div>
  );
}

export function AboutPage() {
  return (
    <div className="pb-8 sm:pb-12">
      <PublicHero
        eyebrow="O salonu"
        title={aboutContent.heroTitle}
        description={aboutContent.heroDescription}
        primaryCta={{ href: '/kontakt', label: 'Kontaktovat salon' }}
        secondaryCta={{ href: '/rezervace', label: 'Rezervovat termín' }}
      />
      <section className="py-12 sm:py-16">
        <Container className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-6 shadow-[var(--shadow-panel)] sm:p-8">
            <SectionHeading
              eyebrow="Příběh značky"
              title="Texty jsou rozdělené do bloků, aby se daly pohodlně nahradit finální verzí bez zásahu do layoutu."
            />
            <div className="mt-8 space-y-5 text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">
              {aboutContent.story.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {aboutContent.values.map((value) => (
                <div key={value.title} className="rounded-[calc(var(--radius-panel)-0.5rem)] bg-[var(--color-surface)] p-5">
                  <p className="font-display text-2xl text-[var(--color-foreground)]">{value.title}</p>
                  <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">{value.description}</p>
                </div>
              ))}
            </div>
          </div>
          <PlaceholderNote title="Doporučené fotografie" items={aboutContent.galleryGuide} />
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
        title="Kontakt i praktické informace mají být dostupné během několika sekund."
        description="Stránka je navržená pro rychlé rozhodnutí na mobilu: kontakt, adresa, provozní režim a jasný odkaz na rezervaci. Reálné údaje jsou teď označené jako placeholdery."
        primaryCta={{ href: '/rezervace', label: 'Přejít na rezervaci' }}
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
              eyebrow="Doplnit před spuštěním"
              title="Co ještě na kontaktní stránce doplnit."
            />
            <div className="mt-8 space-y-4 text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">
              <p>Vložit mapu nebo odkaz na navigaci, pokud skutečná adresa pracoviště podporuje osobní návštěvy bez komplikovaného hledání.</p>
              <p>Doplnit instrukce k parkování, patru nebo vstupu do budovy, pokud mají vliv na komfort první návštěvy.</p>
              <p>Pokud salon komunikuje primárně přes telefon nebo WhatsApp, lze tento blok rozšířit o krátký provozní režim odpovědí.</p>
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
        secondaryCta={{ href: '/kontakt', label: 'Zeptat se přímo' }}
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
