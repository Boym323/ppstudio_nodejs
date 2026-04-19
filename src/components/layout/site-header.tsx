'use client';

import Link from 'next/link';

import { mainNavigation } from '@/config/navigation';
import { cn } from '@/lib/utils';

import { Container } from '../ui/container';

type SiteHeaderProps = {
  variant?: 'public' | 'booking';
  brandName?: string;
};

export function SiteHeader({ variant = 'public', brandName = 'PP Studio' }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-[color:rgba(248,243,237,0.9)] backdrop-blur-xl">
      <Container className="flex min-h-18 flex-col justify-center gap-4 py-4 md:min-h-20 md:flex-row md:items-center md:justify-between md:py-0">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex flex-col items-start text-[var(--color-foreground)]">
            <span className="font-display text-[1.55rem] tracking-[0.14em]">{brandName}</span>
            <span className="text-eyebrow mt-1 tracking-[0.15em] text-[var(--color-accent)]">
              COSMETICS &amp; LAMINATIONS
            </span>
          </Link>
          <Link
            href="/rezervace"
            className="button-text inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-foreground)] px-5 text-white md:hidden"
          >
            Rezervace
          </Link>
        </div>

        <nav className="flex flex-wrap items-center gap-2 md:justify-center md:gap-3">
          {mainNavigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'button-text rounded-full px-3 py-2 tracking-[0.15em] transition-colors',
                'text-[var(--color-muted)] hover:bg-white/70 hover:text-[var(--color-foreground)]',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {variant === 'public' ? (
            <Link
              href="/rezervace"
              className="button-text inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-foreground)] px-5 text-white hover:bg-[#2c221d]"
            >
              Rezervovat termín
            </Link>
          ) : null}
          <Link
            href="/admin/prihlaseni"
            className="button-text inline-flex min-h-11 items-center justify-center rounded-full border border-black/10 px-5 text-[var(--color-foreground)] hover:border-black/20 hover:bg-white"
          >
            Admin
          </Link>
        </div>
      </Container>
    </header>
  );
}
