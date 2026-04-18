import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import type { PublicBookingCatalog } from "@/features/booking/lib/booking-public";

import { BookingFlow } from "./booking-flow";

type BookingPageProps = {
  catalog: PublicBookingCatalog;
};

export function BookingPage({ catalog }: BookingPageProps) {
  const hasServices = catalog.services.length > 0;
  const hasSlots = catalog.slots.length > 0;

  return (
    <div className="py-16 sm:py-20">
      <Container className="space-y-12">
        <SectionHeading
          eyebrow="Rezervace"
          title="Rychlé rezervační flow pro ručně publikované termíny."
          description="Klientka projde čtyři jasné kroky, finální validace běží server-side a termín se potvrzuje až při skutečném zápisu do databáze."
        />

        {!hasServices ? (
          <section className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-8 shadow-[var(--shadow-panel)]">
            <h3 className="font-display text-3xl text-[var(--color-foreground)]">
              Zatím chybí aktivní služby
            </h3>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--color-muted)]">
              Rezervační flow je připravené, ale v databázi ještě nejsou dostupné aktivní služby.
            </p>
          </section>
        ) : !hasSlots ? (
          <section className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-8 shadow-[var(--shadow-panel)]">
            <h3 className="font-display text-3xl text-[var(--color-foreground)]">
              Momentálně nejsou publikované volné termíny
            </h3>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--color-muted)]">
              Admin může kdykoli ručně zveřejnit další sloty bez závislosti na pevné otevírací době.
            </p>
          </section>
        ) : (
          <BookingFlow catalog={catalog} />
        )}
      </Container>
    </div>
  );
}
