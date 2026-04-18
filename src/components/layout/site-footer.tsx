import Link from 'next/link';

import { footerNavigation, mainNavigation } from '@/config/navigation';
import { siteConfig } from '@/config/site';

import { Container } from '../ui/container';

export function SiteFooter() {
  return (
    <footer className="border-t border-black/5 bg-[var(--color-surface)]">
      <Container className="grid gap-10 py-10 sm:py-12 lg:grid-cols-[1fr_auto_auto] lg:items-start lg:justify-between">
        <div className="max-w-md">
          <p className="font-display text-2xl tracking-[0.16em] text-[var(--color-foreground)]">
            {siteConfig.name}
          </p>
          <p className="mt-4 text-sm leading-6 text-[var(--color-muted)]">
            Luxusní a čistý prezentační web pro kosmetický salon se silnou rezervací, důvěryhodným obsahem a jasnými provozními informacemi.
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
            <a href={`tel:${siteConfig.contact.phone}`} className="hover:text-[var(--color-foreground)]">
              {siteConfig.contact.phone}
            </a>
            <a href={`mailto:${siteConfig.contact.email}`} className="hover:text-[var(--color-foreground)]">
              {siteConfig.contact.email}
            </a>
          </div>
        </div>
      </Container>
    </footer>
  );
}
