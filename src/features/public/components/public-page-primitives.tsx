import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

import { Container } from "@/components/ui/container";
import { TrackedAnchor, TrackedLink } from "@/features/analytics/tracked-link";

export function PublicHero({
  eyebrow,
  title,
  description,
  ctaPrompt,
  benefits,
  ctaNote,
  logoImage,
  portraitImage,
  primaryCta,
  secondaryCta,
  aside,
}: {
  eyebrow: string;
  title: string;
  description: string;
  ctaPrompt?: string;
  benefits?: string[];
  ctaNote?: string;
  logoImage?: { src: string; alt: string; width: number; height: number };
  portraitImage?: { src: string; alt: string; width: number; height: number };
  primaryCta?: { href: string; label: string };
  secondaryCta?: { href: string; label: string; variant?: "button" | "text" };
  aside?: ReactNode;
}) {
  const isHomepageStyle = Boolean(logoImage && portraitImage);

  return (
    <section className="relative isolate overflow-hidden border-b border-black/5 bg-[radial-gradient(circle_at_top_left,rgba(226,205,182,0.5),transparent_32%),linear-gradient(180deg,#f8f2eb_0%,#f5ede4_48%,#f8f3ed_100%)]">
      <Container className="grid gap-8 py-10 sm:gap-10 sm:py-16 lg:grid-cols-[1.08fr_0.92fr] lg:items-stretch lg:py-24">
        <div className="space-y-6 sm:space-y-7">
          <div className="space-y-3">
            {!isHomepageStyle ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">{eyebrow}</p>
            ) : null}
            {logoImage ? (
              <div className="relative mx-auto h-[150px] w-[150px] sm:h-[176px] sm:w-[176px]">
                <Image
                  src={logoImage.src}
                  alt={logoImage.alt}
                  fill
                  preload
                  sizes="(min-width: 640px) 176px, 150px"
                  className="object-contain drop-shadow-[0_4px_10px_rgba(23,19,17,0.14)]"
                  fetchPriority="high"
                />
              </div>
            ) : null}
            <h1 className="max-w-3xl font-display text-[2.5rem] leading-[1.04] tracking-tight text-[var(--color-foreground)] sm:text-5xl lg:text-6xl">
              {title}
            </h1>
            <p className="max-w-2xl text-[15px] leading-7 text-[var(--color-muted)] sm:text-lg sm:leading-8">{description}</p>
            {isHomepageStyle && benefits?.length ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {benefits.map((benefit) => (
                  <span
                    key={benefit}
                    className="rounded-full border border-[var(--color-accent)]/35 bg-[#fff7ef] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent-contrast)]"
                  >
                    {benefit}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          {(primaryCta || secondaryCta) && (
            <div className="space-y-3">
              {ctaPrompt ? <p className="text-sm leading-6 text-[var(--color-accent-contrast)] sm:text-[15px]">{ctaPrompt}</p> : null}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {primaryCta ? (
                  <ActionLink
                    href={primaryCta.href}
                    trackingLocation="hero"
                    trackingPage={eyebrow.toLowerCase()}
                    className="inline-flex min-h-13 items-center justify-center rounded-full bg-[var(--color-foreground)] px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-[#2c221d] sm:text-sm"
                  >
                    {primaryCta.label}
                  </ActionLink>
                ) : null}
                {secondaryCta ? (
                  <ActionLink
                    href={secondaryCta.href}
                    trackingLocation="hero"
                    trackingPage={eyebrow.toLowerCase()}
                    className={secondaryCta.variant === "text"
                      ? "text-sm font-medium text-[var(--color-accent-contrast)] underline decoration-[var(--color-accent)] underline-offset-4 transition hover:text-[var(--color-foreground)]"
                      : "inline-flex min-h-13 items-center justify-center rounded-full border border-black/10 bg-white/75 px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-foreground)] hover:border-black/20 hover:bg-white sm:text-sm"}
                  >
                    {secondaryCta.label}
                  </ActionLink>
                ) : null}
              </div>
            </div>
          )}
          {isHomepageStyle && ctaNote ? (
            <p className="max-w-2xl text-[13px] leading-6 text-[var(--color-muted)] sm:text-sm">{ctaNote}</p>
          ) : null}
        </div>
        <div className="flex">
          {portraitImage ? (
            <div className="relative w-full overflow-hidden rounded-[calc(var(--radius-panel)-0.25rem)] border border-white/80 bg-white/70 shadow-[var(--shadow-panel)] backdrop-blur">
              <Image
                src={portraitImage.src}
                alt={portraitImage.alt}
                width={portraitImage.width}
                height={portraitImage.height}
                sizes="(min-width: 1280px) 560px, (min-width: 1024px) 44vw, (min-width: 640px) 90vw, 100vw"
                className="h-[16rem] w-full object-cover object-center sm:h-[20rem] lg:h-[24rem]"
                loading="eager"
              />
            </div>
          ) : aside ? (
            <div className="w-full">{aside}</div>
          ) : (
            <div className="rounded-[calc(var(--radius-panel)-0.25rem)] border border-white/75 bg-white/82 p-5 shadow-[var(--shadow-panel)] backdrop-blur sm:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">
                PP Studio
              </p>
              <p className="mt-4 max-w-md font-display text-2xl leading-[1.12] text-[var(--color-foreground)] sm:text-3xl">
                Péče vedená osobně, s prostorem pro to, co právě potřebujete.
              </p>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}

export function ActionLink({
  href,
  className,
  trackingLocation = "hero",
  trackingPage = "public",
  children,
}: {
  href: string;
  className: string;
  trackingLocation?: string;
  trackingPage?: string;
  children: ReactNode;
}) {
  if (href.startsWith("mailto:")) {
    return (
      <TrackedAnchor
        href={href}
        tracking={{ kind: "contact", type: "email", location: trackingLocation }}
        className={className}
      >
        {children}
      </TrackedAnchor>
    );
  }

  if (href.startsWith("tel:")) {
    return (
      <TrackedAnchor
        href={href}
        tracking={{ kind: "contact", type: "phone", location: trackingLocation }}
        className={className}
      >
        {children}
      </TrackedAnchor>
    );
  }

  if (/^https?:\/\//.test(href)) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }

  if (href.startsWith("/rezervace")) {
    return (
      <TrackedLink
        href={href}
        tracking={{ kind: "reservation", location: trackingLocation, page: trackingPage }}
        className={className}
      >
        {children}
      </TrackedLink>
    );
  }

  if (href.startsWith("/kontakt")) {
    return (
      <TrackedLink
        href={href}
        tracking={{ kind: "contact", type: "contact form", location: trackingLocation }}
        className={className}
      >
        {children}
      </TrackedLink>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function PlaceholderNote({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[calc(var(--radius-panel)-0.5rem)] border border-dashed border-[var(--color-accent)]/45 bg-[#fff8f1] p-5 sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">{title}</p>
      <ul className="mt-4 space-y-2 text-[13px] leading-6 text-[var(--color-muted)] sm:text-sm">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}
