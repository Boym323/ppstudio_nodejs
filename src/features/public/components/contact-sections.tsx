import Image from 'next/image';

import { Container } from '@/components/ui/container';
import { type ContactItem } from '@/content/public-site';
import { TrackedAnchor, TrackedEmailLink, TrackedLink } from '@/features/analytics/tracked-link';

function getSafeTelHref(phone: string) {
  return `tel:${phone.replace(/\s+/g, '')}`;
}

function isExternalHref(href: string) {
  return href.startsWith('http://') || href.startsWith('https://');
}

function ContactIconPhone() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 16.9v2a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.2 19.2 0 0 1-5.9-5.9A19.8 19.8 0 0 1 2.2 3.3 2 2 0 0 1 4.2 1h2a2 2 0 0 1 2 1.7c.1.8.3 1.6.6 2.4a2 2 0 0 1-.5 2.1l-.9.9a16 16 0 0 0 6.7 6.7l.9-.9a2 2 0 0 1 2.1-.5c.8.3 1.6.5 2.4.6A2 2 0 0 1 22 16.9Z" />
    </svg>
  );
}

function ContactIconMessage() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" />
    </svg>
  );
}

function ContactIconInstagram() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ContactIconParking() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 21V3h6.4a5.2 5.2 0 0 1 0 10.4H9.8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.8 13.4V21" />
    </svg>
  );
}

type ContactHeroProps = {
  title: string;
  description: string;
  phone: string;
  email: string;
  instagramUrl: string | null;
  photo?: {
    src: string;
    title?: string;
    alt: string;
    width: number;
    height: number;
  } | null;
};

function ContactHeroPhotoPlaceholder() {
  return (
    <div className="w-full overflow-hidden rounded-[calc(var(--radius-panel)-0.25rem)] border border-white/75 bg-[linear-gradient(160deg,#f6eee5_0%,#f1e5d7_52%,#eadbc9_100%)] shadow-[var(--shadow-panel)]">
      <div className="relative min-h-[14rem] px-6 py-6 sm:min-h-[17rem] sm:px-8 sm:py-8">
        <div className="absolute left-[12%] top-[12%] h-20 w-20 rounded-full bg-white/30 blur-2xl" />
        <div className="absolute right-[8%] top-[18%] h-28 w-28 rounded-full bg-[#e8d5c0]/45 blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-[linear-gradient(180deg,rgba(248,242,235,0)_0%,rgba(248,242,235,0.82)_60%,#f8f2eb_100%)]" />
        <div className="relative flex h-full flex-col justify-end">
          <div className="w-fit rounded-full border border-white/70 bg-white/65 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)] backdrop-blur">
            PP Studio
          </div>
          <p className="mt-4 max-w-sm font-display text-3xl leading-[1.06] text-[var(--color-foreground)] sm:text-4xl">
            Osobní péče v klidném, soukromém prostředí.
          </p>
          <p className="mt-3 max-w-md text-sm leading-6 text-[var(--color-muted)]">
            Místo pro hlavní fotografii studia nebo majitelky, která doplní první dojem přirozeně a bez vizuálního hluku.
          </p>
        </div>
      </div>
    </div>
  );
}

