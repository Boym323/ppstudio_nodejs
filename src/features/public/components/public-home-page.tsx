import Link from "next/link";

import {
  buildTrustMetrics,
  homepageContent,
  services,
  type Service,
  type TrustMetric,
} from "@/content/public-site";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  ActionLink,
  PlaceholderNote,
  PublicHero,
} from "@/features/public/components/public-page-primitives";
import { getPrimaryPublicHomePortrait } from "@/features/public/lib/public-media";
import { getBookingPolicySettings } from "@/lib/site-settings";

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

export async function PublicHomePage({ featuredServices = services.slice(0, 3) }: { featuredServices?: Service[] } = {}) {
  const [bookingPolicy, portrait] = await Promise.all([getBookingPolicySettings(), getPrimaryPublicHomePortrait()]);
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent-contrast)]">Dárkové vouchery</p>
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
              "pokud váháte, zvolte orientační službu a vše doladíme na místě",
              "volné termíny vypisuji průběžně podle reálné kapacity",
              "potvrzení rezervace dostanete e-mailem po dokončení objednání",
              "ceník i podmínky najdete přehledně bez složitých formulací",
            ]}
          />
        </Container>
      </section>
    </div>
  );
}
