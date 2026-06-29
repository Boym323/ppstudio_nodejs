import Link from "next/link";

import { services, type Service } from "@/content/public-site";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { PublicHero } from "@/features/public/components/public-page-primitives";

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

export function ServicesPage({ services: catalogServices = services }: { services?: Service[] } = {}) {
  return (
    <div className="pb-8 sm:pb-12">
      <PublicHero
        eyebrow="Služby"
        title="Péče rozdělená podle toho, co právě hledáte."
        description="Kosmetická ošetření pracují se stavem pleti, lash & brow služby s výrazem, masáž s uvolněním a líčení s konkrétní příležitostí."
        primaryCta={{ href: "/rezervace", label: "Vybrat termín" }}
        secondaryCta={{ href: "/cenik", label: "Zobrazit ceník" }}
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
