import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";

const bookingHighlights = [
  "Ručně publikované termíny pro plnou kontrolu nad kapacitou salonu.",
  "Server-side validace rezervací bez závislosti na křehkém klientském stavu.",
  "Připraveno na napojení Prisma modelu `AvailabilitySlot` a `Booking`.",
] as const;

export function BookingPage() {
  return (
    <div className="py-16 sm:py-20">
      <Container className="space-y-12">
        <SectionHeading
          eyebrow="Rezervace"
          title="Rezervační vrstva je připravená pro skutečný provoz."
          description="Tahle obrazovka není demo s vymyšlenými sloty. Je to čistý základ pro publikované termíny, potvrzení rezervace a další navazující workflow."
        />

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-7 shadow-[var(--shadow-panel)]">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">
              Stav připravenosti
            </p>
            <h3 className="mt-5 font-display text-4xl text-[var(--color-foreground)]">
              Publikované termíny se sem načtou z databáze po prvním napojení obsahu.
            </h3>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--color-muted)]">
              Datový model i stránková struktura už s termíny počítají. Další sprint může rovnou řešit CRUD slotů, potvrzovací flow a notifikace bez přestavby rout.
            </p>
          </section>

          <section className="rounded-[var(--radius-panel)] border border-[var(--color-accent-soft)]/40 bg-[var(--color-surface-strong)] p-7">
            <h3 className="font-display text-3xl text-[var(--color-foreground)]">Co je připravené</h3>
            <ul className="mt-6 space-y-4">
              {bookingHighlights.map((item) => (
                <li
                  key={item}
                  className="rounded-2xl border border-black/6 bg-white/85 px-4 py-4 text-sm leading-6 text-[var(--color-muted)]"
                >
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </Container>
    </div>
  );
}
