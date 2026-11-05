"use client";

import { Container } from "@/components/ui/container";

export default function PublicError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <Container className="py-16 sm:py-20">
      <section className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-8 shadow-[var(--shadow-panel)]">
        <h1 className="font-display text-4xl text-[var(--color-foreground)]">
          Stránku se teď nepodařilo načíst.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--color-muted)]">
          Zkuste to prosím znovu. Pokud problém přetrvá, kontaktujte studio a ráda vám pomohu osobně.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={retry}
            className="inline-flex min-h-13 items-center justify-center rounded-full bg-[var(--color-foreground)] px-7 py-4 text-sm font-semibold text-white hover:bg-[#2c221d]"
          >
            Zkusit znovu
          </button>
          <a
            href="/kontakt"
            className="inline-flex min-h-13 items-center justify-center rounded-full border border-black/10 bg-white px-7 py-4 text-sm font-semibold text-[var(--color-foreground)] hover:bg-[var(--color-surface)]"
          >
            Kontaktovat studio
          </a>
        </div>
      </section>
    </Container>
  );
}
