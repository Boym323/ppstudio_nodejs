import Link from "next/link";

import { Container } from "@/components/ui/container";
import type { Service } from "@/content/public-site";

type PricingIconProps = {
  className?: string;
};

type PricingChipData = {
  id: string;
  label: string;
  icon: PricingIcon;
  isActive?: boolean;
};

type PricingItemData = {
  slug: string;
  name: string;
  description: string;
  duration: string;
  price: string;
  badge?: string;
  ctaHref: string;
};

type PricingSectionData = {
  id: string;
  label: string;
  icon: PricingIcon;
  summary: string;
  layout: "list" | "grid";
  items: PricingItemData[];
};

type PricingCategoryConfig = {
  id: string;
  label: string;
  icon: PricingIcon;
  summary: string;
  layout: "list" | "grid";
};

type PricingIcon = (props: PricingIconProps) => React.JSX.Element;

const pricingCategoryConfigs: PricingCategoryConfig[] = [
  {
    id: "kosmeticke-osetreni",
    label: "Kosmetické ošetření",
    icon: DropletIcon,
    summary:
      "Ošetření pro pleť, která potřebuje vyčistit, zklidnit a vrátit do rovnováhy. Vhodné pro pravidelnou péči i jako jistý začátek.",
    layout: "list",
  },
  {
    id: "rasy-a-oboci",
    label: "Řasy a obočí",
    icon: EyeLashesIcon,
    summary: "Služby pro výraznější pohled a upravený rám obličeje.",
    layout: "grid",
  },
  {
    id: "masaze",
    label: "Masáže",
    icon: LotusIcon,
    summary: "Uvolnění napětí, odlehčení obličeje a podpora regenerace.",
    layout: "grid",
  },
  {
    id: "barveni-a-uprava",
    label: "Barvení a úprava",
    icon: BrushIcon,
    summary: "Drobné služby, které dodají obličeji definici.",
    layout: "grid",
  },
  {
    id: "depilace",
    label: "Depilace",
    icon: LeafIcon,
    summary: "Šetrná úprava pro čistší a hladší vzhled.",
    layout: "grid",
  },
  {
    id: "liceni",
    label: "Líčení",
    icon: LipstickIcon,
    summary: "Líčení na každý den i výjimečné příležitosti.",
    layout: "list",
  },
];

const servicePricingMetaBySlug: Record<
  string,
  {
    badge?: string;
    pricingDescription: string;
  }
> = {
  "refresh-treatment-60-min": {
    badge: "PRO PRVNÍ NÁVŠTĚVU",
    pricingDescription: "Jemné základní ošetření vhodné i jako první návštěva.",
  },
  "refresh-treatment-90-min": {
    badge: "DELŠÍ VARIANTA",
    pricingDescription: "Více prostoru pro komfort a uvolnění.",
  },
  "anti-age-treatment": {
    badge: "CÍLENĚJŠÍ PÉČE",
    pricingDescription: "Podpora pevnosti, výživy a celkové kondice pleti.",
  },
  "clear-treatment": {
    pricingDescription: "Pro pleť se sklonem k nečistotám a nerovnováze.",
  },
  "mens-treatment": {
    pricingDescription: "Praktická péče pro čistou, svěží a upravenou pleť.",
  },
  "spicule-pdrn-treatment": {
    badge: "INTENZIVNÍ PÉČE",
    pricingDescription: "Intenzivní péče pro obnovu a novou energii pleti.",
  },
  "student-treatment-15-20-let": {
    pricingDescription: "Péče pro mladou pleť se zaměřením na čistotu a rovnováhu.",
  },
  "spicule-exosomy-treatment": {
    badge: "REGENERACE",
    pricingDescription: "Cílená péče pro regeneraci a podporu kondice pleti.",
  },
  "lash-lifting": {
    pricingDescription: "Výraznější linie řas a otevřenější pohled bez řasenky.",
  },
  "laminace-oboci": {
    pricingDescription: "Úprava pro disciplinovanější tvar a upravený rám obličeje.",
  },
  "lash-lifting-plus-laminace-oboci": {
    pricingDescription: "Kombinace pro sjednocený výraz očí i obočí.",
  },
  "lymfaticka-masaz-obliceje": {
    pricingDescription: "Klidná masáž pro odlehčení obličeje a jemné uvolnění.",
  },
  "barveni-oboci": {
    pricingDescription: "Rychlá úprava pro plnější a čitelnější tvar obočí.",
  },
  "barveni-ras": {
    pricingDescription: "Zvýraznění řas pro otevřenější pohled i bez líčení.",
  },
  "uprava-oboci": {
    pricingDescription: "Precizní úprava tvaru obočí pro čistší linii.",
  },
  "depilace-horniho-rtu-brady": {
    pricingDescription: "Šetrná úprava drobných partií obličeje.",
  },
  "depilace-periferii": {
    pricingDescription: "Úprava menších oblastí podle individuální potřeby.",
  },
  "depilace-cele-nohy": {
    pricingDescription: "Praktická péče pro hladký vzhled a lehký pocit.",
  },
  "depilace-ruce": {
    pricingDescription: "Jemná úprava pro hladší a pěstěný vzhled rukou.",
  },
  "denni-liceni": {
    pricingDescription: "Lehký styl líčení pro práci, schůzku nebo běžný den.",
  },
  "vecerni-spolecenske-liceni": {
    pricingDescription: "Líčení pro večer, společenské události a slavnostní chvíle.",
  },
};

