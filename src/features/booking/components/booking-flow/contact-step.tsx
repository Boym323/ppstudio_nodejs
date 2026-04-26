import type { RefObject } from "react";

import { cn } from "@/lib/utils";

import type { ContactFieldKey } from "./types";

type BookingContactStepProps = {
  sectionRef: RefObject<HTMLDivElement | null>;
  firstContactInputRef: RefObject<HTMLInputElement | null>;
  highlighted: boolean;
  fullName: string;
  email: string;
  phone: string;
  clientNote: string;
  clientNoteError?: string;
  getDisplayedFieldError: (field: ContactFieldKey) => string | undefined;
  onShowSummary: () => void;
  onFullNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onClientNoteChange: (value: string) => void;
  onFieldBlur: (field: ContactFieldKey) => void;
};

export function BookingContactStep({
  sectionRef,
  firstContactInputRef,
  highlighted,
  fullName,
  email,
  phone,
  clientNote,
  clientNoteError,
  getDisplayedFieldError,
  onShowSummary,
  onFullNameChange,
  onEmailChange,
  onPhoneChange,
  onClientNoteChange,
  onFieldBlur,
}: BookingContactStepProps) {
  return (
    <div
      ref={sectionRef}
      className={cn(
        "space-y-4 rounded-3xl transition-all duration-300",
        highlighted
          ? "bg-[var(--color-surface-strong)]/25 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
          : "",
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">
            Krok 3
          </p>
          <h3 className="mt-2 font-display text-3xl text-[var(--color-foreground)]">
            Kontaktní údaje
          </h3>
          <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
            Doplňte kontakt, ať vám můžeme poslat potvrzení a případně se domluvit na detailech.
          </p>
        </div>
        <button
          type="button"
          onClick={onShowSummary}
          className="rounded-full border border-black/8 px-4 py-2 text-sm font-semibold text-[var(--color-foreground)]"
        >
          Zobrazit souhrn
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 sm:col-span-2">
          <span className="text-sm font-semibold text-[var(--color-foreground)]">
            Jméno a příjmení
          </span>
          <input
            ref={firstContactInputRef}
            name="fullName"
            value={fullName}
            onBlur={() => onFieldBlur("fullName")}
            onChange={(event) => onFullNameChange(event.target.value)}
            aria-invalid={getDisplayedFieldError("fullName") ? true : undefined}
            className="min-h-12 w-full rounded-2xl border border-black/8 bg-white px-4 py-3 outline-none focus:border-[var(--color-accent)]"
            autoComplete="name"
          />
          <span className="text-xs text-[var(--color-muted)]">
            Uvedeme ho v potvrzení rezervace.
          </span>
          {getDisplayedFieldError("fullName") ? (
            <span className="block text-sm text-red-700">{getDisplayedFieldError("fullName")}</span>
          ) : null}
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-[var(--color-foreground)]">E-mail</span>
          <input
            name="email"
            type="email"
            value={email}
            onBlur={() => onFieldBlur("email")}
            onChange={(event) => onEmailChange(event.target.value)}
            aria-invalid={getDisplayedFieldError("email") ? true : undefined}
            className="min-h-12 w-full rounded-2xl border border-black/8 bg-white px-4 py-3 outline-none focus:border-[var(--color-accent)]"
            autoComplete="email"
          />
          <span className="text-xs text-[var(--color-muted)]">
            Sem pošleme potvrzení i případné upřesnění.
          </span>
          {getDisplayedFieldError("email") ? (
            <span className="block text-sm text-red-700">{getDisplayedFieldError("email")}</span>
          ) : null}
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-[var(--color-foreground)]">
            Telefon
          </span>
          <input
            name="phone"
            type="tel"
            value={phone}
            onBlur={() => onFieldBlur("phone")}
            onChange={(event) => onPhoneChange(event.target.value)}
            aria-invalid={getDisplayedFieldError("phone") ? true : undefined}
            className="min-h-12 w-full rounded-2xl border border-black/8 bg-white px-4 py-3 outline-none focus:border-[var(--color-accent)]"
            autoComplete="tel"
          />
          <span className="text-xs text-[var(--color-muted)]">
            Hodí se, když bude potřeba rychlá domluva k termínu.
          </span>
          {getDisplayedFieldError("phone") ? (
            <span className="block text-sm text-red-700">{getDisplayedFieldError("phone")}</span>
          ) : null}
        </label>

        <label className="space-y-2 sm:col-span-2">
          <span className="text-sm font-semibold text-[var(--color-foreground)]">
            Poznámka k rezervaci
          </span>
          <textarea
            name="clientNote"
            value={clientNote}
            onChange={(event) => onClientNoteChange(event.target.value)}
            rows={4}
            aria-invalid={clientNoteError ? true : undefined}
            className="w-full rounded-2xl border border-black/8 bg-white px-4 py-3 outline-none focus:border-[var(--color-accent)]"
          />
          <span className="text-xs text-[var(--color-muted)]">
            Nepovinné. Napište sem jen to, co je důležité vědět před návštěvou.
          </span>
          {clientNoteError ? (
            <span className="block text-sm text-red-700">{clientNoteError}</span>
          ) : null}
        </label>
      </div>
    </div>
  );
}
