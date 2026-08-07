import { buildFaqSections, type FaqItem, type FaqSection } from "@/content/public-site";
import { Container } from "@/components/ui/container";
import {
  ActionLink,
  PublicHero,
} from "@/features/public/components/public-page-primitives";
import { SeoJsonLd, buildFaqPageJsonLd } from "@/features/public/components/seo-json-ld";
import { getBookingPolicySettings } from "@/lib/site-settings";

function FaqHeroAside() {
  return (
    <aside className="h-full rounded-[calc(var(--radius-panel)-0.25rem)] border border-white/75 bg-white/88 p-5 shadow-[var(--shadow-panel)] backdrop-blur sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">První návštěva</p>
      <h2 className="mt-4 font-display text-2xl leading-[1.08] text-[var(--color-foreground)] sm:text-3xl">
        Nemusíte vědět přesně, co zvolit.
      </h2>
      <p className="mt-3 text-[14px] leading-6 text-[var(--color-muted)] sm:text-[15px]">
        Stačí popsat, co řešíte, a službu společně doladíme podle aktuálního stavu pleti a cíle návštěvy.
      </p>
      <a
        href="#prvni-navsteva"
        className="mt-6 inline-flex text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent-contrast)] underline decoration-[var(--color-accent)]/45 underline-offset-4 hover:text-[var(--color-accent)] hover:decoration-[var(--color-accent)] sm:text-[13px]"
      >
        Přejít na první návštěvu
      </a>
    </aside>
  );
}

function FaqSectionNav({ sections }: { sections: FaqSection[] }) {
  return (
    <nav
      aria-label="Sekce FAQ"
      className="rounded-[calc(var(--radius-panel)-0.45rem)] border border-[#dcccbc] bg-[#fcf8f3] p-4 shadow-[0_16px_38px_rgba(75,49,31,0.05)] sm:p-5"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)]">Rychlá orientace</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="inline-flex min-h-11 items-center rounded-full border border-black/10 bg-white px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent-contrast)] hover:border-black/15 hover:bg-[#f7efe5] sm:min-h-10 sm:px-3 sm:py-2 sm:text-[12px]"
          >
            {section.title}
          </a>
        ))}
      </div>
    </nav>
  );
}

function FaqAccordionItem({ item }: { item: FaqItem }) {
  return (
    <details className="group rounded-[calc(var(--radius-panel)-0.6rem)] border border-black/[0.08] bg-white open:border-[#d8c9b8] open:bg-[#fcf9f5]">
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:content-none sm:px-6">
        <h3 className="font-display text-[1.28rem] leading-[1.14] text-[var(--color-foreground)] sm:text-[1.45rem]">
          {item.question}
        </h3>
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/10 bg-[var(--color-surface)] text-xl leading-none text-[var(--color-accent-contrast)] transition-transform duration-200 group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <div className="border-t border-black/6 px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
        <p className="max-w-3xl text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">{item.answer}</p>
        {item.linkHref && item.linkLabel ? (
          <div className="mt-4">
            <ActionLink
              href={item.linkHref}
              trackingLocation="faq"
              trackingPage="faq"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/10 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-foreground)] hover:border-black/20 hover:bg-[var(--color-surface)] sm:text-[12px]"
            >
              {item.linkLabel}
            </ActionLink>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function FaqSectionBlock({ section }: { section: FaqSection }) {
  return (
    <section
      id={section.id}
      className="scroll-mt-[calc(var(--site-header-height)+1rem)] rounded-[var(--radius-panel)] border border-black/6 bg-white p-5 shadow-[var(--shadow-panel)] sm:p-6 lg:p-8"
    >
      <div className="max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[var(--color-accent)]">Tematická sekce</p>
        <h2 className="mt-3 font-display text-[1.95rem] leading-[1.06] text-[var(--color-foreground)] sm:text-[2.35rem]">
          {section.title}
        </h2>
        <p className="mt-3 text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">{section.description}</p>
      </div>
      <div className="mt-6 space-y-3">
        {section.items.map((item) => (
          <FaqAccordionItem key={item.question} item={item} />
        ))}
      </div>
    </section>
  );
}

export async function FaqPage() {
  const bookingPolicy = await getBookingPolicySettings();
  const faqSections = buildFaqSections(bookingPolicy.cancellationHours);

  return (
    <div className="pb-8 sm:pb-12">
      <PublicHero
        eyebrow="FAQ"
        title="Odpovědi na otázky, které klientce pomáhají rozhodnout se bez nejistoty."
        description="Pokud si nejste jistá výběrem služby nebo průběhem návštěvy, zde najdete odpovědi na nejčastější otázky."
        primaryCta={{ href: "/rezervace", label: "Najít volný termín" }}
        secondaryCta={{ href: "/kontakt", label: "Napsat do studia" }}
        aside={<FaqHeroAside />}
      />
      <SeoJsonLd data={buildFaqPageJsonLd(faqSections)} />
      <section className="py-10 sm:py-14 lg:py-16">
        <Container className="space-y-6 sm:space-y-8">
          <FaqSectionNav sections={faqSections} />
          {faqSections.map((section) => (
            <FaqSectionBlock key={section.id} section={section} />
          ))}
          <div className="rounded-[var(--radius-panel)] border border-black/6 bg-[linear-gradient(180deg,#f8f1e8_0%,#f4eadf_100%)] p-6 shadow-[var(--shadow-panel)] sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">Dárkový voucher</p>
            <h2 className="mt-4 font-display text-2xl leading-[1.08] text-[var(--color-foreground)] sm:text-3xl">
              Nevíte, jestli je lepší voucher na službu nebo na hodnotu?
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">
              Na samostatné stránce najdete rychlé srovnání podle situace, aby se vám lépe rozhodovalo, když si nejste jistá konkrétní péčí nebo jde o první návštěvu.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <ActionLink
                href="/vouchery"
                trackingLocation="faq-voucher"
                trackingPage="faq"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-foreground)] px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#2c221d]"
              >
                Porovnat varianty voucheru
              </ActionLink>
              <ActionLink
                href="/kontakt"
                trackingLocation="faq-voucher"
                trackingPage="faq"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/10 bg-white/75 px-5 py-3 text-center text-sm font-semibold text-[var(--color-foreground)] transition hover:border-black/18 hover:bg-white"
              >
                Napsat do studia
              </ActionLink>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