export function ContactHero({ title, description, phone, email, instagramUrl, photo }: ContactHeroProps) {
  const instagramValue = instagramUrl?.replace(/^https?:\/\/(www\.)?/i, '') ?? null;

  return (
    <section className="relative isolate overflow-hidden border-b border-black/5 bg-[radial-gradient(circle_at_top_left,rgba(226,205,182,0.5),transparent_32%),linear-gradient(180deg,#f8f2eb_0%,#f5ede4_48%,#f8f3ed_100%)]">
      <Container className="grid gap-8 py-10 sm:gap-10 sm:py-14 lg:grid-cols-[1.04fr_0.96fr] lg:items-center lg:gap-12 lg:py-20">
        <div className="space-y-6 lg:space-y-7">
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">Kontakt</p>
            <h1 className="max-w-3xl font-display text-[2.5rem] leading-[1.04] tracking-tight text-[var(--color-foreground)] sm:text-5xl lg:text-6xl">
              {title}
            </h1>
            <p className="max-w-2xl text-[15px] leading-7 text-[var(--color-muted)] sm:text-lg sm:leading-8">{description}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <TrackedLink
              href="/rezervace"
              tracking={{ kind: 'reservation', location: 'kontakt', page: 'kontakt' }}
              className="inline-flex min-h-13 items-center justify-center rounded-full bg-[var(--color-foreground)] px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-[#2c221d] sm:text-sm"
            >
              Rezervovat termín
            </TrackedLink>
            <TrackedEmailLink
              email={email}
              ariaLabel="Napsat e-mail do studia"
              tracking={{ kind: 'contact', type: 'email', location: 'kontakt' }}
              className="inline-flex min-h-13 items-center justify-center rounded-full border border-black/10 bg-white/75 px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-foreground)] hover:border-black/20 hover:bg-white sm:text-sm"
            >
              Napsat do studia
            </TrackedEmailLink>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <TrackedAnchor
              href={getSafeTelHref(phone)}
              tracking={{ kind: 'contact', type: 'phone', location: 'kontakt' }}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-black/10 bg-white/70 px-4 py-2 text-[13px] leading-6 text-[var(--color-foreground)] hover:border-black/20 hover:bg-white"
            >
              <ContactIconPhone />
              <span>{phone}</span>
            </TrackedAnchor>
            <TrackedEmailLink
              email={email}
              ariaLabel="Napsat e-mail do studia"
              tracking={{ kind: 'contact', type: 'email', location: 'kontakt' }}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-black/10 bg-white/70 px-4 py-2 text-[13px] leading-6 text-[var(--color-foreground)] hover:border-black/20 hover:bg-white"
            >
              <ContactIconMessage />
              <span>{email}</span>
            </TrackedEmailLink>
            {instagramUrl && instagramValue ? (
              <TrackedAnchor
                href={instagramUrl}
                tracking={{ kind: 'contact', type: 'instagram', location: 'kontakt' }}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-black/10 bg-white/70 px-4 py-2 text-[13px] leading-6 text-[var(--color-foreground)] hover:border-black/20 hover:bg-white"
              >
                <ContactIconInstagram />
                <span>{instagramValue}</span>
              </TrackedAnchor>
            ) : null}
          </div>
        </div>
        <aside className="flex">
          {photo ? (
            <div className="relative w-full overflow-hidden rounded-[var(--radius-panel)] border border-white/80 bg-white/85 shadow-[var(--shadow-panel)]">
              <Image
                src={photo.src}
                title={photo.title}
                alt={photo.alt}
                fill
                sizes="(min-width: 1024px) 44vw, (min-width: 640px) 88vw, 100vw"
                loading="eager"
                className="object-cover object-center"
              />
              <div
                className="pointer-events-none relative aspect-[4/3] w-full sm:aspect-[5/4] lg:aspect-[4/3]"
                aria-hidden
              />
            </div>
          ) : (
            <ContactHeroPhotoPlaceholder />
          )}
        </aside>
      </Container>
    </section>
  );
}

type ContactCardProps = {
  item: ContactItem;
};

export function ContactCard({ item }: ContactCardProps) {
  const baseClassName =
    'block h-full rounded-[calc(var(--radius-panel)-0.5rem)] border border-black/6 bg-white p-5 shadow-[var(--shadow-panel)] transition duration-200 hover:scale-[1.05] hover:shadow-[0_20px_50px_rgba(64,42,26,0.12)] sm:p-6';

  const content = (
    <>
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">{item.label}</p>
      <p className="mt-3 text-lg leading-7 text-[var(--color-foreground)]">{item.value}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{item.note ?? 'Kliknutím otevřete kontakt.'}</p>
    </>
  );

  if (!item.href) {
    return <div className={baseClassName}>{content}</div>;
  }

  const isExternal = isExternalHref(item.href);

  return (
    <a
      href={item.href}
      className={baseClassName}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noreferrer noopener' : undefined}
    >
      {content}
    </a>
  );
}

type ContactMapPreviewCardProps = {
  address: string;
  href: string;
};

