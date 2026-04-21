import Link from 'next/link';
import Image from 'next/image';

import { aboutContent } from '@/content/public-site';
import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';
import {
  AboutCertificatesGallery,
  type AboutCertificateGalleryItem,
} from '@/features/public/components/about-certificates-gallery';
import { type PublicCertificate } from '@/features/public/lib/public-certificates';

function HeroSection() {
  const { profile } = aboutContent;

  return (
    <section className="relative isolate overflow-hidden border-b border-black/5 bg-[radial-gradient(circle_at_top_left,rgba(226,205,182,0.5),transparent_32%),linear-gradient(180deg,#f8f2eb_0%,#f5ede4_48%,#f8f3ed_100%)]">
      <Container className="grid gap-10 py-11 sm:gap-12 sm:py-16 lg:grid-cols-[1.18fr_0.82fr] lg:items-center lg:gap-16 lg:py-24">
        <div className="max-w-[48rem] space-y-10 lg:space-y-11">
          <div className="space-y-7 sm:space-y-8">
            <p className="text-eyebrow tracking-[0.22em] text-[var(--color-accent)]">{profile.eyebrow}</p>
            <h1 className="max-w-[16ch] whitespace-pre-line font-display text-[2.8rem] leading-[0.98] tracking-tight text-[var(--color-foreground)] sm:max-w-[18ch] sm:text-[3.6rem] lg:max-w-[19ch] lg:text-[4.55rem]">
              {profile.headline}
            </h1>
            <p className="max-w-[40rem] text-[15px] leading-7 text-[var(--color-muted)] sm:text-[1.1rem] sm:leading-8">
              {profile.intro}
            </p>
          </div>

          <div className="flex flex-col gap-3.5 pt-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              href={profile.primaryCta.href}
              className="inline-flex min-h-14 items-center justify-center rounded-full bg-[var(--color-foreground)] px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white shadow-[0_16px_36px_rgba(34,22,12,0.14)] hover:bg-[#2c221d] sm:text-sm"
            >
              {profile.primaryCta.label}
            </Link>
            <Link
              href={profile.secondaryCta.href}
              className="inline-flex min-h-14 items-center justify-center rounded-full border border-black/10 bg-white/82 px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-foreground)] hover:border-black/20 hover:bg-white sm:text-sm"
            >
              {profile.secondaryCta.label}
            </Link>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
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
          {profile.image ? (
            <div className="relative w-full overflow-hidden rounded-[var(--radius-panel)] border border-white/80 bg-white/70 shadow-[var(--shadow-panel)] backdrop-blur lg:max-w-[34rem] lg:justify-self-end">
              <Image
                src={profile.image.src}
                alt={profile.image.alt}
                width={profile.image.width}
                height={profile.image.height}
                className="h-[22rem] w-full object-cover object-center sm:h-[29rem] lg:h-[35rem]"
                priority
              />
              <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(180deg,rgba(248,242,235,0)_0%,rgba(248,242,235,0.84)_70%,#f8f2eb_100%)]" />
              <div className="absolute bottom-5 left-5 rounded-full border border-white/70 bg-white/82 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)] backdrop-blur">
                PP Studio
              </div>
            </div>
          ) : (
            <div className="w-full overflow-hidden rounded-[var(--radius-panel)] border border-white/75 bg-[linear-gradient(160deg,#f6eee5_0%,#f1e5d7_52%,#eadbc9_100%)] shadow-[var(--shadow-panel)]">
              <div className="relative min-h-[22rem] px-6 py-6 sm:min-h-[28rem] sm:px-8 sm:py-8 lg:min-h-[36rem]">
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
    <section className="py-10 sm:py-14 lg:py-16">
      <Container className="space-y-8 sm:space-y-10">
        <SectionHeading
          eyebrow={whyChooseMe.eyebrow}
          title={whyChooseMe.title}
          description="Stručně a jasně: co klientky na péči v PP Studiu oceňují nejvíc už od první návštěvy."
        />

        <div className="grid items-stretch gap-5 md:grid-cols-2 xl:gap-6">
          {whyChooseMe.items.map((item, index) => (
            <article
              key={item.title}
              className="flex h-full flex-col rounded-[var(--radius-panel)] border border-black/6 bg-white p-8 shadow-[var(--shadow-panel)] shadow-black/5 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(34,22,12,0.12)] sm:p-9"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)]">
                0{index + 1}
              </p>
              <h3 className="mt-6 max-w-[19rem] font-display text-[1.9rem] leading-[1.14] text-[var(--color-foreground)]">
                {item.title}
              </h3>
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
    <section className="py-10 sm:py-14 lg:py-16">
      <Container>
        <article className="rounded-[var(--radius-panel)] border border-black/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,244,236,0.92))] p-6 shadow-[var(--shadow-panel)] sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:gap-0">
            <div className="lg:pr-10">
              <SectionHeading eyebrow={story.eyebrow} title={story.title} />
            </div>
            <div className="space-y-5 border-black/5 text-[15px] leading-7 text-[var(--color-muted)] sm:text-base lg:border-l lg:pl-12 xl:pl-14">
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
    <section className="py-10 sm:py-14 lg:py-16">
      <Container className="grid gap-7 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:gap-10">
        <div className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-7 shadow-[var(--shadow-panel)] sm:p-8 lg:sticky lg:top-24">
          <SectionHeading eyebrow={approach.eyebrow} title={approach.title} />
          <p className="mt-7 max-w-xl text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">
            {approach.intro}
          </p>
        </div>

        <div className="grid gap-7">
          {approach.values.map((value) => (
            <article
              key={value.title}
              className="rounded-[var(--radius-panel)] border border-[#e6dbcf] bg-[linear-gradient(180deg,#fffcf8_0%,#fbf4eb_100%)] p-7 shadow-[var(--shadow-panel)] shadow-black/5 transition duration-200 hover:-translate-y-0.5 hover:border-[#dfd0c0] hover:shadow-[0_24px_60px_rgba(34,22,12,0.1)] sm:p-8"
            >
              <div className="mb-5 h-1.5 w-16 rounded-full bg-[var(--color-accent)]/55" />
              <h3 className="font-display text-[2.2rem] leading-[1.02] text-[var(--color-foreground)]">{value.title}</h3>
              <p className="mt-5 max-w-2xl text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">
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
  const { expectations, cta } = aboutContent;

  return (
    <section className="py-10 sm:py-14 lg:py-16">
      <Container className="grid gap-7 lg:grid-cols-[1.04fr_0.96fr] lg:items-start lg:gap-8">
        <div className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-6 shadow-[var(--shadow-panel)] sm:p-8 lg:p-10">
          <SectionHeading eyebrow={expectations.eyebrow} title={expectations.title} />

          <div className="mt-6 space-y-5 text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">
            {expectations.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <ul className="mt-8 flex flex-wrap gap-3">
            {expectations.items.map((item) => (
              <li
                key={item}
                className="rounded-full border border-[#e6dbcf] bg-[#fffcf8] px-4 py-3 text-[13px] leading-6 text-[var(--color-foreground)] sm:px-5 sm:text-[14px]"
              >
                {item}
              </li>
            ))}
          </ul>

          <p className="mt-8 max-w-3xl text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">
            {expectations.closing}
          </p>
        </div>

        <aside className="lg:sticky lg:top-24">
          <div className="rounded-[var(--radius-panel)] border border-[#e2d4c4] bg-[linear-gradient(180deg,#f9f3eb_0%,#f5ede4_100%)] p-7 shadow-[0_18px_45px_rgba(67,45,29,0.06)] sm:p-9">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">{cta.eyebrow}</p>
            <h3 className="mt-4 max-w-[13ch] font-display text-[2rem] leading-[1.05] text-[var(--color-foreground)] sm:text-[2.55rem]">
              {cta.title}
            </h3>
            <p className="mt-6 max-w-md text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">{cta.description}</p>

            <div className="mt-14 flex flex-col gap-3.5">
              <Link
                href={cta.primaryCta.href}
                className="inline-flex min-h-14 items-center justify-center rounded-full bg-[var(--color-foreground)] px-8 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white shadow-[0_20px_44px_rgba(34,22,12,0.16)] hover:bg-[#241a15] sm:text-sm"
              >
                {cta.primaryCta.label}
              </Link>
              <Link
                href={cta.secondaryCta.href}
                className="inline-flex min-h-14 items-center justify-center rounded-full border border-black/8 bg-white/92 px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-foreground)] hover:border-black/14 hover:bg-white sm:text-sm"
              >
                {cta.secondaryCta.label}
              </Link>
            </div>
          </div>
        </aside>
      </Container>
    </section>
  );
}

function buildCertificateGalleryItems(certificates: PublicCertificate[]): AboutCertificateGalleryItem[] {
  if (certificates.length > 0) {
    return certificates.map((certificate) => ({
      id: certificate.id,
      title: certificate.title ?? 'Certifikát',
      hint: 'Klikněte pro zvětšení',
      alt: certificate.alt ?? certificate.title ?? 'Certifikát',
      imageUrl: certificate.imageUrl,
    }));
  }

  return Array.from({ length: 6 }, (_, index) => ({
    id: `placeholder-${index + 1}`,
    title: 'Certifikát',
    hint: 'Klikněte pro zvětšení',
    alt: 'Placeholder certifikátu',
    imageUrl: null,
  }));
}

function CertificationsSection({ certificates }: { certificates: PublicCertificate[] }) {
  const items = buildCertificateGalleryItems(certificates);

  return (
    <section className="py-10 sm:py-14 lg:py-16">
      <Container>
        <div className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-6 shadow-[var(--shadow-panel)] sm:p-8 lg:p-10">
          <SectionHeading
            eyebrow="Certifikace"
            title="Odbornost průběžně rozvíjím na odborných školeních."
            description="Certifikáty níže jsou výběr z průběžného vzdělávání, na kterém stavím svou každodenní praxi."
          />

          <AboutCertificatesGallery certificates={items} />
        </div>
      </Container>
    </section>
  );
}

function FinalCtaSection() {
  const { cta } = aboutContent;

  return (
    <section className="py-10 sm:py-14 lg:py-16">
      <Container>
        <div className="rounded-[var(--radius-panel)] bg-[linear-gradient(135deg,#1b1613_0%,#2a211b_55%,#3a2f28_100%)] px-8 py-10 text-white shadow-[0_24px_70px_rgba(34,22,12,0.18)] sm:px-11 sm:py-14 lg:flex lg:items-center lg:justify-between lg:gap-12 lg:px-14 lg:py-16">
          <div className="max-w-[40rem]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[var(--color-accent-soft)]">PP Studio</p>
            <h2 className="mt-4 max-w-[12ch] font-display text-[2.65rem] leading-[1.02] text-white sm:text-[3.35rem] lg:text-[4rem]">
              Chcete si vybrat termín, nebo se nejdřív poradit?
            </h2>
          </div>

          <div className="mt-10 flex flex-col gap-3.5 sm:flex-row lg:mt-0 lg:shrink-0">
            <Link
              href={cta.primaryCta.href}
              className="inline-flex min-h-14 items-center justify-center rounded-full bg-[var(--color-accent)] px-8 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent-contrast)] shadow-[0_18px_40px_rgba(0,0,0,0.18)] hover:brightness-105 sm:text-sm"
            >
              {cta.primaryCta.label}
            </Link>
            <Link
              href={cta.secondaryCta.href}
              className="inline-flex min-h-14 items-center justify-center rounded-full border border-white/18 bg-white/8 px-8 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white hover:border-white/30 hover:bg-white/10 sm:text-sm"
            >
              {cta.secondaryCta.label}
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}

export function AboutPage({ certificates }: { certificates: PublicCertificate[] }) {
  return (
    <div className="overflow-hidden pb-8 sm:pb-12">
      <HeroSection />
      <WhyChooseMeSection />
      <StorySection />
      <ApproachSection />
      <WhatToExpectSection />
      <CertificationsSection certificates={certificates} />
      <FinalCtaSection />
    </div>
  );
}
