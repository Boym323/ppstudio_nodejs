import Link from 'next/link';

import { aboutContent } from '@/content/public-site';
import { Container } from '@/components/ui/container';

function AboutProfileSection() {
  const { profile } = aboutContent;

  return (
    <section className="py-12 sm:py-16">
      <Container>
        <div className="mx-auto max-w-4xl rounded-[var(--radius-panel)] border border-[#e6dbcf] bg-white p-6 shadow-[0_18px_50px_rgba(64,42,26,0.06)] sm:p-8 lg:p-10">
          <div className="space-y-4 text-center">
            <h2 className="font-display text-3xl leading-[1.04] text-[var(--color-foreground)] sm:text-4xl">
              {profile.name}
            </h2>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
              {profile.role}
            </p>
            <p className="mx-auto max-w-2xl text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">
              {profile.intro}
            </p>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-2.5">
            {profile.specialties.map((specialty) => (
              <span
                key={specialty}
                className="rounded-full border border-[#ddcfbe] bg-[#fbf5ee] px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent-contrast)] sm:text-[12px]"
              >
                {specialty}
              </span>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

function StorySection() {
  const { story } = aboutContent;

  return (
    <section className="py-12 sm:py-16">
      <Container>
        <article className="mx-auto max-w-4xl rounded-[var(--radius-panel)] border border-[#e6dbcf] bg-white p-6 shadow-[0_18px_50px_rgba(64,42,26,0.06)] sm:p-8 lg:p-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">{story.eyebrow}</p>
          <h2 className="mt-4 font-display text-3xl leading-[1.08] text-[var(--color-foreground)] sm:text-4xl">
            {story.title}
          </h2>
          <div className="mt-8 max-w-3xl space-y-5 text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">
            {story.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </article>
      </Container>
    </section>
  );
}

function ApproachSection() {
  const { approach } = aboutContent;

  return (
    <section className="py-12 sm:py-16">
      <Container className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-[1.02fr_0.98fr]">
        <div className="rounded-[var(--radius-panel)] border border-[#e6dbcf] bg-white p-6 shadow-[0_18px_50px_rgba(64,42,26,0.06)] sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">{approach.eyebrow}</p>
          <h2 className="mt-4 font-display text-3xl leading-[1.08] text-[var(--color-foreground)] sm:text-4xl">
            {approach.title}
          </h2>
          <div className="mt-8 space-y-5 text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">
            {approach.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          {approach.values.map((value) => (
            <article
              key={value.title}
              className="rounded-[calc(var(--radius-panel)-0.35rem)] border border-[#e6dbcf] bg-[#fcf8f2] p-5 shadow-[0_18px_40px_rgba(64,42,26,0.05)] sm:p-6"
            >
              <h3 className="font-display text-2xl leading-none text-[var(--color-foreground)]">{value.title}</h3>
              <p className="mt-3 text-[14px] leading-6 text-[var(--color-muted)] sm:text-sm">{value.description}</p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

function ExpectationsSection() {
  const { expectations, cta } = aboutContent;

  return (
    <section className="py-12 sm:py-16">
      <Container className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[var(--radius-panel)] border border-[#e6dbcf] bg-white p-6 shadow-[0_18px_50px_rgba(64,42,26,0.06)] sm:p-8 lg:p-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">{expectations.eyebrow}</p>
          <h2 className="mt-4 font-display text-3xl leading-[1.08] text-[var(--color-foreground)] sm:text-4xl">
            {expectations.title}
          </h2>
          <p className="mt-5 max-w-3xl text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">{expectations.description}</p>
          <div className="mt-8 rounded-[calc(var(--radius-panel)-0.45rem)] bg-[#f8f2ea] p-5 sm:p-6">
            <p className="text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">{expectations.brandNote}</p>
          </div>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {expectations.items.map((item) => (
              <li
                key={item}
                className="rounded-[calc(var(--radius-panel)-0.45rem)] border border-[#e6dbcf] bg-[#fffcf8] px-4 py-4 text-[14px] leading-6 text-[var(--color-foreground)] sm:px-5"
              >
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-8 max-w-3xl text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">
            {expectations.closing}
          </p>
        </div>
        <aside className="flex">
          <div className="flex w-full flex-col justify-between rounded-[var(--radius-panel)] border border-[#e2d4c4] bg-[linear-gradient(180deg,#f9f3eb_0%,#f5ede4_100%)] p-6 shadow-[0_18px_45px_rgba(67,45,29,0.06)] sm:p-8">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">{cta.eyebrow}</p>
              <h3 className="mt-4 font-display text-3xl leading-[1.06] text-[var(--color-foreground)] sm:text-4xl">
                {cta.title}
              </h3>
              <p className="mt-5 text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">{cta.description}</p>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link
                href={cta.primaryCta.href}
                className="inline-flex min-h-13 items-center justify-center rounded-full bg-[var(--color-foreground)] px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-[#2c221d] sm:text-sm"
              >
                {cta.primaryCta.label}
              </Link>
              <Link
                href={cta.secondaryCta.href}
                className="inline-flex min-h-13 items-center justify-center rounded-full border border-black/10 bg-white/75 px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-foreground)] hover:border-black/20 hover:bg-white sm:text-sm"
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

export function AboutPage() {
  return (
    <div className="pb-8 sm:pb-12">
      <AboutProfileSection />
      <StorySection />
      <ApproachSection />
      <ExpectationsSection />
    </div>
  );
}
