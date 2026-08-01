import Link from "next/link";

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

function getErrorActionLabel(suggestedStep?: 1 | 2 | 3 | 4) {
  switch (suggestedStep) {
    case 1:
      return "Vrátit se k výběru služby";
    case 2:
      return "Vybrat jiný termín";
    case 3:
      return "Upravit kontakt";
    default:
      return "Zkontrolovat souhrn";
  }
}

function getErrorGuidance(serverState: PublicBookingActionState) {
  if (serverState.suggestedStep === 2) {
    return "Termín se mohl mezitím obsadit nebo už neodpovídá vybrané službě. Vyberte prosím jiný čas, případně se ozvěte studiu a najdeme klidnou alternativu.";
  }

  if (serverState.suggestedStep === 1) {
    return "Služba už nemusí být v online nabídce. Vraťte se k výběru, nebo si otevřete aktuální přehled služeb.";
  }

  if (serverState.suggestedStep === 3) {
    return "Kontakt nebo voucher potřebuje doplnit tak, aby šla rezervace bezpečně potvrdit. Pokud spěcháte, studio ji s vámi dokončí osobně.";
  }

  return "Rezervaci se teď nepodařilo dokončit. Zkontrolujte prosím údaje, nebo kontaktujte PP Studio ve Zlíně.";
}

type BookingSummarySidebarProps = {
  currentStep: number;
  selectedService?: PublicBookingCatalog["services"][number];
  selectedTimeOption?: TimeSlotOption;
  fullName: string;
  email: string;
  phone: string;
  voucherCode: string;
  canGoToStep4: boolean;
  isRefreshingCatalog: boolean;
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
  voucherCode,
  canGoToStep4,
  isRefreshingCatalog,
  serverState,
  onEditService,
  onEditTerm,
  onEditContact,
  onStepBack,
}: BookingSummarySidebarProps) {
  const handleSuggestedStepClick = () => {
    switch (serverState.suggestedStep) {
      case 1:
        onEditService();
        break;
      case 2:
        onEditTerm();
        break;
      case 3:
        onEditContact();
        break;
      default:
        break;
    }
  };

  return (
    <aside className="lg:sticky lg:top-28 lg:self-start">
      <section className="rounded-[var(--radius-panel)] border border-[var(--color-accent-soft)]/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(231,213,195,0.52))] p-4 shadow-[var(--shadow-panel)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">
          Krok 4
        </p>
        <h3 className="mt-2 font-display text-2xl text-[var(--color-foreground)] sm:mt-3 sm:text-3xl">
          Souhrn a potvrzení
        </h3>

        <div className="mt-4 space-y-3 sm:mt-6 sm:space-y-4">
          <div className="rounded-3xl border border-black/6 bg-white/80 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Služba</p>
                <p className="mt-1.5 text-base font-semibold text-[var(--color-foreground)] sm:mt-2 sm:text-lg">
                  {selectedService ? selectedService.name : "Zatím nevybráno"}
                </p>
                {selectedService ? (
                  <p className="mt-1.5 text-sm text-[var(--color-muted)] sm:mt-2">
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
              "rounded-3xl border bg-white/90 p-4 sm:p-5",
              selectedTimeOption
                ? "border-[var(--color-accent)]/40 shadow-[0_10px_24px_rgba(0,0,0,0.06)]"
                : "border-black/6",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Termín</p>
                <p className="mt-1.5 text-sm font-medium text-[var(--color-muted)] sm:mt-3 sm:text-base">
                  {selectedTimeOption ? formatSlotDate(selectedTimeOption.startsAt) : "Zatím nevybráno"}
                </p>
                <p className="mt-1 text-2xl font-semibold text-[var(--color-foreground)] sm:mt-2 sm:text-3xl">
                  {selectedTimeOption ? formatSlotTime(selectedTimeOption.startsAt) : "--:--"}
                </p>
                {selectedTimeOption ? (
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-[var(--color-muted)] sm:mt-3 sm:block sm:space-y-1">
                    <p>Konec {formatSlotTime(selectedTimeOption.endsAt)}</p>
                    <p>{formatSlotDuration(selectedTimeOption.startsAt, selectedTimeOption.endsAt)}</p>
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

          <div className="rounded-3xl border border-black/6 bg-white/80 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Kontakt</p>
                <p className="mt-1.5 text-base font-semibold text-[var(--color-foreground)] sm:mt-2 sm:text-lg">
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

          {voucherCode.trim() ? (
            <div className="rounded-3xl border border-[var(--color-accent)]/28 bg-white/80 p-4 sm:p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Dárkový poukaz</p>
              <p className="mt-1.5 font-mono text-base font-semibold text-[var(--color-foreground)] sm:mt-2">
                {voucherCode.trim()}
              </p>
              <p className="mt-2 text-sm leading-5 text-[var(--color-muted)]">
                Poukaz bude zkontrolován a uplatněn při návštěvě v salonu.
              </p>
            </div>
          ) : null}
        </div>

        <div className="mt-4 rounded-3xl border border-black/6 bg-white/80 p-4 text-sm leading-6 text-[var(--color-muted)] sm:mt-6 sm:p-5">
          Před odesláním si prosím zkontrolujte službu, termín a kontakt. Potvrzení pošleme e-mailem.
        </div>

        {serverState.status === "error" && serverState.suggestedStep ? (
          <div className="mt-4 rounded-3xl border border-red-200 bg-red-50/80 p-4 sm:p-5">
            <p className="text-sm font-semibold text-red-800">
              {serverState.formError ?? "Rezervaci se teď nepodařilo dokončit."}
            </p>
            <p className="mt-2 text-sm leading-6 text-red-700">
              {getErrorGuidance(serverState)}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSuggestedStepClick}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-foreground)] px-4 py-2.5 text-sm font-semibold text-white"
              >
                {getErrorActionLabel(serverState.suggestedStep)}
              </button>
              <Link
                href="/kontakt"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-800"
              >
                Kontaktovat studio
              </Link>
              <Link
                href="/cenik"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-800"
              >
                Zobrazit ceník
              </Link>
            </div>
          </div>
        ) : null}

        <div className="mt-6 hidden flex-wrap gap-3 lg:flex">
          <BookingSubmitButton disabled={!canGoToStep4 || isRefreshingCatalog} />
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
