import Link from "next/link";

import { services, type Service } from "@/content/public-site";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { getPublicSalonProfile } from "@/lib/site-settings";
import { ActionLink, PublicHero } from "@/features/public/components/public-page-primitives";

export async function VoucherLandingPage({
  suggestedServices = services.slice(0, 3),
}: {
  suggestedServices?: Service[];
} = {}) {
  const salonProfile = await getPublicSalonProfile();
  const voucherMailSubject = encodeURIComponent("Mám zájem o dárkový voucher");
  const voucherMailBody = encodeURIComponent(`Dobrý den,

mám zájem o dárkový voucher.

Voucher bych chtěl/a:

* na konkrétní službu / na hodnotu

Služba nebo hodnota:
...

Děkuji.`);
  const voucherMailHref = `mailto:${salonProfile.email}?subject=${voucherMailSubject}&body=${voucherMailBody}`;
  const voucherPhoneHref = `tel:${salonProfile.phone.replace(/\s+/g, "")}`;

  return (
    <div className="pb-8 sm:pb-12">
      <PublicHero
        eyebrow="Dárkové vouchery"
        title="Dárek, který nechává prostor vybrat si péči podle aktuální potřeby."
        description="Voucher vystavím na konkrétní službu nebo na hodnotu podle vašeho přání. Pokud si nejste jistí výběrem, ráda doporučím vhodnou variantu."
        primaryCta={{ href: voucherMailHref, label: "Chci dárkový voucher" }}
        secondaryCta={{ href: "/vouchery/overeni", label: "Už voucher máte? Ověřit platnost", variant: "text" }}
        aside={(
          <VoucherHeroAside
            email={salonProfile.email}
            phone={salonProfile.phone}
            voucherMailHref={voucherMailHref}
            voucherPhoneHref={voucherPhoneHref}
          />
        )}
      />

      <section className="py-10 sm:py-14 lg:py-16">
        <Container className="space-y-8 sm:space-y-10">
          <SectionHeading
            eyebrow="Vyberte způsob"
            title="Voucher podle toho, kolik volnosti chcete nechat."
          />
          <div className="grid gap-5 lg:grid-cols-2">
            {[
              {
                title: "Na konkrétní službu",
                description: "Pokud přesně víte, čím chcete udělat radost, vystavím voucher přímo na vybranou službu.",
              },
              {
                title: "Na libovolnou hodnotu",
                description: "Ideální, pokud chcete nechat výběr péče na obdarované. Konkrétní službu lze následně zvolit podle aktuální potřeby.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-6 shadow-[var(--shadow-panel)] sm:p-7"
              >
                <h2 className="font-display text-2xl leading-[1.08] text-[var(--color-foreground)] sm:text-[2rem]">
                  {item.title}
                </h2>
                <p className="mt-4 text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">{item.description}</p>
              </div>
            ))}
          </div>
          <p className="text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">
            Nevíte, kterou variantu vybrat? U první návštěvy bývá nejpraktičtější hodnotový voucher.
          </p>
        </Container>
      </section>

      <section className="py-10 sm:py-14 lg:py-16">
        <Container className="space-y-8 sm:space-y-10">
          <SectionHeading
            eyebrow="Nejčastěji darované"
            title="Oblíbená péče jako dárek."
            description="Pokud chcete darovat konkrétní ošetření, můžete začít některou z těchto služeb."
          />
          <div className="grid gap-4 lg:grid-cols-3">
            {suggestedServices.map((service) => (
              <Link
                key={service.slug}
                href={`/sluzby/${service.slug}`}
                className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-5 shadow-[var(--shadow-panel)] transition hover:border-black/12 hover:bg-[#fdfaf7]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="min-w-0 font-display text-2xl leading-[1.08] text-[var(--color-foreground)] sm:text-[1.9rem]">{service.name}</h2>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-2xl text-[var(--color-foreground)]">{service.priceFrom}</p>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">{service.duration}</p>
                  </div>
                </div>
                <p className="mt-4 text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">{service.intro}</p>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-10 sm:py-14 lg:py-16">
        <Container className="grid gap-6 lg:grid-cols-[0.98fr_1.02fr]">
          <div className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-6 shadow-[var(--shadow-panel)] sm:p-8">
            <SectionHeading eyebrow="Jak voucher získáte" title="Jednoduše a osobně." />
            <ol className="mt-8 grid gap-4">
              {[
                {
                  step: "1. Vyberete službu nebo hodnotu",
                  text: "Pokud si nejste jistí, stačí napsat, pro koho voucher vybíráte. S vhodnou variantou ráda poradím.",
                },
                {
                  step: "2. Voucher připravím",
                  text: "Každý voucher má vlastní kód, platnost uvedenou přímo na voucheru a lze jej připravit jako PDF.",
                },
                {
                  step: "3. Voucher jednoduše využijete",
                  text: "Při rezervaci můžete uvést, že chcete voucher využít. Samotné uplatnění proběhne při návštěvě studia.",
                },
                {
                  step: "4. Platnost ověříte online",
                  text: "Pomocí kódu lze kdykoli bezpečně zkontrolovat stav voucheru bez jeho čerpání.",
                },
              ].map((item) => (
                <li key={item.step} className="rounded-[calc(var(--radius-panel)-0.45rem)] border border-black/6 bg-[var(--color-surface)] p-5">
                  <p className="font-medium text-[var(--color-foreground)]">{item.step}</p>
                  <p className="mt-2 text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">{item.text}</p>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-[var(--radius-panel)] border border-black/6 bg-[linear-gradient(180deg,#f8f1e8_0%,#f4eadf_100%)] p-6 shadow-[var(--shadow-panel)] sm:p-8">
            <SectionHeading eyebrow="Časté otázky" title="To podstatné k voucheru na jednom místě." />
            <div className="mt-6 space-y-3">
              {[
                { question: "Může být voucher bez přesně vybrané služby?", answer: "Ano. Voucher lze vystavit také na hodnotu a konkrétní péči vybrat později." },
                { question: "Jak dlouho voucher platí?", answer: "Konkrétní datum platnosti je vždy uvedeno přímo na voucheru." },
                { question: "Jak poznám, že je voucher platný?", answer: "Každý voucher má vlastní kód, jehož stav lze bezpečně ověřit online. Ověření voucher nijak nečerpá." },
                { question: "Jak se voucher používá?", answer: <>Při <Link href="/rezervace" className="underline decoration-[var(--color-accent)] underline-offset-4 hover:text-[var(--color-foreground)]">online rezervaci</Link> můžete uvést jeho kód. Samotné uplatnění proběhne při návštěvě studia.</> },
              ].map((item) => (
                <details key={item.question} className="rounded-[calc(var(--radius-panel)-0.5rem)] border border-black/8 bg-white/65 px-5 py-4">
                  <summary className="cursor-pointer list-none pr-6 font-medium text-[var(--color-foreground)]">{item.question}</summary>
                  <div className="mt-3 text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">{item.answer}</div>
                </details>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <section className="py-10 sm:py-14 lg:py-16">
        <Container>
          <div className="rounded-[var(--radius-panel)] border border-black/6 bg-[linear-gradient(180deg,#f8f1e8_0%,#f4eadf_100%)] p-6 shadow-[var(--shadow-panel)] sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">Dárek podle vašeho přání</p>
            <h2 className="mt-4 font-display text-[2.2rem] leading-[1.04] text-[var(--color-foreground)] sm:text-5xl">Chcete připravit dárkový voucher?</h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">Napište mi, jestli máte představu o konkrétní službě nebo hodnotě. Pokud si nejste jistí, vhodnou variantu spolu jednoduše vybereme.</p>
            <div className="mt-6 flex flex-col items-start gap-4">
              <ActionLink href={voucherMailHref} trackingLocation="voucher-final" trackingPage="vouchery" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--color-foreground)] px-6 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#2c221d]">
                Chci dárkový voucher
              </ActionLink>
              <ActionLink href="/vouchery/overeni" trackingLocation="voucher-final" trackingPage="vouchery" className="text-sm font-medium text-[var(--color-accent-contrast)] underline decoration-[var(--color-accent)] underline-offset-4 transition hover:text-[var(--color-foreground)]">
                Už voucher máte? Ověřit platnost →
              </ActionLink>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}

function VoucherHeroAside({
  email,
  phone,
  voucherMailHref,
  voucherPhoneHref,
}: {
  email: string;
  phone: string;
  voucherMailHref: string;
  voucherPhoneHref: string;
}) {
  return (
    <aside className="self-start rounded-[calc(var(--radius-panel)-0.25rem)] border border-black/5 bg-[var(--color-surface)] p-5 sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">Rychlá domluva</p>
      <h2 className="mt-4 font-display text-2xl leading-[1.08] text-[var(--color-foreground)] sm:text-3xl">Voucher vyřídíme jednoduše.</h2>
      <p className="mt-3 text-[14px] leading-6 text-[var(--color-muted)] sm:text-[15px]">Stačí napsat, zda máte představu o službě nebo hodnotě. Pokud si nejste jistí, ráda poradím.</p>
      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 border-t border-black/5 pt-4 text-[14px] leading-6 sm:text-[15px]">
        <ActionLink href={voucherMailHref} trackingLocation="voucher-hero-aside" trackingPage="vouchery" className="group">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">E-mail</span>
          <span className="mt-1 block text-[var(--color-foreground)] underline decoration-[var(--color-accent)] underline-offset-4 transition group-hover:text-[var(--color-accent-contrast)]">{email}</span>
        </ActionLink>
        <ActionLink href={voucherPhoneHref} trackingLocation="voucher-hero-aside" trackingPage="vouchery" className="group">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">Telefon</span>
          <span className="mt-1 block text-[var(--color-foreground)] underline decoration-[var(--color-accent)] underline-offset-4 transition group-hover:text-[var(--color-accent-contrast)]">{phone}</span>
        </ActionLink>
      </div>
    </aside>
  );
}
