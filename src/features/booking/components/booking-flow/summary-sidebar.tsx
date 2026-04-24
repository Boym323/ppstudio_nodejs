import { type PublicBookingActionState } from "@/features/booking/actions/public-booking-action-state";
import type { PublicBookingCatalog } from "@/features/booking/lib/booking-public";
import type { TimeSlotOption } from "@/features/booking/lib/booking-time-slots";
import { cn } from "@/lib/utils";

import { BookingSubmitButton } from "../booking-submit-button";
import {
  formatPrice,
  formatSlotDate,
  formatSlotDuration,
  formatSlotTime,
} from "./helpers";

type BookingSummarySidebarProps = {
  currentStep: number;
  selectedService?: PublicBookingCatalog["services"][number];
  selectedTimeOption?: TimeSlotOption;
  fullName: string;
  email: string;
  phone: string;
  canGoToStep4: boolean;
  serverState: PublicBookingActionState;
  onEditService: () => void;
  onEditTerm: () => void;
  onEditContact: () => void;
  onStepBack: () => void;
};

export function BookingSummarySidebar({
  currentStep,
  selectedService,
  selectedTimeOption,
  fullName,
  email,
  phone,
  canGoToStep4,
  serverState,
  onEditService,
  onEditTerm,
  onEditContact,
  onStepBack,
}: BookingSummarySidebarProps) {
  return (
    <aside className="lg:sticky lg:top-28 lg:self-start">
      <section className="rounded-[var(--radius-panel)] border border-[var(--color-accent-soft)]/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(231,213,195,0.52))] p-6 shadow-[var(--shadow-panel)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">
          Krok 4
        </p>
        <h3 className="mt-3 font-display text-3xl text-[var(--color-foreground)]">
          Souhrn a potvrzení
        </h3>

        <div className="mt-6 space-y-4">
          <div className="rounded-3xl border border-black/6 bg-white/80 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Služba</p>
                <p className="mt-2 text-lg font-semibold text-[var(--color-foreground)]">
                  {selectedService ? selectedService.name : "Zatím nevybráno"}
                </p>
                {selectedService ? (
                  <p className="mt-2 text-sm text-[var(--color-muted)]">
                    {selectedService.durationMinutes} min • {formatPrice(selectedService.priceFromCzk)}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onEditService}
                className="rounded-full border border-black/8 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-foreground)]"
              >
                Upravit
              </button>
            </div>
          </div>

          <div
            className={cn(
              "rounded-3xl border bg-white/90 p-5",
              selectedTimeOption
                ? "border-[var(--color-accent)]/40 shadow-[0_10px_24px_rgba(0,0,0,0.06)]"
                : "border-black/6",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Termín</p>
                <p className="mt-3 text-base font-medium text-[var(--color-muted)]">
                  {selectedTimeOption ? formatSlotDate(selectedTimeOption.startsAt) : "Zatím nevybráno"}
                </p>
                <p className="mt-2 text-3xl font-semibold text-[var(--color-foreground)]">
                  {selectedTimeOption ? formatSlotTime(selectedTimeOption.startsAt) : "--:--"}
                </p>
                {selectedTimeOption ? (
                  <div className="mt-3 space-y-1 text-sm text-[var(--color-muted)]">
                    <p>Konec v {formatSlotTime(selectedTimeOption.endsAt)}</p>
                    <p>Délka {formatSlotDuration(selectedTimeOption.startsAt, selectedTimeOption.endsAt)}</p>
                    {selectedTimeOption.publicNote ? <p>{selectedTimeOption.publicNote}</p> : null}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onEditTerm}
                className="rounded-full border border-black/8 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-foreground)]"
              >
                Upravit
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-black/6 bg-white/80 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Kontakt</p>
                <p className="mt-2 text-lg font-semibold text-[var(--color-foreground)]">
                  {fullName.trim() || "Doplňte kontaktní údaje"}
                </p>
                {email.trim() ? <p className="mt-1 text-sm text-[var(--color-muted)]">{email.trim()}</p> : null}
                {phone.trim() ? <p className="mt-1 text-sm text-[var(--color-muted)]">{phone.trim()}</p> : null}
              </div>
              <button
                type="button"
                onClick={onEditContact}
                className="rounded-full border border-black/8 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-foreground)]"
              >
                Upravit
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-black/6 bg-white/80 p-5 text-sm leading-6 text-[var(--color-muted)]">
          Po odeslání rezervaci zkontrolujeme, termín podržíme pro schválení a pošleme vám e-mail s
          dalším postupem i storno odkazem.
        </div>

        {serverState.status === "error" && serverState.suggestedStep ? (
          <p className="mt-4 text-sm text-[var(--color-muted)]">
            Doporučený návrat ke kroku {serverState.suggestedStep}, kde je potřeba výběr nebo údaje upravit.
          </p>
        ) : null}

        <div className="mt-6 hidden flex-wrap gap-3 lg:flex">
          <BookingSubmitButton disabled={!canGoToStep4} />
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={onStepBack}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-black/8 px-5 py-3 text-sm font-semibold text-[var(--color-foreground)]"
            >
              Zpět
            </button>
          ) : null}
        </div>

        {!canGoToStep4 ? (
          <p className="mt-4 hidden text-sm text-[var(--color-muted)] lg:block">
            Pro odeslání dokončete výběr služby, termínu a kontaktních údajů.
          </p>
        ) : null}
      </section>
    </aside>
  );
}
