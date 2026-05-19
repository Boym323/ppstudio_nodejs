import type { RefObject } from "react";
import Link from "next/link";

import { type PublicBookingActionState } from "@/features/booking/actions/public-booking-action-state";
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
  voucherCode: string;
  voucherCodeError?: string;
  contactFormError?: PublicBookingActionState["formError"];
  getDisplayedFieldError: (field: ContactFieldKey) => string | undefined;
  onShowSummary: () => void;
  onFullNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onClientNoteChange: (value: string) => void;
  onVoucherCodeChange: (value: string) => void;
  onFieldFocus: (field: ContactFieldKey) => void;
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
  voucherCode,
  voucherCodeError,
  contactFormError,
  getDisplayedFieldError,
  onShowSummary,
  onFullNameChange,
  onEmailChange,
  onPhoneChange,
  onClientNoteChange,
  onVoucherCodeChange,
  onFieldFocus,
  onFieldBlur,
}: BookingContactStepProps) {
  const fullNameError = getDisplayedFieldError("fullName");
  const emailError = getDisplayedFieldError("email");
  const phoneError = getDisplayedFieldError("phone");
  const inputClassName =
    "min-h-12 w-full rounded-2xl border border-black/8 bg-white px-4 py-3 outline-none transition focus:border-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white";
  const errorClassName = "block text-sm text-red-700";

  return (
    <div
      ref={sectionRef}
      className={cn(
        "space-y-4 rounded-3xl transition-all duration-300 p-3",
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
          className="rounded-full border border-black/8 px-4 py-2 text-sm font-semibold text-[var(--color-foreground)] outline-none transition hover:border-[var(--color-accent)]/35 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        >
          Zobrazit souhrn
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <label
            htmlFor="booking-contact-full-name"
            className="block text-sm font-semibold text-[var(--color-foreground)]"
          >
            Jméno a příjmení
          </label>
          <input
            id="booking-contact-full-name"
            ref={firstContactInputRef}
            name="fullName"
            value={fullName}
            onFocus={() => onFieldFocus("fullName")}
            onBlur={() => onFieldBlur("fullName")}
            onChange={(event) => onFullNameChange(event.target.value)}
            aria-describedby={cn(
              "booking-contact-full-name-hint",
              fullNameError ? "booking-contact-full-name-error" : "",
            )}
            aria-invalid={fullNameError ? true : undefined}
            className={inputClassName}
            autoComplete="name"
          />
          <p id="booking-contact-full-name-hint" className="text-xs text-[var(--color-muted)]">
            Uvedeme ho v potvrzení rezervace.
          </p>
          {fullNameError ? (
            <p
              id="booking-contact-full-name-error"
              aria-live="polite"
              className={errorClassName}
            >
              {fullNameError}
            </p>
          ) : null}
        </div>

        {contactFormError ? (
          <div
            id="booking-contact-form-error"
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:col-span-2"
          >
            <p>{contactFormError}</p>
            <Link
              href="/kontakt"
              className="mt-3 inline-flex min-h-10 items-center justify-center rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-800 outline-none transition hover:border-red-300 focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-red-50"
            >
              Kontaktovat studio
            </Link>
          </div>
        ) : null}

        <div className="space-y-2">
          <label
            htmlFor="booking-contact-email"
            className="block text-sm font-semibold text-[var(--color-foreground)]"
          >
            E-mail
          </label>
          <input
            id="booking-contact-email"
            name="email"
            type="email"
            value={email}
            onFocus={() => onFieldFocus("email")}
            onBlur={() => onFieldBlur("email")}
            onChange={(event) => onEmailChange(event.target.value)}
            aria-describedby={cn(
              "booking-contact-email-hint",
              emailError ? "booking-contact-email-error" : "",
            )}
            aria-invalid={emailError ? true : undefined}
            className={inputClassName}
            autoComplete="email"
          />
          <p id="booking-contact-email-hint" className="text-xs text-[var(--color-muted)]">
            Sem pošleme potvrzení i případné upřesnění.
          </p>
          {emailError ? (
            <p id="booking-contact-email-error" aria-live="polite" className={errorClassName}>
              {emailError}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="booking-contact-phone"
            className="block text-sm font-semibold text-[var(--color-foreground)]"
          >
            Telefon
          </label>
          <input
            id="booking-contact-phone"
            name="phone"
            type="tel"
            value={phone}
            onFocus={() => onFieldFocus("phone")}
            onBlur={() => onFieldBlur("phone")}
            onChange={(event) => onPhoneChange(event.target.value)}
            placeholder="777 123 456"
            aria-describedby={cn(
              "booking-contact-phone-hint",
              phoneError ? "booking-contact-phone-error" : "",
            )}
            aria-invalid={phoneError ? true : undefined}
            className={inputClassName}
            autoComplete="tel"
          />
          <p id="booking-contact-phone-hint" className="text-xs text-[var(--color-muted)]">
            Hodí se, když bude potřeba rychlá domluva k termínu.
          </p>
          {phoneError ? (
            <p id="booking-contact-phone-error" aria-live="polite" className={errorClassName}>
              {phoneError}
            </p>
          ) : null}
        </div>

        <div className="space-y-2 sm:col-span-2">
          <label
            htmlFor="booking-contact-client-note"
            className="block text-sm font-semibold text-[var(--color-foreground)]"
          >
            Poznámka k rezervaci
          </label>
          <textarea
            id="booking-contact-client-note"
            name="clientNote"
            value={clientNote}
            onChange={(event) => onClientNoteChange(event.target.value)}
            rows={4}
            aria-describedby={cn(
              "booking-contact-client-note-hint",
              clientNoteError ? "booking-contact-client-note-error" : "",
            )}
            aria-invalid={clientNoteError ? true : undefined}
            className="w-full rounded-2xl border border-black/8 bg-white px-4 py-3 outline-none transition focus:border-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          />
          <p id="booking-contact-client-note-hint" className="text-xs text-[var(--color-muted)]">
            Nepovinné. Napište sem jen to, co je důležité vědět před návštěvou.
          </p>
          {clientNoteError ? (
            <p
              id="booking-contact-client-note-error"
              aria-live="polite"
              className={errorClassName}
            >
              {clientNoteError}
            </p>
          ) : null}
        </div>

        <div className="space-y-3 rounded-2xl border border-[var(--color-accent-soft)]/45 bg-[var(--color-surface)]/28 p-4 sm:col-span-2">
          <div>
            <p className="text-sm font-semibold text-[var(--color-foreground)]">
              Nevyužíváte dárkový poukaz?
            </p>
            <p
              id="booking-contact-voucher-code-hint"
              className="mt-1 text-xs leading-5 text-[var(--color-muted)]"
            >
              Kód poukazu je volitelný. Poukaz bude ověřen a uplatněn až při návštěvě v salonu.
            </p>
          </div>
          <div className="space-y-2">
            <label
              htmlFor="booking-contact-voucher-code"
              className="block text-sm font-semibold text-[var(--color-foreground)]"
            >
              Kód voucheru
            </label>
            <input
              id="booking-contact-voucher-code"
              name="voucherCode"
              value={voucherCode}
              onChange={(event) => onVoucherCodeChange(event.target.value)}
              aria-describedby={cn(
                "booking-contact-voucher-code-hint",
                voucherCodeError ? "booking-contact-voucher-code-error" : "",
              )}
              aria-invalid={voucherCodeError ? true : undefined}
              className="min-h-12 w-full rounded-2xl border border-black/8 bg-white px-4 py-3 font-mono text-sm uppercase tracking-[0.08em] outline-none transition focus:border-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              autoComplete="off"
              inputMode="text"
            />
            {voucherCodeError ? (
              <p
                id="booking-contact-voucher-code-error"
                aria-live="polite"
                className={errorClassName}
              >
                {voucherCodeError}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
