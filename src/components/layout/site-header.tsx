import Link from 'next/link';

import { mainNavigation } from '@/config/navigation';
import { siteConfig } from '@/config/site';
import { cn } from '@/lib/utils';

import { Container } from '../ui/container';

type SiteHeaderProps = {
  variant?: 'public' | 'booking';
};

export function SiteHeader({ variant = 'public' }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-[color:rgba(248,243,237,0.88)] backdrop-blur-xl">
      <Container className="flex min-h-18 flex-col justify-center gap-4 py-4 md:min-h-20 md:flex-row md:items-center md:justify-between md:py-0">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="font-display text-2xl tracking-[0.18em] text-[var(--color-foreground)]">
            {siteConfig.name}
          </Link>
          <Link
            href="/rezervace"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-foreground)] px-5 text-xs font-semibold uppercase tracking-[0.18em] text-white md:hidden"
          >
            Rezervace
          </Link>
        </div>

        <nav className="flex flex-wrap items-center gap-x-5 gap-y-3 md:justify-center md:gap-7">
          {mainNavigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'text-sm uppercase tracking-[0.14em] transition-colors',
                'text-[var(--color-muted)] hover:text-[var(--color-foreground)]',
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
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-foreground)] px-5 text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-[#2c221d]"
            >
              Rezervovat termín
            </Link>
          ) : null}
          <Link
            href="/admin/prihlaseni"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/10 px-5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-foreground)] hover:border-black/20 hover:bg-white"
          >
            Admin
          </Link>
        </div>
      </Container>
    </header>
  );
}
