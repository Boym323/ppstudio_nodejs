'use client';

import Link from 'next/link';

import { mainNavigation } from '@/config/navigation';
import { TrackedLink } from '@/features/analytics/tracked-link';
import { cn } from '@/lib/utils';

import { Container } from '../ui/container';

type SiteHeaderProps = {
  variant?: 'public' | 'booking';
  brandName?: string;
};

export function SiteHeader({ variant = 'public', brandName = 'PP Studio' }: SiteHeaderProps) {
  const isBookingVariant = variant === 'booking';

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-black/5 bg-[color:rgba(248,243,237,0.9)] backdrop-blur-xl",
        isBookingVariant ? "site-header--booking" : "",
      )}
    >
      <Container
        className={cn(
          "booking-header__container flex flex-col justify-center md:min-h-20 md:flex-row md:items-center md:justify-between md:py-0",
          isBookingVariant ? "min-h-14 gap-2 py-2.5" : "min-h-18 gap-4 py-4",
        )}
      >
        <div className={cn("booking-header__brand-row flex items-center justify-between gap-4", isBookingVariant ? "md:py-2" : "")}>
          <Link href="/" className="flex flex-col items-start text-[var(--color-foreground)]">
            <span className={cn("booking-header__brand-title font-display tracking-[0.14em]", isBookingVariant ? "text-[1.35rem]" : "text-[1.55rem]")}>
              {brandName}
            </span>
            <span className={cn("booking-header__brand-subtitle text-eyebrow mt-1 tracking-[0.15em] text-[var(--color-accent)]", isBookingVariant ? "text-[0.62rem]" : "")}>
              COSMETICS &amp; LAMINATIONS
            </span>
          </Link>
          <TrackedLink
            href="/rezervace"
            tracking={{ kind: 'reservation', location: 'sticky CTA', page: 'header' }}
            className={cn(
              "booking-header__reservation-cta button-text inline-flex items-center justify-center rounded-full bg-[var(--color-foreground)] text-white md:hidden",
              isBookingVariant ? "min-h-10 px-4" : "min-h-11 px-5",
            )}
          >
            Rezervace
          </TrackedLink>
        </div>

        <nav
          className={cn(
            "booking-header__nav flex items-center md:justify-center md:gap-3",
            isBookingVariant
              ? "-mx-1 gap-1 overflow-x-auto pb-0.5 md:mx-0 md:overflow-visible md:pb-0"
              : "flex-wrap gap-2",
          )}
        >
          {mainNavigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'booking-header__nav-link button-text shrink-0 rounded-full px-3 py-2 tracking-[0.15em] transition-colors',
                'text-[var(--color-muted)] hover:bg-white/70 hover:text-[var(--color-foreground)]',
                isBookingVariant ? "px-2.5 py-1.5 text-[0.68rem] md:px-3 md:py-2 md:text-[inherit]" : "",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {!isBookingVariant ? (
            <TrackedLink
              href="/rezervace"
              tracking={{ kind: 'reservation', location: 'sticky CTA', page: 'header' }}
              className="button-text inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-foreground)] px-5 text-white hover:bg-[#2c221d]"
            >
              Rezervovat termín
            </TrackedLink>
          ) : null}
        </div>
      </Container>
    </header>
  );
}