export function ContactMapPreviewCard({ address, href }: ContactMapPreviewCardProps) {
  const embedSrc = `https://www.google.com/maps?q=${encodeURIComponent(address)}&z=16&output=embed`;

  return (
    <TrackedAnchor
      href={href}
      tracking={{ kind: 'contact', type: 'map', location: 'kontakt' }}
      target="_blank"
      rel="noreferrer noopener"
      className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-panel)] border border-black/6 bg-white shadow-[var(--shadow-panel)] transition duration-200 hover:shadow-[0_20px_50px_rgba(64,42,26,0.12)]"
    >
      <div className="relative h-56 overflow-hidden bg-[#efe4d8] sm:h-64 lg:h-auto lg:min-h-72 lg:flex-1">
        <iframe
          title={`Mapa pro adresu ${address}`}
          src={embedSrc}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="pointer-events-none absolute inset-0 h-full w-full border-0 grayscale-[0.1] contrast-[0.98] sepia-[0.08]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(248,242,235,0.08)_0%,rgba(248,242,235,0.14)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(180deg,rgba(248,242,235,0)_0%,rgba(248,242,235,0.78)_58%,#f8f2eb_100%)]" />
      </div>
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
            Jak se k nám dostanete
          </p>
          <p className="font-display text-[1.25rem] leading-[1.08] text-[var(--color-foreground)] sm:text-[1.45rem]">
            {address}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-md text-[14px] leading-6 text-[var(--color-muted)]">
            Otevřete trasu v Google Maps a dorazíte bez zbytečného hledání.
          </p>
          <span className="inline-flex min-h-10 shrink-0 items-center justify-center self-start rounded-full border border-black/10 bg-[var(--color-surface)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-foreground)] transition group-hover:border-black/20 group-hover:bg-[#f5ede4] sm:self-auto">
            Otevřít mapu
          </span>
        </div>
      </div>
    </TrackedAnchor>
  );
}

type ContactParkingInfoCardProps = {
  parkingRateHref: string;
  congressParkingHref: string;
};

type ParkingTip = {
  badge: string;
  name: string;
  walk: string;
  price: string;
  note: string;
  detail: string;
  hoursLabel: string;
  hoursValue: string;
  href: string;
};

const PARKING_TIPS: ParkingTip[] = [
  {
    badge: 'Nejlevnější',
    name: 'Hradská',
    walk: '3-6 min pěšky',
    price: '90-120 min: 36 Kč',
    note: 'Dobrá volba, pokud nevadí krátká procházka.',
    detail: '15 min zdarma · do 60 min 12 Kč',
    hoursLabel: 'Zpoplatněno',
    hoursValue: 'Po-Pá 8:00-19:00, So 7:00-13:00',
    href: 'https://maps.app.goo.gl/ngkfx7mtddd64nAw8',
  },
  {
    badge: 'Kompromis',
    name: 'Gahurova',
    walk: '3-5 min pěšky',
    price: '90-120 min: 40 Kč',
    note: 'Praktická varianta v centru s dobrým poměrem cena / vzdálenost.',
    detail: 'do 30 min 20 Kč · do 60 min 30 Kč',
    hoursLabel: 'Zpoplatněno',
    hoursValue: 'Po-Pá 7:00-19:00, So 7:00-13:00',
    href: 'https://www.google.com/maps/place/Z%C3%A1chytn%C3%A9+parkovi%C5%A1t%C4%9B+Gahurova/@49.2248533,17.6588611,783m/data=!3m1!1e3!4m6!3m5!1s0x471373523e523039:0xb29a3531ed94329d!8m2!3d49.2248534!4d17.6615557!16s%2Fg%2F11cr_r_36l?entry=ttu&g_ep=EgoyMDI2MDQyOS4wIKXMDSoASAFQAw%3D%3D',
  },
  {
    badge: 'Nejblíže',
    name: 'Sadová',
    walk: '1-2 min pěšky',
    price: '90-120 min: 90 Kč',
    note: 'Nejbližší, ale dražší varianta.',
    detail: 'do 30 min 30 Kč · do 60 min 60 Kč',
    hoursLabel: 'Zpoplatněno',
    hoursValue: 'Po-Ne 7:00-21:00',
    href: 'https://maps.app.goo.gl/AJcwaGwLPvt8QV6g6',
  },
  {
    badge: 'Kryté',
    name: 'Kongresové centrum Zlín',
    walk: '4-6 min pěšky',
    price: '90-120 min: obvykle 70 Kč ve všední den přes den',
    note: 'Podzemní parkování vhodné při špatném počasí a běžné denní návštěvě.',
    detail: 'do 30 min zdarma · večer 20 Kč/h · víkend 25 Kč/h',
    hoursLabel: 'Otevřeno',
    hoursValue: '6:00-24:00',
    href: 'https://maps.app.goo.gl/84xMTqz1NKrjaBmL9',
  },
];

