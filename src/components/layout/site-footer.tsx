import Link from 'next/link';

import { footerNavigation, mainNavigation } from '@/config/navigation';
import { getPublicSalonProfile } from '@/lib/site-settings';

import { Container } from '../ui/container';

export async function SiteFooter() {
  const salonProfile = await getPublicSalonProfile();
  const phoneHref = `tel:${salonProfile.phone.replace(/\s+/g, '')}`;
  const emailHref = `mailto:${salonProfile.email}`;

  return (
    <footer className="border-t border-black/5 bg-[var(--color-surface)]">
      <Container className="max-w-6xl py-8 sm:py-10">
        <div className="grid gap-8 border-b border-black/5 pb-6 sm:gap-10 sm:pb-8 lg:grid-cols-[minmax(0,1fr)_auto_minmax(15rem,0.8fr)] lg:items-start lg:gap-12">
          <div className="max-w-sm">
            <p className="font-display text-[1.5rem] tracking-[0.14em] text-[var(--color-foreground)]">
              {salonProfile.name}
            </p>
            <p className="mt-3 max-w-[28ch] text-sm leading-6 text-[var(--color-muted)]">
              Komorní studio pro péči o pleť a výraz s osobním přístupem, bez zbytečného spěchu.
            </p>
          </div>

          <div className="grid gap-7 sm:grid-cols-2 sm:gap-8 lg:justify-self-center">
            <nav aria-label="Hlavní navigace" className="grid content-start gap-3">
              <p className="text-eyebrow text-[var(--color-muted)]">Navigace</p>
              <div className="grid gap-2 text-sm text-[var(--color-muted)]">
                {mainNavigation.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="w-fit underline-offset-4 hover:text-[var(--color-foreground)] hover:underline"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </nav>

            <nav aria-label="Důležité informace" className="grid content-start gap-3">
              <p className="text-eyebrow text-[var(--color-muted)]">Informace</p>
              <div className="grid gap-2 text-sm text-[var(--color-muted)]">
                {footerNavigation.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="w-fit underline-offset-4 hover:text-[var(--color-foreground)] hover:underline"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </nav>
          </div>

          <section className="grid gap-3 lg:justify-self-end">
            <p className="text-eyebrow text-[var(--color-muted)]">Kontakt</p>
            <address className="grid gap-2 not-italic">
              <a
                href={phoneHref}
                className="inline-flex min-h-11 items-center gap-3 rounded-2xl border border-black/[0.06] bg-white/55 px-4 py-3 text-[0.95rem] font-medium text-[var(--color-foreground)] shadow-[0_8px_24px_rgba(34,22,12,0.04)] hover:border-black/10 hover:bg-white/78"
              >
                <PhoneIcon />
                <span>{salonProfile.phone}</span>
              </a>
              <a
                href={emailHref}
                className="inline-flex min-h-11 items-center gap-3 rounded-2xl border border-black/[0.06] bg-white/55 px-4 py-3 text-[0.95rem] font-medium text-[var(--color-foreground)] shadow-[0_8px_24px_rgba(34,22,12,0.04)] hover:border-black/10 hover:bg-white/78"
              >
                <MailIcon />
                <span className="break-all">{salonProfile.email}</span>
              </a>
            </address>
          </section>
        </div>

        <div className="pt-4 text-xs tracking-[0.12em] text-[var(--color-muted)]">
          © {new Date().getFullYear()} {salonProfile.name}
        </div>
      </Container>
    </footer>
  );
}

function PhoneIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4 shrink-0 text-[var(--color-accent)]"
    >
      <path
        d="M5.5 3.75h2.1c.3 0 .57.2.64.5l.7 3.04a.67.67 0 0 1-.2.65L7.4 9.25a11.28 11.28 0 0 0 3.35 3.35l1.31-1.34a.67.67 0 0 1 .65-.19l3.04.7c.3.07.5.34.5.64v2.09c0 .38-.3.69-.69.7-.19 0-.38 0-.56-.02A11.5 11.5 0 0 1 4.83 5c-.02-.18-.03-.37-.03-.56 0-.38.31-.69.7-.69Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4 shrink-0 text-[var(--color-accent)]"
    >
      <path
        d="M3.75 5.75h12.5c.41 0 .75.34.75.75v7a.75.75 0 0 1-.75.75H3.75A.75.75 0 0 1 3 13.5v-7c0-.41.34-.75.75-.75Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="m4 6.5 6 4.5 6-4.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
