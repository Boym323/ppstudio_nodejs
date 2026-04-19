import Link from 'next/link';

import { footerNavigation, mainNavigation } from '@/config/navigation';
import { getPublicSalonProfile } from '@/lib/site-settings';

import { Container } from '../ui/container';

export async function SiteFooter() {
  const salonProfile = await getPublicSalonProfile();

  return (
    <footer className="border-t border-black/5 bg-[var(--color-surface)]">
      <Container className="grid gap-10 py-10 sm:py-12 lg:grid-cols-[1.1fr_auto_auto] lg:items-start lg:justify-between">
        <div className="max-w-md">
          <p className="font-display text-[1.55rem] tracking-[0.14em] text-[var(--color-foreground)]">
            {salonProfile.name}
          </p>
          <p className="mt-4 max-w-md text-sm leading-7 text-[var(--color-muted)]">
            Komorní studio pro péči o pleť, výraz i celkový pocit ze sebe. Přehledně, osobně a bez zbytečného spěchu.
          </p>
        </div>

        <nav className="grid gap-3 text-sm text-[var(--color-muted)]">
          {mainNavigation.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-[var(--color-foreground)]">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="grid gap-5 text-sm text-[var(--color-muted)] sm:grid-cols-2 lg:grid-cols-1">
          <div className="grid gap-3">
            {footerNavigation.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-[var(--color-foreground)]">
                {item.label}
              </Link>
            ))}
          </div>
          <div className="grid gap-2 lg:pt-2">
            <a href={`tel:${salonProfile.phone.replace(/\s+/g, '')}`} className="hover:text-[var(--color-foreground)]">
              {salonProfile.phone}
            </a>
            <a href={`mailto:${salonProfile.email}`} className="hover:text-[var(--color-foreground)]">
              {salonProfile.email}
            </a>
          </div>
        </div>
      </Container>
    </footer>
  );
}