export function ContactParkingInfoCard({ parkingRateHref, congressParkingHref }: ContactParkingInfoCardProps) {
  return (
    <section
      id="parkovani"
      className="rounded-[var(--radius-panel)] border border-black/6 bg-white px-5 py-5 shadow-[var(--shadow-panel)] sm:px-6 sm:py-6"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 bg-[var(--color-surface)] text-[var(--color-foreground)]">
          <ContactIconParking />
        </span>
        <div className="min-w-0 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)]">Parkování</p>
          <p className="max-w-3xl text-[15px] leading-6 text-[var(--color-muted)]">
            Pokud přijedete autem, v okolí salonu najdete několik možností v docházkové vzdálenosti. Pro běžnou
            návštěvu kolem 90-120 minut doporučujeme vybírat podle toho, jestli chcete parkovat nejlevněji, nejblíže,
            nebo v krytém parkovišti.
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {PARKING_TIPS.map((tip) => (
          <article
            key={tip.name}
            className="flex h-full flex-col rounded-[calc(var(--radius-panel)-0.45rem)] border border-[#eadfd2] bg-[#fcf8f3] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex rounded-full border border-[#e3d5c7] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]">
                  {tip.badge}
                </span>
                <h3 className="mt-3 font-display text-[1.2rem] leading-[1.08] text-[var(--color-foreground)]">
                  {tip.name}
                </h3>
              </div>
              <TrackedAnchor
                href={tip.href}
                tracking={{ kind: 'contact', type: 'map', location: 'parkovani' }}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-foreground)] underline decoration-black/20 underline-offset-4 transition hover:decoration-black/60"
              >
                Navigovat
              </TrackedAnchor>
            </div>
            <p className="mt-3 text-[13px] leading-5 text-[var(--color-muted)]">{tip.walk}</p>
            <p className="mt-2 text-[15px] font-semibold leading-6 text-[var(--color-foreground)]">{tip.price}</p>
            <p className="mt-2 text-[13px] leading-5 text-[var(--color-muted)]">{tip.note}</p>
            <p className="mt-3 text-[12px] leading-5 text-[var(--color-muted)]">{tip.detail}</p>
            <p className="mt-1 text-[12px] leading-5 text-[var(--color-muted)]">
              <span className="font-medium text-[var(--color-foreground)]">{tip.hoursLabel}:</span> {tip.hoursValue}
            </p>
          </article>
        ))}
      </div>
      <div className="mt-4 space-y-2 border-t border-[#eee2d6] pt-4">
        <p className="text-[12px] leading-5 text-[var(--color-muted)]">
          Ceny parkování jsou orientační a mohou se měnit. Aktuální sazbu si prosím ověřte v parkovacím automatu nebo
          u provozovatele.
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] leading-5 text-[var(--color-muted)]">
          <TrackedAnchor
            href={parkingRateHref}
            tracking={{ kind: 'contact', type: 'map', location: 'parkovani' }}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-black/15 underline-offset-4 transition hover:text-[var(--color-foreground)] hover:decoration-black/40"
          >
            Sazebník parkování ve Zlíně
          </TrackedAnchor>
          <TrackedAnchor
            href={congressParkingHref}
            tracking={{ kind: 'contact', type: 'map', location: 'parkovani' }}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-black/15 underline-offset-4 transition hover:text-[var(--color-foreground)] hover:decoration-black/40"
          >
            Parkování Kongresové centrum
          </TrackedAnchor>
        </div>
        <p className="text-[12px] leading-5 text-[var(--color-muted)]">
          Další možnosti v centru jsou například Městské divadlo, Nad Tržnicí nebo Zlaté Jablko.
        </p>
      </div>
    </section>
  );
}

type QuickContactCardProps = {
  phone: string;
  email: string;
  instagramUrl: string | null;
  operatorName: string;
  operatorId: string;
  openingHours: string;
};

