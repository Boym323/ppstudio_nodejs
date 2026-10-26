import Link from "next/link";

import { Container } from "@/components/ui/container";

export function NotFoundPage() {
  return (
    <div className="ppstudio-404-page overflow-hidden">
      <Container className="relative flex min-h-[min(40rem,calc(100svh-7rem))] items-center py-12 sm:py-16 lg:py-20">
        <div className="grid w-full items-center gap-7 sm:gap-10 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-12 xl:gap-16">
          <div className="relative z-10 max-w-[40rem]">
            <p className="text-eyebrow text-[var(--color-accent)]">PP Studio · chyba v adrese</p>
            <h2 className="sr-only">404</h2>
            <h1 className="mt-5 max-w-[19ch] font-display text-[clamp(2.55rem,10vw,3.25rem)] leading-[1.09] tracking-[-0.035em] text-[var(--color-foreground)] sm:mt-7 sm:text-[3.5rem] lg:max-w-[19ch] lg:text-[clamp(3.25rem,4.25vw,4.25rem)]">
              Ups, tahle stránka si odskočila na kosmetiku.
            </h1>
            <p className="mt-5 max-w-[34rem] text-base leading-7 text-[var(--color-muted)] sm:mt-7 sm:text-lg sm:leading-8">
              Možná jen změnila adresu. My vás ale rádi nasměrujeme zpátky.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:flex-wrap">
              <Link
                href="/"
                className="button-text inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--color-foreground)] px-7 py-3.5 text-white hover:bg-[#2c221d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]"
              >
                Zpět na úvod
              </Link>
              <Link
                href="/sluzby"
                className="button-text inline-flex min-h-12 items-center justify-center rounded-full border border-black/10 bg-white/65 px-7 py-3.5 text-[var(--color-foreground)] hover:border-black/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]"
              >
                Prohlédnout služby
              </Link>
            </div>
          </div>

          <div
            data-testid="not-found-404-art"
            aria-hidden="true"
            className="ppstudio-404-art relative mx-auto flex h-[12rem] w-full max-w-[34rem] items-center justify-center sm:h-[17rem] lg:h-[25rem] xl:h-[27rem]"
          >
            <span className="pointer-events-none absolute inset-[5%] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(219,194,165,0.23)_0%,rgba(219,194,165,0.06)_54%,transparent_74%)]" />
            <span className="absolute left-[8%] top-[5%] h-px w-[58%] bg-linear-to-r from-[var(--color-accent)]/35 to-transparent sm:top-[9%]" />
            <span className="absolute left-[12%] top-[10%] whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.25em] text-[var(--color-accent)]/80 sm:top-[14%] sm:text-[10px]">
              Ztracená adresa
            </span>
            <span className="relative z-10 block pr-[0.12em] font-display text-[clamp(8rem,32vw,10rem)] leading-none tracking-[-0.12em] text-[#a98a69] sm:text-[clamp(10rem,25vw,13rem)] lg:text-[clamp(10rem,17vw,13rem)]">
              404
            </span>
            <div className="absolute bottom-[4%] left-[8%] right-[8%] flex items-center justify-center gap-3 sm:bottom-[12%] sm:gap-5">
              <span className="h-px min-w-4 max-w-14 flex-1 bg-[var(--color-accent)]/35" />
              <span className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]/85 sm:text-[10px] sm:tracking-[0.23em]">Stránka nenalezena</span>
              <span className="h-px min-w-4 max-w-14 flex-1 bg-[var(--color-accent)]/35" />
            </div>
            <span className="absolute bottom-0 right-[8%] h-px w-[58%] bg-linear-to-l from-[var(--color-accent)]/35 to-transparent sm:bottom-[7%]" />
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