export function PricingHero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-black/6 bg-[radial-gradient(circle_at_top_left,rgba(226,205,182,0.34),transparent_32%),radial-gradient(circle_at_90%_15%,rgba(233,218,198,0.58),transparent_24%),linear-gradient(180deg,#fbf6f1_0%,#f7f1ea_100%)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-[30rem] bg-[radial-gradient(circle_at_68%_38%,rgba(214,190,164,0.16),transparent_22%),linear-gradient(180deg,transparent,rgba(206,184,158,0.06))] lg:block"
      />
      <Container className="relative grid gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)] lg:items-center lg:gap-12 lg:py-20">
        <div className="max-w-3xl space-y-6">
          <div className="space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-accent-contrast)]">CENÍK</p>
            <h1 className="max-w-2xl font-display text-[2.55rem] leading-[0.97] tracking-[-0.04em] text-[var(--color-foreground)] sm:text-5xl lg:text-[4.1rem]">
              Ceny přehledně a bez zbytečného hledání.
            </h1>
            <p className="max-w-xl text-[15px] leading-7 text-[var(--color-muted)] sm:text-lg sm:leading-8">
              Najdete tu služby rozdělené do kategorií, abyste si mohla rychle udělat jasnější představu.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/rezervace"
              className="inline-flex min-h-13 items-center justify-center rounded-full bg-[var(--color-foreground)] px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white shadow-[0_12px_30px_rgba(24,19,16,0.14)] hover:bg-[#2b221d]"
            >
              Vybrat termín
            </Link>
            <Link
              href="/sluzby"
              className="inline-flex min-h-13 items-center justify-center rounded-full border border-black/10 bg-white/78 px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-foreground)] shadow-[0_8px_24px_rgba(24,19,16,0.05)] hover:border-black/15 hover:bg-white"
            >
              Porovnat služby
            </Link>
          </div>
        </div>
        <div className="relative flex justify-end">
          <div className="w-full max-w-[28rem] rounded-[2rem] border border-white/80 bg-[linear-gradient(180deg,rgba(255,252,249,0.94),rgba(247,239,229,0.92))] p-6 shadow-[0_24px_60px_rgba(76,54,32,0.08)] backdrop-blur sm:p-7">
            <div className="flex items-start gap-5">
              <div className="flex h-15 w-15 shrink-0 items-center justify-center rounded-full border border-[#dcc8b2] bg-[#f5ebde] text-[#9f7a4f] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                <CalendarIcon className="h-7 w-7" />
              </div>
              <div className="space-y-3 pt-1">
                <h2 className="max-w-[15rem] font-display text-[1.95rem] leading-[1.04] tracking-[-0.03em] text-[var(--color-foreground)]">
                  Rezervace bez zbytečných kroků
                </h2>
                <p className="max-w-[17rem] text-[15px] leading-7 text-[var(--color-muted)]">
                  Vyberte si službu a termín v několika klidných krocích.
                </p>
              </div>
            </div>
            <div
              aria-hidden="true"
              className="mt-6 flex justify-end text-[#ccb08f]"
            >
              <SparkLinesIcon className="h-8 w-8" />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

export function CategoryChips({ chips }: { chips: PricingChipData[] }) {
  return (
    <section className="py-6 sm:py-7">
      <Container>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {chips.map((chip) => {
            const Icon = chip.icon;

            return (
              <a
                key={chip.id}
                href={`#${chip.id}`}
                aria-current={chip.isActive ? "page" : undefined}
                className={[
                  "inline-flex shrink-0 items-center gap-3 rounded-full border px-5 py-3 text-sm font-medium",
                  chip.isActive
                    ? "border-[var(--color-foreground)] bg-[var(--color-foreground)] text-white shadow-[0_14px_32px_rgba(23,19,17,0.12)]"
                    : "border-black/8 bg-white/82 text-[var(--color-foreground)] shadow-[0_8px_22px_rgba(23,19,17,0.04)] hover:border-black/12 hover:bg-white",
                ].join(" ")}
              >
                <Icon className="h-[1.05rem] w-[1.05rem]" />
                <span className="whitespace-nowrap">{chip.label}</span>
              </a>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

export function PricingSection({ section }: { section: PricingSectionData }) {
  const Icon = section.icon;

  return (
    <section
      id={section.id}
      className="scroll-mt-32 overflow-hidden rounded-[1.85rem] border border-black/6 bg-[linear-gradient(180deg,rgba(255,252,248,0.92),rgba(252,247,241,0.92))] shadow-[0_18px_48px_rgba(55,38,24,0.05)]"
    >
      <div className="grid gap-4 border-b border-black/6 px-5 py-5 sm:px-7 sm:py-6 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#dfcfbc] bg-[#f8efe3] text-[#9f7a4f]">
            <Icon className="h-6 w-6" />
          </div>
          <h2 className="font-display text-[2rem] leading-[1.02] tracking-[-0.03em] text-[var(--color-foreground)] sm:text-[2.2rem]">
            {section.label}
          </h2>
        </div>
        <p className="max-w-2xl text-[14px] leading-7 text-[var(--color-muted)] sm:text-[15px]">
          {section.summary}
        </p>
      </div>
      <div className="divide-y divide-black/6 bg-white/78">
        {section.items.map((item) => (
          <PricingItem key={item.slug} item={item} />
        ))}
      </div>
    </section>
  );
}

export function PricingItem({ item }: { item: PricingItemData }) {
  return (
    <article className="grid gap-4 px-4 py-4 transition hover:bg-[#fffdf9] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_14px_28px_rgba(46,31,20,0.04)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5 sm:py-5 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto] lg:gap-6">
      <div className="space-y-2">
        {item.badge ? (
          <div>
            <span className="inline-flex rounded-md bg-[#f6ede2] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8f6a46]">
              {item.badge}
            </span>
          </div>
        ) : null}
        <div className="space-y-1">
          <h3 className="font-medium text-[1.1rem] leading-6 text-[var(--color-foreground)]">
            {item.name}
          </h3>
          <p className="text-[14px] leading-6 text-[var(--color-muted)]">{item.description}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-start lg:contents">
        <p className="text-sm font-medium text-[var(--color-foreground)]/80 lg:min-w-[4.5rem] lg:text-right">
          {item.duration}
        </p>
        <p className="font-medium text-[1.35rem] tracking-[-0.02em] text-[var(--color-foreground)] lg:min-w-[6.5rem] lg:text-right">
          {item.price}
        </p>
        <Link
          href={item.ctaHref}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#eadbcc] bg-[#fbf3e9] px-5 text-sm font-medium text-[var(--color-foreground)] hover:border-[#dfc8af] hover:bg-[#f8ecdd] lg:min-w-[9.5rem]"
        >
          Vybrat termín
        </Link>
      </div>
    </article>
  );
}

export function PricingGridSection({ section }: { section: PricingSectionData }) {
  const Icon = section.icon;

  return (
    <section
      id={section.id}
      className="scroll-mt-32 overflow-hidden rounded-[1.75rem] border border-black/6 bg-[linear-gradient(180deg,rgba(255,252,248,0.92),rgba(251,247,241,0.92))] shadow-[0_16px_40px_rgba(55,38,24,0.04)]"
    >
      <div className="border-b border-black/6 px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#dfcfbc] bg-[#f8efe3] text-[#9f7a4f]">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-[1.9rem] leading-[1.02] tracking-[-0.03em] text-[var(--color-foreground)]">
              {section.label}
            </h2>
            <p className="mt-1 text-[14px] leading-6 text-[var(--color-muted)]">
              {section.summary}
            </p>
          </div>
        </div>
      </div>
      <div className="grid gap-px bg-black/6 sm:grid-cols-2">
        {section.items.map((item) => (
          <article
            key={item.slug}
            className="flex h-full flex-col gap-5 bg-white px-5 py-5 transition hover:bg-[#fffdf9] hover:shadow-[0_16px_30px_rgba(46,31,20,0.04)] sm:px-6"
          >
            <div className="space-y-2">
              <h3 className="font-medium text-[1.05rem] leading-6 text-[var(--color-foreground)]">{item.name}</h3>
              <p className="text-[14px] leading-6 text-[var(--color-muted)]">{item.description}</p>
            </div>
            <div className="mt-auto flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-[var(--color-foreground)]/80">{item.duration}</p>
                <p className="font-medium text-[1.25rem] tracking-[-0.02em] text-[var(--color-foreground)]">{item.price}</p>
              </div>
              <Link
                href={item.ctaHref}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#eadbcc] bg-[#fbf3e9] px-5 text-sm font-medium text-[var(--color-foreground)] hover:border-[#dfc8af] hover:bg-[#f8ecdd]"
              >
                Vybrat termín
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function PricingCTA() {
  return (
    <section className="py-10 sm:py-14 lg:py-16">
      <Container>
        <div className="rounded-[1.9rem] bg-[linear-gradient(135deg,#171413_0%,#1f1b19_46%,#2a2420_100%)] px-6 py-7 text-white shadow-[0_28px_70px_rgba(29,20,13,0.2)] sm:px-8 sm:py-9 lg:flex lg:items-center lg:justify-between lg:gap-8 lg:px-10">
          <div className="flex max-w-2xl items-start gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[#7d6648] text-[#d7b98c]">
              <CalendarIcon className="h-8 w-8" />
            </div>
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#cfae82]">
                Rezervace bez zbytečných kroků
              </p>
              <h2 className="font-display text-[2.1rem] leading-[1.03] tracking-[-0.03em] text-white sm:text-[2.6rem]">
                Vyberte si službu a termín v několika klidných krocích.
              </h2>
            </div>
          </div>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row lg:mt-0">
            <Link
              href="/rezervace"
              className="inline-flex min-h-13 items-center justify-center rounded-full bg-[#d9b375] px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1c150f] hover:brightness-105"
            >
              Vybrat termín
            </Link>
            <Link
              href="/kontakt"
              className="inline-flex min-h-13 items-center justify-center rounded-full border border-white/18 px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white hover:border-white/35 hover:bg-white/5"
            >
              Napsat do studia
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}

export function PricingPage({ services }: { services: Service[] }) {
  const sections = buildPricingSections(services);
  const primarySections = sections.filter((section) => section.layout === "list");
  const gridSections = sections.filter((section) => section.layout === "grid");

  return (
    <div className="pb-8 sm:pb-12">
      <PricingHero />
      <CategoryChips
        chips={sections.map((section, index) => ({
          id: section.id,
          label: section.label,
          icon: section.icon,
          isActive: index === 0,
        }))}
      />
      <section className="pb-2">
        <Container className="space-y-8">
          {primarySections
            .filter((section) => section.label === "Kosmetické ošetření")
            .map((section) => (
              <PricingSection key={section.id} section={section} />
            ))}
          <div className="grid gap-6 lg:grid-cols-2">
            {gridSections.map((section) => (
              <PricingGridSection key={section.id} section={section} />
            ))}
          </div>
          {primarySections
            .filter((section) => section.label !== "Kosmetické ošetření")
            .map((section) => (
              <PricingSection key={section.id} section={section} />
            ))}
        </Container>
      </section>
      <PricingCTA />
    </div>
  );
}

function buildPricingSections(services: Service[]): PricingSectionData[] {
  const servicesByCategory = new Map<string, Service[]>();

  for (const service of services) {
    const group = servicesByCategory.get(service.category);

    if (group) {
      group.push(service);
      continue;
    }

    servicesByCategory.set(service.category, [service]);
  }

  const configuredSections = pricingCategoryConfigs
    .map((config) => {
      const categoryServices = servicesByCategory.get(config.label);

      if (!categoryServices?.length) {
        return null;
      }

      return {
        id: config.id,
        label: config.label,
        icon: config.icon,
        summary: config.summary,
        layout: config.layout,
        items: categoryServices.map(mapServiceToPricingItem),
      } satisfies PricingSectionData;
    })
    .filter((section): section is PricingSectionData => section !== null);

  const configuredLabels = new Set(configuredSections.map((section) => section.label));
  const fallbackSections = Array.from(servicesByCategory.entries())
    .filter(([category]) => !configuredLabels.has(category))
    .map(([category, categoryServices]) => ({
      id: toKebabCase(category),
      label: category,
      icon: SparkIcon,
      summary: "Přehled služeb v této kategorii.",
      layout: "grid" as const,
      items: categoryServices.map(mapServiceToPricingItem),
    }));

  return [...configuredSections, ...fallbackSections];
}

function mapServiceToPricingItem(service: Service): PricingItemData {
  const meta = servicePricingMetaBySlug[service.slug];

  return {
    slug: service.slug,
    name: service.name,
    description: meta?.pricingDescription ?? service.intro,
    duration: service.duration,
    price: service.priceFrom,
    badge: meta?.badge,
    ctaHref: "/rezervace",
  };
}

function toKebabCase(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function CalendarIcon({ className }: PricingIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M7.5 3.5v4" />
      <path d="M16.5 3.5v4" />
      <path d="M3.5 9.5h17" />
      <path d="M8 13h.01" />
      <path d="M12 13h.01" />
      <path d="M16 13h.01" />
      <path d="M8 17h.01" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function DropletIcon({ className }: PricingIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3.5c3.8 4.6 6.5 8 6.5 11.1A6.5 6.5 0 1 1 5.5 14.6C5.5 11.5 8.2 8.1 12 3.5Z" />
      <path d="M9.3 15.3a2.9 2.9 0 0 0 2.7 1.8" />
    </svg>
  );
}

function EyeLashesIcon({ className }: PricingIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 13c2.2-2.3 5.3-3.5 9-3.5S18.8 10.7 21 13" />
      <path d="M5.5 9.5 4 7.5" />
      <path d="M8.7 8.1 8 5.5" />
      <path d="M12 7.5V4.8" />
      <path d="m15.3 8.1.7-2.6" />
      <path d="M18.5 9.5 20 7.5" />
    </svg>
  );
}

function LotusIcon({ className }: PricingIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 6.5c2.1 1.8 3.3 3.9 3.3 6.2A3.3 3.3 0 0 1 12 16a3.3 3.3 0 0 1-3.3-3.3c0-2.3 1.2-4.4 3.3-6.2Z" />
      <path d="M12 8.1c4 1.1 6.5 3.7 6.5 6.7 0 1.9-1.3 3.2-3.3 3.2-1.7 0-2.9-.6-3.2-1.8" />
      <path d="M12 8.1c-4 1.1-6.5 3.7-6.5 6.7 0 1.9 1.3 3.2 3.3 3.2 1.7 0 2.9-.6 3.2-1.8" />
      <path d="M4 18.5h16" />
    </svg>
  );
}

function BrushIcon({ className }: PricingIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m14.5 4.5 5 5" />
      <path d="M13 6 5.5 13.5a3 3 0 0 0-.8 1.4l-1.2 4.6 4.6-1.2a3 3 0 0 0 1.4-.8L17 10" />
      <path d="M8.5 15.5c1.6.2 2.7 1.3 2.9 2.9" />
    </svg>
  );
}

function LeafIcon({ className }: PricingIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18.5 5.5c-6.8.2-11 4.2-11 10 0 2.7 1.8 4.5 4.3 4.5 5.9 0 9.9-4.3 9.7-11.1a3.2 3.2 0 0 0-3-3.4Z" />
      <path d="M8 19c1.5-2.3 3.7-4.6 7.5-7" />
    </svg>
  );
}

function LipstickIcon({ className }: PricingIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9.5 4.5h5v4.5a2.5 2.5 0 0 1-5 0Z" />
      <path d="M8.2 9.3h7.6V14H8.2Z" />
      <path d="M7 14h10v6.5H7Z" />
    </svg>
  );
}

function SparkLinesIcon({ className }: PricingIconProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 16h9" />
      <path d="M19 16h9" />
      <path d="M16 4v9" />
      <path d="M16 19v9" />
      <path d="m7.7 7.7 6.1 6.1" />
      <path d="m18.2 18.2 6.1 6.1" />
    </svg>
  );
}

function SparkIcon({ className }: PricingIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
    </svg>
  );
}
