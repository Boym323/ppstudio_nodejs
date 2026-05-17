import Link from "next/link";

import type { getPublicSalonProfile } from "@/lib/site-settings";
import { Container } from "@/components/ui/container";
import type { PublicBookingCatalog } from "@/features/booking/lib/booking-public";

import { BookingFlow } from "./booking-flow";

type BookingPageProps = {
  catalog: PublicBookingCatalog;
  initialSelectedServiceSlug?: string;
  salonProfile: Awaited<ReturnType<typeof getPublicSalonProfile>>;
};

export function BookingPage({ catalog, initialSelectedServiceSlug, salonProfile }: BookingPageProps) {
  const hasServices = catalog.services.length > 0;
  const hasSlots = catalog.slots.length > 0;

  return (
    <div className="py-12 sm:py-16">
      <Container className="space-y-12">
        {!hasServices ? (
          <section className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-8 shadow-[var(--shadow-panel)]">
            <h3 className="font-display text-3xl text-[var(--color-foreground)]">
              Rezervace teď čekají na aktuální nabídku služeb
            </h3>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--color-muted)]">
              Online výběr spustíme hned, jak budou v katalogu dostupné kosmetické služby PP Studia.
              Pokud si chcete péči domluvit už teď, napište nebo zavolejte do studia ve Zlíně.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/kontakt"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--color-foreground)] px-5 py-3 text-sm font-semibold text-white"
              >
                Kontaktovat studio
              </Link>
              <Link
                href="/sluzby"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-black/8 px-5 py-3 text-sm font-semibold text-[var(--color-foreground)]"
              >
                Zobrazit služby
              </Link>
            </div>
          </section>
        ) : !hasSlots ? (
          <section className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-8 shadow-[var(--shadow-panel)]">
            <h3 className="font-display text-3xl text-[var(--color-foreground)]">
              Momentálně nejsou vypsané volné termíny
            </h3>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--color-muted)]">
              Nové časy pro kosmetické ošetření ve Zlíně zveřejňujeme průběžně. Pro konkrétní
              domluvu se ozvěte studiu, případně si mezitím projděte služby a orientační ceník.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/kontakt"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--color-foreground)] px-5 py-3 text-sm font-semibold text-white"
              >
                Kontaktovat studio
              </Link>
              <Link
                href="/cenik"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-black/8 px-5 py-3 text-sm font-semibold text-[var(--color-foreground)]"
              >
                Zobrazit ceník
              </Link>
            </div>
          </section>
        ) : (
          <BookingFlow
            catalog={catalog}
            initialSelectedServiceSlug={initialSelectedServiceSlug}
            salonProfile={salonProfile}
          />
        )}
      </Container>
    </div>
  );
}
