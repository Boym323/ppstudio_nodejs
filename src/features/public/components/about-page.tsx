import Image from 'next/image';

import { aboutContent } from '@/content/public-site';
import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import { TrackedLink } from '@/features/analytics/tracked-link';
import {
  AboutCertificatesGallery,
  type AboutCertificateGalleryItem,
} from '@/features/public/components/about-certificates-gallery';
import { type PublicCertificate } from '@/features/public/lib/public-certificates';
import { type PublicImageAsset } from '@/features/public/lib/public-media';

function HeroSection({ portrait }: { portrait: PublicImageAsset | null }) {
  const { profile } = aboutContent;
  const heroImage = portrait
    ? {
        src: portrait.imageUrl,
        alt: portrait.altText,
        width: portrait.width ?? 640,
        height: portrait.height ?? 960,
      }
    : profile.image;

  return (
    <section className="relative isolate overflow-hidden border-b border-black/5 bg-[radial-gradient(circle_at_top_left,rgba(226,205,182,0.5),transparent_32%),linear-gradient(180deg,#f8f2eb_0%,#f5ede4_48%,#f8f3ed_100%)]">
      <Container className="grid gap-7 py-9 sm:gap-9 sm:py-12 lg:grid-cols-[1.18fr_0.82fr] lg:items-center lg:gap-10 lg:py-16">
        <div className="max-w-[48rem] space-y-6 lg:space-y-7">
          <div className="space-y-5 sm:space-y-6">
            <p className="text-eyebrow tracking-[0.22em] text-[var(--color-accent)]">{profile.eyebrow}</p>
            <h1 className="max-w-[16ch] whitespace-pre-line font-display text-[2.8rem] leading-[0.98] tracking-tight text-[var(--color-foreground)] sm:max-w-[18ch] sm:text-[3.6rem] lg:max-w-[19ch] lg:text-[4.55rem]">
              {profile.headline}
            </h1>
            <p className="max-w-[40rem] text-[15px] leading-7 text-[var(--color-muted)] sm:text-[1.05rem] sm:leading-8">
              {profile.intro}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <TrackedLink
              href={profile.primaryCta.href}
              tracking={{ kind: 'reservation', location: 'o mně', page: 'o-mne' }}
              className="inline-flex min-h-14 items-center justify-center rounded-full bg-[var(--color-foreground)] px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white shadow-[0_16px_36px_rgba(34,22,12,0.14)] hover:bg-[#2c221d] sm:text-sm"
            >
              {profile.primaryCta.label}
            </TrackedLink>
            <TrackedLink
              href={profile.secondaryCta.href}
              tracking={{ kind: 'contact', type: 'contact form', location: 'o mně' }}
              className="inline-flex min-h-14 items-center justify-center rounded-full border border-black/10 bg-white/82 px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-foreground)] hover:border-black/20 hover:bg-white sm:text-sm"
            >
              {profile.secondaryCta.label}
            </TrackedLink>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-1">
            {profile.badges.map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-[var(--color-accent)]/30 bg-[#fff8f1] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent-contrast)] sm:text-[12px]"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>

        <aside className="flex">
          {heroImage ? (
            <div className="relative w-full overflow-hidden rounded-[var(--radius-panel)] border border-white/80 bg-white/70 shadow-[var(--shadow-panel)] backdrop-blur lg:max-w-[34rem] lg:justify-self-end">
              <Image
                src={heroImage.src}
                alt={heroImage.alt}
                width={heroImage.width}
                height={heroImage.height}
                className="h-[20rem] w-full object-cover object-center sm:h-[26rem] lg:h-[30rem]"
                priority
              />
              <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(180deg,rgba(248,242,235,0)_0%,rgba(248,242,235,0.84)_70%,#f8f2eb_100%)]" />
              <div className="absolute bottom-5 left-5 rounded-full border border-white/70 bg-white/82 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)] backdrop-blur">
                PP Studio
              </div>
            </div>
          ) : (
            <div className="w-full overflow-hidden rounded-[var(--radius-panel)] border border-white/75 bg-[linear-gradient(160deg,#f6eee5_0%,#f1e5d7_52%,#eadbc9_100%)] shadow-[var(--shadow-panel)]">
              <div className="relative min-h-[20rem] px-6 py-6 sm:min-h-[25rem] sm:px-8 sm:py-8 lg:min-h-[30rem]">
                <div className="absolute left-[12%] top-[12%] h-20 w-20 rounded-full bg-white/30 blur-2xl" />
                <div className="absolute right-[8%] top-[18%] h-28 w-28 rounded-full bg-[#e8d5c0]/45 blur-3xl" />
                <div className="absolute inset-x-0 bottom-0 h-32 bg-[linear-gradient(180deg,rgba(248,242,235,0)_0%,rgba(248,242,235,0.82)_60%,#f8f2eb_100%)]" />
                <div className="relative flex h-full flex-col justify-end">
                  <div className="w-fit rounded-full border border-white/70 bg-white/65 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)] backdrop-blur">
                    PP Studio
                  </div>
                  <p className="mt-4 max-w-sm font-display text-3xl leading-[1.06] text-[var(--color-foreground)] sm:text-4xl">
                    Hlavní fotografie bude doplněná podle finálního brand výběru.
                  </p>
                </div>
              </div>
            </div>
          )}
        </aside>
      </Container>
    </section>
  );
}

function WhyChooseMeSection() {
  const { whyChooseMe } = aboutContent;

  return (
    <section className="py-8 sm:py-10 lg:py-11">
      <Container className="space-y-5 sm:space-y-6">
        <SectionHeading
          eyebrow={whyChooseMe.eyebrow}
          title={whyChooseMe.title}
          description={whyChooseMe.description}
        />

        <div className="grid items-stretch gap-4 lg:grid-cols-3 xl:gap-5">
          {whyChooseMe.items.map((item, index) => (
            <article
              key={item.title}
              className="flex h-full flex-col rounded-[var(--radius-panel)] border border-black/6 bg-white p-5 shadow-[var(--shadow-panel)] shadow-black/5 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(34,22,12,0.12)] sm:p-6"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)]">
                0{index + 1} —
              </p>
              <h3 className="mt-3 max-w-[19rem] font-display text-[1.75rem] leading-[1.12] text-[var(--color-foreground)]">
                {item.title}
              </h3>
              {item.description ? (
                <p className="mt-3 text-[15px] leading-7 text-[var(--color-muted)]">
                  {item.description}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

function StorySection() {
  const { story } = aboutContent;

  return (
    <section className="pt-8 pb-4 sm:pt-10 sm:pb-5 lg:pt-11 lg:pb-5">
      <Container>
        <article className="rounded-[var(--radius-panel)] border border-black/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,244,236,0.92))] p-5 shadow-[var(--shadow-panel)] sm:p-6 lg:p-7">
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:gap-0">
            <div className="lg:pr-7">
              <SectionHeading eyebrow={story.eyebrow} title={story.title} />
            </div>
            <div className="space-y-3 border-black/5 text-[15px] leading-7 text-[var(--color-muted)] sm:text-base lg:border-l lg:pl-8 xl:pl-10">
              {story.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
        </article>
      </Container>
    </section>
  );
}

function ApproachSection() {
  const { approach } = aboutContent;

  return (
    <section className="pt-4 pb-8 sm:pt-5 sm:pb-10 lg:pt-5 lg:pb-11">
      <Container className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:gap-6">
        <div className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-5 shadow-[var(--shadow-panel)] sm:p-6 lg:sticky lg:top-24">
          <SectionHeading eyebrow={approach.eyebrow} title={approach.title} />
          <p className="mt-4 max-w-xl text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">
            {approach.intro}
          </p>
        </div>

        <div className="grid gap-3.5 sm:gap-4">
          {approach.values.map((value) => (
            <article
              key={value.title}
              className="rounded-[var(--radius-panel)] border border-[#e6dbcf] bg-[linear-gradient(180deg,#fffcf8_0%,#fbf4eb_100%)] p-5 shadow-[var(--shadow-panel)] shadow-black/5 transition duration-200 hover:-translate-y-0.5 hover:border-[#dfd0c0] hover:shadow-[0_24px_60px_rgba(34,22,12,0.1)] sm:p-6"
            >
              <div className="mb-3 h-1.5 w-14 rounded-full bg-[var(--color-accent)]/55" />
              <h3 className="font-display text-[1.85rem] leading-[1.04] text-[var(--color-foreground)] sm:text-[2rem]">
                {value.title}
              </h3>
              <p className="mt-3 max-w-2xl text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">
                {value.description}
              </p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

function WhatToExpectSection() {
  const { expectations } = aboutContent;

  return (
    <section className="py-8 sm:py-10 lg:py-11">
      <Container>
        <div className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-5 shadow-[var(--shadow-panel)] sm:p-6 lg:p-7">
          <SectionHeading eyebrow={expectations.eyebrow} title={expectations.title} />

          <div className="mt-4 space-y-3 text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">
            {expectations.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <ul className="mt-5 flex flex-wrap gap-2">
            {expectations.items.map((item) => (
              <li
                key={item}
                className="rounded-full border border-[#e6dbcf] bg-[#fffcf8] px-3.5 py-2 text-[13px] leading-6 text-[var(--color-foreground)] sm:px-4 sm:text-[14px]"
              >
                {item}
              </li>
            ))}
          </ul>

          <p className="mt-5 max-w-3xl text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">
            {expectations.closing}
          </p>
        </div>
      </Container>
    </section>
  );
}

function buildCertificateGalleryItems(certificates: PublicCertificate[]): AboutCertificateGalleryItem[] {
  if (certificates.length > 0) {
    return certificates.map((certificate) => ({
      id: certificate.id,
      title: certificate.title ?? 'Odborné školení',
      hint: 'Klikněte pro zvětšení',
      alt: certificate.alt ?? certificate.title ?? 'Certifikát z odborného školení',
      imageUrl: certificate.imageUrl,
      width: certificate.width ?? 900,
      height: certificate.height ?? 640,
    }));
  }

  return Array.from({ length: 6 }, (_, index) => ({
    id: `placeholder-${index + 1}`,
    title: 'Odborné školení',
    hint: 'Klikněte pro zvětšení',
    alt: 'Placeholder certifikátu',
    imageUrl: null,
  }));
}

function CertificationsSection({ certificates }: { certificates: PublicCertificate[] }) {
  const items = buildCertificateGalleryItems(certificates);

  return (
    <section className="py-8 sm:py-10 lg:py-11">
      <Container>
        <div className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-5 shadow-[var(--shadow-panel)] sm:p-6 lg:p-7">
          <SectionHeading
            eyebrow="Vzdělávání"
            title="Certifikace"
            description="Odbornost průběžně rozvíjím na odborných školeních. Certifikáty níže jsou výběrem z kurzů a vzdělávání, na kterých stavím svou každodenní praxi."
          />

          <AboutCertificatesGallery certificates={items} />
        </div>
      </Container>
    </section>
  );
}

export function AboutPage({
  certificates,
  portrait,
}: {
  certificates: PublicCertificate[];
  portrait: PublicImageAsset | null;
}) {
  return (
    <div className="overflow-hidden pb-6 sm:pb-10">
      <HeroSection portrait={portrait} />
      <WhyChooseMeSection />
      <StorySection />
      <ApproachSection />
      <WhatToExpectSection />
      <CertificationsSection certificates={certificates} />
    </div>
  );
}
