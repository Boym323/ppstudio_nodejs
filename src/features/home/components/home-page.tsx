import Link from "next/link";

import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";

const pillars = [
  {
    title: "Luxus bez přetížení",
    description:
      "Čistá prezentace, jemný vizuální rytmus a obsah, který vede klientku rychle k rozhodnutí.",
  },
  {
    title: "Rezervace bez tření",
    description:
      "Volné termíny jsou publikované ručně, ale klientská cesta zůstává rychlá, srozumitelná a mobilně přirozená.",
  },
  {
    title: "Admin pro realitu salonu",
    description:
      "Owner a provoz řeší jiné úkoly, proto má základ projektu oddělené administrativní směry už od startu.",
  },
] as const;

export function HomePage() {
  return (
    <div className="overflow-hidden">
      <section className="relative isolate bg-[radial-gradient(circle_at_top_left,rgba(190,160,120,0.22),transparent_30%),linear-gradient(135deg,#111111_0%,#1d1a18_52%,#2b241e_100%)] text-white">
        <div className="absolute inset-x-0 top-0 h-px bg-white/20" />
        <Container className="grid gap-16 py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:py-28">
          <div className="space-y-8">
            <div className="space-y-5">
              <p className="text-xs uppercase tracking-[0.38em] text-[var(--color-accent-soft)]">
                Luxusní kosmetický salon
              </p>
              <h1 className="max-w-4xl font-display text-5xl leading-none tracking-tight sm:text-6xl lg:text-7xl">
                Elegantní základ pro značku, rezervace i každodenní provoz salonu.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-white/72">
                Web má působit prémiově, fungovat rychle na mobilu a dát klientce jasnou cestu od první návštěvy až k rezervaci termínu.
              </p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link
                href="/rezervace"
                className="inline-flex items-center justify-center rounded-full bg-[var(--color-accent)] px-7 py-4 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-contrast)] transition hover:brightness-105"
              >
                Otevřít rezervace
              </Link>
              <Link
                href="/admin/prihlaseni"
                className="inline-flex items-center justify-center rounded-full border border-white/20 px-7 py-4 text-sm font-semibold uppercase tracking-[0.18em] text-white transition hover:border-white/40 hover:bg-white/6"
              >
                Vstup do adminu
              </Link>
            </div>
          </div>
          <div className="grid gap-4">
            <div className="rounded-[var(--radius-panel)] border border-white/10 bg-white/8 p-6 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.35em] text-white/45">Směr projektu</p>
              <p className="mt-5 font-display text-3xl leading-tight text-white">
                UX-first architektura připravená pro růst bez přepisování základů.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[var(--radius-panel)] border border-white/10 bg-white/6 p-5">
                <p className="text-sm text-white/55">Stack</p>
                <p className="mt-3 text-lg text-white">Next.js • TypeScript • Tailwind • Prisma</p>
              </div>
              <div className="rounded-[var(--radius-panel)] border border-white/10 bg-white/6 p-5">
                <p className="text-sm text-white/55">Důraz</p>
                <p className="mt-3 text-lg text-white">Mobil • výkon • čistá správa obsahu</p>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section className="py-20">
        <Container className="space-y-12">
          <SectionHeading
            eyebrow="Základ projektu"
            title="Struktura, která drží značku i provoz pohromadě."
            description="První verze nevytváří falešné demo obrazovky. Místo toho staví jasné vrstvy, datový model a UX kostru pro další sprinty."
          />
          <div className="grid gap-6 lg:grid-cols-3">
            {pillars.map((pillar) => (
              <article
                key={pillar.title}
                className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-7 shadow-[var(--shadow-panel)]"
              >
                <h3 className="font-display text-3xl text-[var(--color-foreground)]">{pillar.title}</h3>
                <p className="mt-4 text-base leading-7 text-[var(--color-muted)]">
                  {pillar.description}
                </p>
              </article>
            ))}
          </div>
        </Container>
      </section>
    </div>
  );
}
