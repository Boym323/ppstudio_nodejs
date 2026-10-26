import Link from "next/link";

import { Container } from "@/components/ui/container";

export function NotFoundPage() {
  return (
    <div className="ppstudio-404-page overflow-hidden">
      <Container className="relative flex min-h-[min(44rem,calc(100svh-4rem))] items-center py-14 sm:py-20 lg:py-24">
        <div className="grid w-full items-center gap-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(25rem,1.08fr)] lg:gap-10 xl:gap-20">
          <div className="relative z-10 max-w-2xl">
            <p className="text-eyebrow text-[var(--color-accent)]">PP Studio · chyba v adrese</p>
            <h2 className="sr-only">404</h2>
            <h1 className="mt-5 max-w-[18ch] font-display text-3xl leading-[1.1] tracking-tight text-[var(--color-foreground)] sm:text-4xl lg:text-[3.65rem]">
              Ups, tahle stránka si odskočila na kosmetiku.
            </h1>
            <p className="mt-6 max-w-[39rem] text-base leading-7 text-[var(--color-muted)] sm:text-lg sm:leading-8">
              Možná jen změnila adresu. My vás ale rádi nasměrujeme zpátky.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/"
                className="button-text inline-flex min-h-13 items-center justify-center rounded-full bg-[var(--color-foreground)] px-7 py-4 text-white hover:bg-[#2c221d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]"
              >
                Zpět na úvod
              </Link>
              <Link
                href="/sluzby"
                className="button-text inline-flex min-h-13 items-center justify-center rounded-full border border-black/10 bg-white/65 px-7 py-4 text-[var(--color-foreground)] hover:border-black/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]"
              >
                Prohlédnout služby
              </Link>
            </div>
          </div>

          <div
            data-testid="not-found-404-art"
            aria-hidden="true"
            className="ppstudio-404-art relative mx-auto flex min-h-[16.5rem] w-full max-w-[34rem] items-center justify-center overflow-hidden rounded-[2rem] border border-black/[0.07] bg-white/35 px-4 py-8 lg:min-h-[26rem] lg:justify-self-end lg:px-8"
          >
            <span className="absolute inset-x-8 top-7 h-px bg-[var(--color-accent)]/20 lg:inset-x-12 lg:top-10" />
            <span className="absolute bottom-7 left-8 h-px w-16 bg-[var(--color-accent)]/35 lg:bottom-10 lg:left-12" />
            <span className="absolute bottom-7 right-8 h-px w-16 bg-[var(--color-accent)]/35 lg:bottom-10 lg:right-12" />
            <span className="ppstudio-404-art-number relative z-10 -translate-x-1 font-display text-[clamp(9rem,22vw,16rem)] leading-none tracking-[-0.14em] text-[var(--color-accent)]/78 lg:-translate-x-3">404</span>
            <span className="absolute bottom-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.3em] text-[var(--color-muted)]/80 lg:bottom-10">PP Studio · 404</span>
          </div>
        </div>
      </Container>
    </div>
  );
}

export function AdminNotFoundPage() {
  return (
    <section className="rounded-[var(--radius-panel)] border border-white/10 bg-white/[0.035] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.16)] sm:p-10">
      <p className="text-eyebrow text-[var(--color-accent-soft)]">PP Studio Admin · 404</p>
      <h2 className="sr-only">404</h2>
      <h1 className="mt-4 max-w-2xl font-display text-4xl leading-tight text-white sm:text-5xl">Tahle administrační stránka se někde zatoulala.</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-white/65">Zkontrolujte adresu nebo se vraťte do provozního přehledu.</p>
      <Link href="/admin" className="button-text mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--color-accent-soft)] px-6 py-3 text-[var(--color-accent-contrast)] hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-soft)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-admin-background)]">
        Zpět do administrace
      </Link>
    </section>
  );
}
