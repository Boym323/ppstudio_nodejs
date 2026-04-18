"use client";

export default function BookingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <section className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-8 shadow-[var(--shadow-panel)]">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">
          Rezervace
        </p>
        <h2 className="mt-5 font-display text-4xl text-[var(--color-foreground)]">
          Něco se nepovedlo při načítání rezervační části.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--color-muted)]">
          Zkuste stránku načíst znovu. Pokud problém přetrvá, kontaktujte prosím salon a uveďte čas,
          kdy k chybě došlo.
        </p>
        {process.env.NODE_ENV !== "production" ? (
          <p className="mt-4 rounded-2xl bg-[var(--color-surface)]/45 px-4 py-3 text-sm text-[var(--color-muted)]">
            {error.message}
          </p>
        ) : null}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-13 items-center justify-center rounded-full bg-[var(--color-foreground)] px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-[#2c221d] sm:text-sm"
          >
            Zkusit znovu
          </button>
          <a
            href="/kontakt"
            className="inline-flex min-h-13 items-center justify-center rounded-full border border-black/10 bg-white/75 px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-foreground)] hover:border-black/20 hover:bg-white sm:text-sm"
          >
            Kontakt
          </a>
        </div>
      </section>
    </div>
  );
}
