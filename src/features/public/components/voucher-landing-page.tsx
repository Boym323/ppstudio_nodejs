import Link from "next/link";

import { services, type Service } from "@/content/public-site";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { getPublicSalonProfile } from "@/lib/site-settings";
import {
  ActionLink,
  PlaceholderNote,
  PublicHero,
} from "@/features/public/components/public-page-primitives";

export async function VoucherLandingPage({
  suggestedServices = services.slice(0, 3),
}: {
  suggestedServices?: Service[];
} = {}) {
  const salonProfile = await getPublicSalonProfile();
  const voucherMailSubject = encodeURIComponent("Mám zájem o dárkový voucher");
  const voucherMailHref = `mailto:${salonProfile.email}?subject=${voucherMailSubject}`;
  const voucherPhoneHref = `tel:${salonProfile.phone.replace(/\s+/g, "")}`;

  return (
    <div className="pb-8 sm:pb-12">
      <PublicHero
        eyebrow="Dárkové vouchery"
        title="Dárek, který nechává prostor vybrat si péči podle aktuální potřeby."
        description="Voucher mohu vystavit na konkrétní službu i na hodnotu podle individuální domluvy. Hodí se ve chvíli, kdy chcete darovat péči příjemně a bez složitého rozhodování."
        ctaPrompt="Stačí mi napsat, pro koho voucher vybíráte a jestli chcete konkrétní službu nebo volnější hodnotu."
        primaryCta={{ href: voucherMailHref, label: "Napsat pro voucher" }}
        secondaryCta={{ href: "/vouchery/overeni", label: "Ověřit voucher" }}
        aside={(
          <VoucherHeroAside
            phone={salonProfile.phone}
            phoneHref={voucherPhoneHref}
            email={salonProfile.email}
            voucherMailHref={voucherMailHref}
          />
        )}
      />

      <section className="py-10 sm:py-14 lg:py-16">
        <Container className="space-y-8 sm:space-y-10">
          <SectionHeading
            eyebrow="Jak to funguje"
            title="Voucher je jednoduchý dárek i ve chvíli, kdy si nejste jistá přesnou službou."
            description="Cílem je, aby obdarovaná dostala péči, která jí bude opravdu dávat smysl, ne aby se musela trefit do technického názvu procedury."
          />
          <div className="grid gap-5 lg:grid-cols-3">
            {[
              {
                title: "Na konkrétní službu",
                description:
                  "Vhodné, pokud přesně víte, co chcete darovat. Voucher drží konkrétní službu a její jasný rámec.",
              },
              {
                title: "Na hodnotu podle domluvy",
                description:
                  "Dobrá varianta, pokud chcete nechat větší volnost. Službu i využití lze doladit podle aktuální potřeby.",
              },
              {
                title: "S ověřením online",
                description:
                  "Každý vystavený voucher lze později bezpečně ověřit přes veřejnou stránku, aniž by se cokoli odečítalo.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-6 shadow-[var(--shadow-panel)] sm:p-7"
              >
                <p className="font-display text-2xl leading-[1.08] text-[var(--color-foreground)] sm:text-[2rem]">
                  {item.title}
                </p>
                <p className="mt-4 text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-10 sm:py-14 lg:py-16">
        <Container className="grid gap-6 lg:grid-cols-[1.04fr_0.96fr]">
          <div className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-6 shadow-[var(--shadow-panel)] sm:p-8">
            <SectionHeading
              eyebrow="Na co voucher vystavit"
              title="Nejčastěji dává smysl vystavit voucher na službu, se kterou se dobře začíná."
              description="Pokud vybíráte dárek poprvé, pomůže orientace podle typu péče, délky návštěvy a ceny."
            />
            <div className="mt-8 grid gap-4">
              {suggestedServices.map((service) => (
                <Link
                  key={service.slug}
                  href={`/sluzby/${service.slug}`}
                  className="rounded-[calc(var(--radius-panel)-0.4rem)] border border-black/6 bg-[var(--color-surface)] p-5 transition hover:border-black/12 hover:bg-[#f4eadf]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)]">
                        {service.category}
                      </p>
                      <h2 className="mt-2 font-display text-2xl leading-[1.08] text-[var(--color-foreground)] sm:text-[1.9rem]">
                        {service.name}
                      </h2>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-2xl text-[var(--color-foreground)]">{service.priceFrom}</p>
                      <p className="mt-1 text-sm text-[var(--color-muted)]">{service.duration}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">
                    {service.intro}
                  </p>
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <PlaceholderNote
              title="Kdy se voucher hodí"
              items={[
                "k narozeninám nebo svátku, když chcete darovat chvíli péče místo věci",
                "jako jemný dárek pro ženu, která si sama podobnou návštěvu často nevyhradí",
                "ve chvíli, kdy chcete nechat volnost mezi konkrétní službou a péčí podle aktuální potřeby",
                "když nechcete trefovat kosmetiku domů, ale raději darovat skutečný čas pro sebe",
              ]}
            />
            <div className="rounded-[calc(var(--radius-panel)-0.35rem)] border border-[#d8c9b8] bg-[#f7efe5] p-5 shadow-[0_16px_38px_rgba(75,49,31,0.05)] sm:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">
                Domluva voucheru
              </p>
              <p className="mt-4 text-[15px] leading-7 text-[var(--color-accent-contrast)] sm:text-base">
                Pokud si nejste jistá výběrem, napište mi jen stručně, pro koho voucher vybíráte a jaký typ péče by mohl být blízký. Doporučím vhodnou variantu bez zbytečně složitého rozhodování.
              </p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <ActionLink
                  href={voucherMailHref}
                  trackingLocation="voucher-cta"
                  trackingPage="vouchery"
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-foreground)] px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#2c221d]"
                >
                  Napsat e-mail
                </ActionLink>
                <ActionLink
                  href="/kontakt"
                  trackingLocation="voucher-cta"
                  trackingPage="vouchery"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 py-3 text-center text-sm font-semibold text-[var(--color-foreground)] transition hover:border-black/18 hover:bg-white/80"
                >
                  Otevřít kontakt
                </ActionLink>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section className="py-10 sm:py-14 lg:py-16">
        <Container className="space-y-8 sm:space-y-10">
          <SectionHeading
            eyebrow="Podle situace"
            title="Kdy dává větší smysl voucher na konkrétní službu a kdy raději volnější hodnota."
            description="Nejčastější rozhodnutí nebývá jestli voucher ano, ale jakou variantu zvolit, aby dárek působil jistě a přirozeně."
          />
          <div className="grid gap-5 lg:grid-cols-3">
            {[
              {
                title: "Víte, co má ráda",
                recommendation: "Spíš voucher na konkrétní službu",
                description:
                  "Pokud víte, že obdarovaná chodí pravidelně na určitou péči nebo přesně víte, co by jí udělalo radost, konkrétní služba působí osobně a jasně.",
              },
              {
                title: "Chcete nechat větší volnost",
                recommendation: "Spíš hodnotový voucher",
                description:
                  "Když si nejste jistá typem péče, ale víte, že by ocenila čas pro sebe, volnější hodnota bývá bezpečnější a příjemnější varianta.",
              },
              {
                title: "Je to dárek pro první návštěvu",
                recommendation: "Často je nejlepší hodnotový voucher",
                description:
                  "U první návštěvy bývá praktičtější nechat prostor na doladění podle aktuálního stavu pleti, komfortu i toho, co bude obdarované opravdu sedět.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-6 shadow-[var(--shadow-panel)] sm:p-7"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
                  {item.recommendation}
                </p>
                <h2 className="mt-3 font-display text-2xl leading-[1.08] text-[var(--color-foreground)] sm:text-[1.9rem]">
                  {item.title}
                </h2>
                <p className="mt-4 text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-10 sm:py-14 lg:py-16">
        <Container className="grid gap-6 lg:grid-cols-[0.98fr_1.02fr]">
          <div className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-6 shadow-[var(--shadow-panel)] sm:p-8">
            <SectionHeading
              eyebrow="Jak probíhá domluva"
              title="Stačí krátká zpráva, zbytek doladíme spolu."
              description="Cílem není zatěžovat vás formulářem, ale rychle se dobrat varianty, která bude jako dárek fungovat."
            />
            <ol className="mt-8 grid gap-4">
              {[
                {
                  step: "1. Napište, pro koho voucher vybíráte",
                  text: "Stačí pár slov o příležitosti a jestli chcete konkrétní službu, nebo raději volnější hodnotu.",
                },
                {
                  step: "2. Doporučím vhodnou variantu",
                  text: "Pokud si nebudete jistá, navrhnu bezpečnější možnost podle toho, jestli jde o první návštěvu nebo už známý typ péče.",
                },
                {
                  step: "3. Voucher může obdarovaná později snadno využít",
                  text: "Kód z voucheru lze ověřit online a termín se pak domlouvá přirozeně stejně jako běžná návštěva.",
                },
              ].map((item) => (
                <li
                  key={item.step}
                  className="rounded-[calc(var(--radius-panel)-0.45rem)] border border-black/6 bg-[var(--color-surface)] p-5"
                >
                  <p className="font-medium text-[var(--color-foreground)]">{item.step}</p>
                  <p className="mt-2 text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">{item.text}</p>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-[var(--radius-panel)] border border-black/6 bg-[linear-gradient(180deg,#f8f1e8_0%,#f4eadf_100%)] p-6 shadow-[var(--shadow-panel)] sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">
              Praktické situace
            </p>
            <h2 className="mt-4 font-display text-2xl leading-[1.08] text-[var(--color-foreground)] sm:text-3xl">
              Nejčastěji funguje jednoduché pravidlo: čím menší jistota ve výběru, tím větší smysl má volnější varianta.
            </h2>
            <div className="mt-6 space-y-4 text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">
              <p>
                Pokud vybíráte dárek pro ženu, která do podobné péče chodí pravidelně a víte, co má ráda, voucher na konkrétní službu bývá velmi hezký a osobní.
              </p>
              <p>
                Pokud si ale nejste jistá, jestli je vhodnější ošetření pleti, lash lifting nebo jiný typ péče, je zpravidla příjemnější nechat jí větší prostor a zvolit variantu podle domluvy.
              </p>
              <p>
                U první návštěvy je to často nejpraktičtější cesta. Dárek tak nepůsobí svazujícím dojmem a obdarovaná si může vybrat péči, která jí bude v danou chvíli sedět nejlépe.
              </p>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <ActionLink
                href={voucherMailHref}
                trackingLocation="voucher-scenarios"
                trackingPage="vouchery"
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-foreground)] px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#2c221d]"
              >
                Napsat pro doporučení
              </ActionLink>
              <ActionLink
                href="/kontakt"
                trackingLocation="voucher-scenarios"
                trackingPage="vouchery"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/10 bg-white/75 px-5 py-3 text-center text-sm font-semibold text-[var(--color-foreground)] transition hover:border-black/18 hover:bg-white"
              >
                Otevřít kontakt
              </ActionLink>
            </div>
          </div>
        </Container>
      </section>

      <section className="py-10 sm:py-14 lg:py-16">
        <Container className="grid gap-6 lg:grid-cols-[0.98fr_1.02fr]">
          <div className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-6 shadow-[var(--shadow-panel)] sm:p-8">
            <SectionHeading
              eyebrow="Časté otázky"
              title="To podstatné k voucheru na jednom místě."
            />
            <div className="mt-6 space-y-3">
              {[
                {
                  question: "Může být voucher i bez přesně vybrané služby?",
                  answer:
                    "Ano. Pokud nechcete vybírat konkrétní proceduru, lze voucher vystavit i na hodnotu podle individuální domluvy.",
                },
                {
                  question: "Jak si obdarovaná ověří, že je voucher platný?",
                  answer:
                    "Každý voucher má vlastní kód a veřejné ověření. Stránka pouze ukáže stav a nic z voucheru neodečítá.",
                },
                {
                  question: "Co když si obdarovaná nebude jistá výběrem péče?",
                  answer:
                    "To je v pořádku. Při výběru termínu nebo před návštěvou lze službu společně doladit podle aktuální potřeby.",
                },
                {
                  question: "Kdy je lepší voucher na službu a kdy na hodnotu?",
                  answer:
                    "Pokud přesně víte, co má obdarovaná ráda, dává smysl konkrétní služba. Pokud si nejste jistá nebo jde o první návštěvu, bývá praktičtější volnější hodnota podle domluvy.",
                },
              ].map((item) => (
                <details
                  key={item.question}
                  className="rounded-[calc(var(--radius-panel)-0.5rem)] border border-black/8 bg-[var(--color-surface)] px-5 py-4"
                >
                  <summary className="cursor-pointer list-none pr-6 font-medium text-[var(--color-foreground)]">
                    {item.question}
                  </summary>
                  <p className="mt-3 text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>

          <div className="rounded-[var(--radius-panel)] border border-black/6 bg-[linear-gradient(180deg,#f8f1e8_0%,#f4eadf_100%)] p-6 shadow-[var(--shadow-panel)] sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">
              Další krok
            </p>
            <h2 className="mt-4 font-display text-[2.2rem] leading-[1.04] text-[var(--color-foreground)] sm:text-5xl">
              Chcete voucher vystavit nebo si ověřit už existující kód?
            </h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">
              Pro vystavení voucheru mi stačí krátká zpráva. Pokud už voucher máte, můžete si jeho stav kdykoli bezpečně zkontrolovat online.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ActionLink
                href={voucherMailHref}
                trackingLocation="voucher-final"
                trackingPage="vouchery"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--color-foreground)] px-6 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#2c221d]"
              >
                Napsat pro voucher
              </ActionLink>
              <ActionLink
                href="/vouchery/overeni"
                trackingLocation="voucher-final"
                trackingPage="vouchery"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-black/10 bg-white/75 px-6 py-3 text-center text-sm font-semibold text-[var(--color-foreground)] transition hover:border-black/18 hover:bg-white"
              >
                Ověřit voucher
              </ActionLink>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}

function VoucherHeroAside({
  phone,
  phoneHref,
  email,
  voucherMailHref,
}: {
  phone: string;
  phoneHref: string;
  email: string;
  voucherMailHref: string;
}) {
  return (
    <aside className="h-full rounded-[calc(var(--radius-panel)-0.25rem)] border border-white/75 bg-white/88 p-5 shadow-[var(--shadow-panel)] backdrop-blur sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">
        Rychlá domluva
      </p>
      <h2 className="mt-4 font-display text-2xl leading-[1.08] text-[var(--color-foreground)] sm:text-3xl">
        Voucher domluvíme jednoduše a bez složitého formuláře.
      </h2>
      <p className="mt-3 text-[14px] leading-6 text-[var(--color-muted)] sm:text-[15px]">
        Nejrychlejší je napsat e-mail. Pokud potřebujete rychlou orientaci, můžete se ozvat i telefonicky.
      </p>
      <div className="mt-6 grid gap-3">
        <a
          href={voucherMailHref}
          className="rounded-2xl border border-black/[0.06] bg-[var(--color-surface)] px-4 py-3 transition hover:border-black/10 hover:bg-[#f4eadf]"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">E-mail</p>
          <p className="mt-2 break-words text-[15px] leading-6 text-[var(--color-foreground)]">{email}</p>
        </a>
        <a
          href={phoneHref}
          className="rounded-2xl border border-black/[0.06] bg-[var(--color-surface)] px-4 py-3 transition hover:border-black/10 hover:bg-[#f4eadf]"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">Telefon</p>
          <p className="mt-2 text-[15px] leading-6 text-[var(--color-foreground)]">{phone}</p>
        </a>
      </div>
    </aside>
  );
}
