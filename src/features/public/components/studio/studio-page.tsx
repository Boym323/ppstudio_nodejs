import Image from 'next/image';

import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import { TrackedLink } from '@/features/analytics/tracked-link';
import { getPublicSalonProfile } from '@/lib/site-settings';
import type { PublicStudioPhoto } from '@/features/public/lib/public-studio-photos';

type StudioPageProps = {
  photos: PublicStudioPhoto[];
};

const highlights = ['klidné prostředí', 'osobní přístup', 'prostor bez spěchu', 'pohodlí při péči'];

export async function StudioPage({ photos }: StudioPageProps) {
  const salonProfile = await getPublicSalonProfile();
  const heroPhoto = photos[0] ?? null;

  return (
    <div className="overflow-hidden pb-8 sm:pb-12">
      <StudioHero photo={heroPhoto} />
      <StudioGallery photos={photos} />
      <StudioHighlights />
      <StudioLocationCta addressLine={salonProfile.addressLine} />
      <StudioFinalCta />
    </div>
  );
}

export function StudioHero({ photo }: { photo: PublicStudioPhoto | null }) {
  return (
    <section className="relative isolate overflow-hidden border-b border-black/5 bg-[linear-gradient(180deg,#f8f2eb_0%,#f4eadf_52%,#f8f3ed_100%)]">
      <Container className="grid gap-8 py-10 sm:gap-10 sm:py-14 lg:grid-cols-[1.03fr_0.97fr] lg:items-center lg:gap-12 lg:py-20">
        <div className="max-w-[48rem] space-y-8">
          <div className="space-y-6">
            <p className="text-eyebrow tracking-[0.22em] text-[var(--color-accent)]">Studio</p>
            <h1 className="max-w-[13ch] font-display text-[2.8rem] leading-[0.98] tracking-tight text-[var(--color-foreground)] sm:text-[3.6rem] lg:text-[4.5rem]">
              Klidné místo pro vaši péči
            </h1>
            <p className="max-w-[42rem] text-[15px] leading-7 text-[var(--color-muted)] sm:text-[1.1rem] sm:leading-8">
              Podívejte se, jak to u nás vypadá ještě před první návštěvou. PP Studio je komorní prostor pro péči o pleť, výraz i chvíli klidu bez zbytečného spěchu.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <TrackedLink
              href="/rezervace"
              tracking={{ kind: 'reservation', location: 'studio', page: 'studio' }}
              className="inline-flex min-h-14 items-center justify-center rounded-full bg-[var(--color-foreground)] px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white shadow-[0_16px_36px_rgba(34,22,12,0.14)] hover:bg-[#2c221d] sm:text-sm"
            >
              Rezervovat termín
            </TrackedLink>
            <TrackedLink
              href="/kontakt"
              tracking={{ kind: 'contact', type: 'contact form', location: 'studio' }}
              className="inline-flex min-h-14 items-center justify-center rounded-full border border-black/10 bg-white/82 px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-foreground)] hover:border-black/20 hover:bg-white sm:text-sm"
            >
              Kontakt
            </TrackedLink>
          </div>
        </div>

        <div className="relative min-h-[22rem] overflow-hidden rounded-[var(--radius-panel)] border border-white/80 bg-white/70 shadow-[var(--shadow-panel)] sm:min-h-[28rem] lg:min-h-[34rem]">
          {photo ? (
            <Image
              src={photo.imageUrl}
              alt={photo.altText}
              fill
              sizes="(min-width: 1024px) 46vw, 100vw"
              className="object-cover object-center"
              priority
            />
          ) : (
            <StudioPhotoPlaceholder className="h-full min-h-[22rem] sm:min-h-[28rem] lg:min-h-[34rem]" label="Fotografie studia připravujeme" />
          )}
          <div className="absolute inset-x-0 bottom-0 h-36 bg-[linear-gradient(180deg,rgba(248,242,235,0)_0%,rgba(248,242,235,0.82)_70%,#f8f2eb_100%)]" />
          <div className="absolute bottom-5 left-5 rounded-full border border-white/70 bg-white/82 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)] backdrop-blur">
            PP Studio
          </div>
        </div>
      </Container>
    </section>
  );
}

