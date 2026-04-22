"use client";

import { BookingSource, BookingStatus } from "@prisma/client";

import { cn } from "@/lib/utils";

type BookingSourceFieldProps = {
  source: BookingSource;
  onSourceChange: (value: BookingSource) => void;
  bookingStatus: "PENDING" | "CONFIRMED";
  onBookingStatusChange: (value: "PENDING" | "CONFIRMED") => void;
  sourceError?: string;
  statusError?: string;
};

const sourceOptions = [
  { value: BookingSource.WEB, label: "WEB" },
  { value: BookingSource.PHONE, label: "PHONE" },
  { value: BookingSource.INSTAGRAM, label: "INSTAGRAM" },
  { value: BookingSource.IN_PERSON, label: "IN_PERSON" },
  { value: BookingSource.OTHER, label: "OTHER" },
] as const;

export function BookingSourceField({
  source,
  onSourceChange,
  bookingStatus,
  onBookingStatusChange,
  sourceError,
  statusError,
}: BookingSourceFieldProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-soft)]">
          D. Původ rezervace
        </p>
        <h3 className="mt-2 text-lg font-semibold text-white">Odkud rezervace přišla</h3>
        <label className="mt-4 block">
          <span className="text-sm font-medium text-white">Source</span>
          <select
            value={source}
            onChange={(event) => onSourceChange(event.target.value as BookingSource)}
            className={cn(
              "mt-2 w-full rounded-[1rem] border border-white/8 bg-black/20 px-3.5 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/55",
              sourceError ? "border-red-300/40" : "",
            )}
          >
            {sourceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {sourceError ? <p className="mt-2 text-sm text-red-300">{sourceError}</p> : null}
        </label>
      </section>

      <section className="rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-soft)]">
          E. Stav rezervace
        </p>
        <h3 className="mt-2 text-lg font-semibold text-white">Jak má rezervace vzniknout</h3>
        <div className="mt-4 grid gap-2">
          <ChoiceButton
            active={bookingStatus === BookingStatus.CONFIRMED}
            title="Potvrzená"
            description="Termín se hned propíše mezi potvrzené rezervace."
            onClick={() => onBookingStatusChange(BookingStatus.CONFIRMED)}
          />
          <ChoiceButton
            active={bookingStatus === BookingStatus.PENDING}
            title="Čeká na potvrzení"
            description="Rezervace se založí jako čekající a můžete ji potvrdit později."
            onClick={() => onBookingStatusChange(BookingStatus.PENDING)}
          />
        </div>
        {statusError ? <p className="mt-2 text-sm text-red-300">{statusError}</p> : null}
      </section>
    </div>
  );
}

function ChoiceButton({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[1rem] border px-3.5 py-3 text-left transition",
        active
          ? "border-[var(--color-accent)]/45 bg-[var(--color-accent)]/12"
          : "border-white/8 bg-black/12 hover:border-white/14 hover:bg-white/[0.04]",
      )}
    >
      <p className="text-sm font-medium text-white">{title}</p>
      <p className="mt-1 text-sm leading-5 text-white/62">{description}</p>
    </button>
  );
}