export function QuickContactCard({
  phone,
  email,
  instagramUrl,
  operatorName,
  operatorId,
  openingHours,
}: QuickContactCardProps) {
  const instagramValue = instagramUrl?.replace(/^https?:\/\/(www\.)?/i, '') ?? 'instagram.com';

  return (
    <div className="flex h-full flex-col rounded-[var(--radius-panel)] border border-black/6 bg-white p-6 shadow-[var(--shadow-panel)] sm:p-7">
      <div className="rounded-[calc(var(--radius-panel)-0.55rem)] border border-[#eadfd2] bg-[#fdf9f4] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)]">Provozovatel</p>
        <p className="mt-2 font-display text-[1.9rem] leading-[1.04] text-[var(--color-foreground)]">{operatorName}</p>
        <div className="mt-4 grid gap-3 border-t border-[#eadfd2] pt-4 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">IČ</p>
            <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">{operatorId}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">Otevírací doba</p>
            <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">{openingHours}</p>
          </div>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        <TrackedAnchor
          href={getSafeTelHref(phone)}
          tracking={{ kind: 'contact', type: 'phone', location: 'kontakt' }}
          className="flex items-center gap-3 rounded-2xl border border-[#eadfd2] bg-[#fcf7f1] px-4 py-3.5 transition hover:border-black/15 hover:bg-[#fbf4ec]"
          aria-label={`Telefon ${phone}`}
        >
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-[var(--color-foreground)]">
            <ContactIconPhone />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">Telefon</p>
            <p className="mt-0.5 text-[15px] leading-6 text-[var(--color-foreground)]">{phone}</p>
          </div>
        </TrackedAnchor>
        <TrackedEmailLink
          email={email}
          className="flex items-center gap-3 rounded-2xl border border-[#eadfd2] bg-[#fcf7f1] px-4 py-3.5 transition hover:border-black/15 hover:bg-[#fbf4ec]"
          ariaLabel="Napsat e-mail do studia"
          tracking={{ kind: 'contact', type: 'email', location: 'kontakt' }}
        >
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-[var(--color-foreground)]">
            <ContactIconMessage />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">E-mail</p>
            <p className="mt-0.5 text-[15px] leading-6 text-[var(--color-foreground)]">{email}</p>
          </div>
        </TrackedEmailLink>
        {instagramUrl ? (
          <TrackedAnchor
            href={instagramUrl}
            tracking={{ kind: 'contact', type: 'instagram', location: 'kontakt' }}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-3 rounded-2xl border border-[#eadfd2] bg-[#fcf7f1] px-4 py-3.5 transition hover:border-black/15 hover:bg-[#fbf4ec]"
            aria-label={`Instagram ${instagramValue}`}
          >
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-[var(--color-foreground)]">
              <ContactIconInstagram />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">Instagram</p>
              <p className="mt-0.5 text-[15px] leading-6 text-[var(--color-foreground)]">{instagramValue}</p>
            </div>
          </TrackedAnchor>
        ) : null}
      </div>
    </div>
  );
}

type ContactMobileStickyCTAProps = {
  phone: string;
  email: string;
};

export function ContactMobileStickyCTA({ phone, email }: ContactMobileStickyCTAProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/8 bg-[#fffdf9]/95 px-3 py-3 backdrop-blur sm:hidden">
      <div className="mx-auto flex max-w-7xl items-center gap-2">
        <TrackedLink
          href="/rezervace"
          tracking={{ kind: 'reservation', location: 'sticky CTA', page: 'kontakt' }}
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-[var(--color-foreground)] px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white"
        >
          Rezervovat
        </TrackedLink>
        <TrackedAnchor
          href={getSafeTelHref(phone)}
          tracking={{ kind: 'contact', type: 'phone', location: 'sticky CTA' }}
          aria-label="Zavolat do studia"
          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full border border-black/10 bg-white text-[var(--color-foreground)]"
        >
          <ContactIconPhone />
        </TrackedAnchor>
        <TrackedEmailLink
          email={email}
          aria-label="Napsat do studia"
          tracking={{ kind: 'contact', type: 'email', location: 'sticky CTA' }}
          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full border border-black/10 bg-white text-[var(--color-foreground)]"
        >
          <ContactIconMessage />
        </TrackedEmailLink>
      </div>
    </div>
  );
}