export function StudioGallery({ photos }: { photos: PublicStudioPhoto[] }) {
  return (
    <section className="py-10 sm:py-14 lg:py-16">
      <Container className="space-y-7 sm:space-y-9">
        <SectionHeading
          eyebrow="Fotogalerie studia"
          title="Prostor, kde péče probíhá v klidu a osobně."
          description="Krátký pohled do prostředí studia, aby první návštěva nepůsobila neznámě."
        />

        {photos.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {photos.map((photo, index) => (
              <article
                key={photo.id}
                className={index === 0 ? 'sm:col-span-2 lg:col-span-1' : undefined}
              >
                <div className="relative aspect-[4/3] overflow-hidden rounded-[calc(var(--radius-panel)-0.45rem)] border border-white/80 bg-white shadow-[0_18px_50px_rgba(34,22,12,0.08)]">
                  <Image
                    src={photo.imageUrl}
                    alt={photo.altText}
                    fill
                    sizes="(min-width: 1024px) 31vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover object-center transition duration-500 hover:scale-[1.025]"
                  />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-[var(--radius-panel)] border border-black/6 bg-white/82 p-4 shadow-[var(--shadow-panel)] sm:p-5">
            <StudioPhotoPlaceholder className="min-h-[18rem] sm:min-h-[24rem]" label="Fotky studia budou brzy doplněné" />
          </div>
        )}
      </Container>
    </section>
  );
}

export function StudioHighlights() {
  return (
    <section className="py-9 sm:py-12 lg:py-14">
      <Container className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <SectionHeading
          eyebrow="Atmosféra"
          title="Co u nás najdete"
          description="Místo navržené tak, aby péče měla svůj čas, soukromí a přirozený rytmus."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {highlights.map((item, index) => (
            <article
              key={item}
              className="rounded-[var(--radius-panel)] border border-[#e6dbcf] bg-[linear-gradient(180deg,#fffcf8_0%,#fbf4eb_100%)] p-6 shadow-[var(--shadow-panel)] shadow-black/5"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)]">
                0{index + 1}
              </p>
              <h3 className="mt-4 font-display text-[1.85rem] leading-[1.08] text-[var(--color-foreground)]">
                {item}
              </h3>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function StudioLocationCta({ addressLine }: { addressLine: string }) {
  return (
    <section className="py-9 sm:py-12 lg:py-14">
      <Container>
        <article className="grid gap-6 rounded-[var(--radius-panel)] border border-black/6 bg-white p-6 shadow-[var(--shadow-panel)] sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center lg:p-8">
          <div>
            <p className="text-eyebrow text-[var(--color-accent)]">Kde nás najdete</p>
            <h2 className="mt-3 font-display text-[2rem] leading-[1.08] text-[var(--color-foreground)] sm:text-[2.6rem]">
              Snadná cesta do klidného studia.
            </h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">
              Studio najdete na adrese {addressLine}. Pokud si nejste jistá cestou nebo vhodnou službou, napište a domluvíme se v klidu předem.
            </p>
          </div>
          <TrackedLink
            href="/kontakt"
            tracking={{ kind: 'contact', type: 'contact form', location: 'studio' }}
            className="inline-flex min-h-13 items-center justify-center rounded-full border border-black/10 bg-[var(--color-surface)] px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-foreground)] hover:border-black/15 hover:bg-[#f3e7da] sm:text-sm"
          >
            Zobrazit kontakt
          </TrackedLink>
        </article>
      </Container>
    </section>
  );
}

export function StudioFinalCta() {
  return (
    <section className="py-9 sm:py-12 lg:py-14">
      <Container>
        <article className="rounded-[var(--radius-panel)] border border-[#2c221d]/10 bg-[linear-gradient(135deg,#211915_0%,#3a2a22_58%,#6c4d38_100%)] p-6 text-white shadow-[0_28px_80px_rgba(34,22,12,0.18)] sm:p-8 lg:p-10">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-eyebrow text-[#dbc2a5]">Rezervace</p>
              <h2 className="mt-3 max-w-xl font-display text-[2.35rem] leading-[1.02] sm:text-[3.2rem]">
                Chcete si vybrat termín?
              </h2>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <TrackedLink
                href="/rezervace"
                tracking={{ kind: 'reservation', location: 'studio', page: 'studio' }}
                className="inline-flex min-h-13 items-center justify-center rounded-full bg-white px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-foreground)] hover:bg-[#f8f2eb] sm:text-sm"
              >
                Rezervovat termín
              </TrackedLink>
              <TrackedLink
                href="/kontakt"
                tracking={{ kind: 'contact', type: 'contact form', location: 'studio' }}
                className="inline-flex min-h-13 items-center justify-center rounded-full border border-white/25 bg-white/10 px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white hover:border-white/45 hover:bg-white/16 sm:text-sm"
              >
                Napsat do studia
              </TrackedLink>
            </div>
          </div>
        </article>
      </Container>
    </section>
  );
}

function StudioPhotoPlaceholder({ className, label }: { className: string; label: string }) {
  return (
    <div className={`relative flex items-end overflow-hidden rounded-[calc(var(--radius-panel)-0.45rem)] bg-[linear-gradient(145deg,#f8efe5_0%,#efe0d0_54%,#f9f4ee_100%)] ${className}`}>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.18)_1px,transparent_1px)] bg-[length:4rem_4rem]" />
      <div className="relative m-5 max-w-sm rounded-[1.5rem] border border-white/70 bg-white/72 p-5 shadow-[0_18px_48px_rgba(34,22,12,0.08)] backdrop-blur sm:m-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)]">Studio</p>
        <p className="mt-3 font-display text-2xl leading-[1.12] text-[var(--color-foreground)] sm:text-3xl">{label}</p>
      </div>
    </div>
  );
}
