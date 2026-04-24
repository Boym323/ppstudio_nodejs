"use client";

import { useActionState, useMemo, useState } from "react";

import {
  initialManagePublicBookingActionState,
} from "@/features/booking/actions/manage-public-booking-action-state";
import { managePublicBookingAction } from "@/features/booking/actions/manage-public-booking";
import type { PublicBookingManagementPageState } from "@/features/booking/lib/booking-management";
import { buildSlotTimeOptions } from "@/features/booking/lib/booking-time-slots";

type BookingManagementPanelProps = {
  token: string;
  initialState: PublicBookingManagementPageState;
  salonContact: {
    email: string;
    phone: string;
  };
};

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Prague",
  }).format(new Date(value));
}

function formatTimeLabel(value: string) {
  return new Intl.DateTimeFormat("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Prague",
  }).format(new Date(value));
}

function formatDateKey(value: string) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Europe/Prague",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return year && month && day ? `${year}-${month}-${day}` : value.slice(0, 10);
}

function StatusCard({
  eyebrow,
  title,
  description,
  contact,
}: {
  eyebrow: string;
  title: string;
  description: string;
  contact?: {
    email: string;
    phone: string;
  };
}) {
  return (
    <section className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-8 shadow-[var(--shadow-panel)]">
      <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">
        {eyebrow}
      </p>
      <h1 className="mt-5 font-display text-4xl text-[var(--color-foreground)]">{title}</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--color-muted)]">{description}</p>
      {contact ? (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <a
            href={`mailto:${contact.email}`}
            className="inline-flex min-h-11 items-center rounded-full border border-black/10 bg-[var(--color-surface)]/45 px-4 py-2 text-[15px] font-medium text-[var(--color-foreground)] transition hover:border-black/20 hover:bg-white"
          >
            {contact.email}
          </a>
          <a
            href={`tel:${contact.phone}`}
            className="inline-flex min-h-11 items-center rounded-full border border-black/10 bg-[var(--color-surface)]/45 px-4 py-2 text-[15px] font-medium text-[var(--color-foreground)] transition hover:border-black/20 hover:bg-white"
          >
            {contact.phone}
          </a>
        </div>
      ) : null}
    </section>
  );
}

export function BookingManagementPanel({
  token,
  initialState,
  salonContact,
}: BookingManagementPanelProps) {
  const [serverState, formAction] = useActionState(
    managePublicBookingAction,
    initialManagePublicBookingActionState,
  );
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [selectedStartsAt, setSelectedStartsAt] = useState("");

  const slotOptions = useMemo(() => {
    if (initialState.status !== "ready") {
      return [];
    }

    return initialState.slots.flatMap((slot) => {
      if (
        slot.serviceRestrictionMode === "SELECTED"
        && !slot.allowedServiceIds.includes(initialState.serviceId)
      ) {
        return [];
      }

      return buildSlotTimeOptions(slot, initialState.serviceDurationMinutes)
        .filter((option) => !option.isDisabled)
        .filter((option) => option.startsAt !== initialState.scheduledStartsAt);
    });
  }, [initialState]);

  const slotGroups = useMemo(() => {
    const grouped = new Map<string, typeof slotOptions>();

    for (const option of slotOptions) {
      const key = option.startsAt.slice(0, 10);
      const current = grouped.get(key) ?? [];
      current.push(option);
      grouped.set(key, current);
    }

    return Array.from(grouped.entries()).sort((left, right) => left[0].localeCompare(right[0]));
  }, [slotOptions]);

  const selectedOption = slotOptions.find(
    (option) => option.slotId === selectedSlotId && option.startsAt === selectedStartsAt,
  );

  if (serverState.status === "success" && serverState.result) {
    return (
      <StatusCard
        eyebrow="Termín změněn"
        title="Rezervace byla úspěšně přesunuta."
        description={`Původní termín ${serverState.result.previousScheduledAtLabel} jsme změnili na ${serverState.result.scheduledAtLabel}. Potvrzení o změně jsme navázali na standardní e-mailový flow.`}
      />
    );
  }

  if (initialState.status !== "ready") {
    return (
      <StatusCard
        eyebrow="Správa rezervace"
        title="Tuto rezervaci teď nelze změnit online."
        description={initialState.message}
        contact={salonContact}
      />
    );
  }

  return (
    <section className="space-y-6">
      <section className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-8 shadow-[var(--shadow-panel)]">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">
          Správa rezervace
        </p>
        <h1 className="mt-5 font-display text-4xl text-[var(--color-foreground)]">
          Vyberte si nový termín
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--color-muted)]">
          Zde jsou aktuálně dostupné časy pro vaši rezervaci. Online změna je dostupná nejpozději
          {` ${initialState.cancellationHours} hodin před začátkem.`}
        </p>

        <dl className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-black/6 bg-[var(--color-surface)]/45 p-5">
            <dt className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">Služba</dt>
            <dd className="mt-2 text-lg font-semibold text-[var(--color-foreground)]">
              {initialState.serviceName}
            </dd>
          </div>
          <div className="rounded-3xl border border-black/6 bg-[var(--color-surface)]/45 p-5">
            <dt className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">Aktuální termín</dt>
            <dd className="mt-2 text-lg font-semibold text-[var(--color-foreground)]">
              {initialState.scheduledAtLabel}
            </dd>
          </div>
          <div className="rounded-3xl border border-black/6 bg-[var(--color-surface)]/45 p-5">
            <dt className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">Stav</dt>
            <dd className="mt-2 text-lg font-semibold text-[var(--color-foreground)]">
              {initialState.statusLabel}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-8 shadow-[var(--shadow-panel)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">
              Nové termíny
            </p>
            <p className="mt-3 text-base leading-7 text-[var(--color-muted)]">
              Zobrazujeme jen časy, které odpovídají délce vaší služby.
            </p>
          </div>
          <a
            href={initialState.cancellationUrl}
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-red-200 bg-red-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-red-700 transition hover:border-red-300 hover:bg-red-100 sm:text-sm"
          >
            Zrušit rezervaci
          </a>
        </div>

        {slotGroups.length > 0 ? (
          <div className="mt-8 space-y-4">
            {slotGroups.map(([dateKey, options]) => (
              <div key={dateKey} className="rounded-3xl border border-black/6 bg-[var(--color-surface)]/45 p-5">
                <p className="text-sm font-semibold text-[var(--color-foreground)]">
                  {formatDateLabel(options[0]?.startsAt ?? dateKey)}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {options.map((option) => {
                    const isSelected = option.slotId === selectedSlotId && option.startsAt === selectedStartsAt;

                    return (
                      <button
                        key={option.key}
                        type="button"
                        aria-label={`Vybrat nový termín ${formatDateKey(option.startsAt)} ${formatTimeLabel(option.startsAt)}`}
                        onClick={() => {
                          setSelectedSlotId(option.slotId);
                          setSelectedStartsAt(option.startsAt);
                        }}
                        className={
                          isSelected
                            ? "rounded-full border border-[var(--color-accent)]/45 bg-[var(--color-accent)]/12 px-4 py-2 text-sm font-medium text-[var(--color-foreground)]"
                            : "rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-[var(--color-foreground)] transition hover:border-black/20 hover:bg-[var(--color-surface)]/45"
                        }
                      >
                        {formatTimeLabel(option.startsAt)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-3xl border border-dashed border-black/12 bg-[var(--color-surface)]/35 p-5 text-base leading-7 text-[var(--color-muted)]">
            Pro vaši rezervaci teď bohužel nevidíme další online termíny. Ozvěte se nám prosím a rádi
            s vámi domluvíme další postup.
          </div>
        )}

        {serverState.status === "error" && serverState.formError ? (
          <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {serverState.formError}
          </div>
        ) : null}
      </section>

      <section className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-8 shadow-[var(--shadow-panel)]">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">
          Potvrzení změny
        </p>
        <h2 className="mt-5 font-display text-3xl text-[var(--color-foreground)]">
          Potvrdit nový termín
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--color-muted)]">
          Změnu uložíme až po vašem potvrzení.
        </p>

        <dl className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-black/6 bg-[var(--color-surface)]/45 p-5">
            <dt className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">Služba</dt>
            <dd className="mt-2 text-lg font-semibold text-[var(--color-foreground)]">
              {initialState.serviceName}
            </dd>
          </div>
          <div className="rounded-3xl border border-black/6 bg-[var(--color-surface)]/45 p-5">
            <dt className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">Původní termín</dt>
            <dd className="mt-2 text-lg font-semibold text-[var(--color-foreground)]">
              {initialState.scheduledAtLabel}
            </dd>
          </div>
          <div className="rounded-3xl border border-black/6 bg-[var(--color-surface)]/45 p-5">
            <dt className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">Nový termín</dt>
            <dd className="mt-2 text-lg font-semibold text-[var(--color-foreground)]">
              {selectedOption ? `${formatDateLabel(selectedOption.startsAt)}, ${formatTimeLabel(selectedOption.startsAt)}` : "Vyberte čas"}
            </dd>
          </div>
        </dl>

        {serverState.fieldErrors?.slotId ? (
          <p className="mt-4 text-sm text-red-700">{serverState.fieldErrors.slotId}</p>
        ) : null}

        <form action={formAction} className="mt-8 flex flex-col gap-3 sm:flex-row">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="slotId" value={selectedSlotId} />
          <input type="hidden" name="newStartAt" value={selectedStartsAt} />
          <input type="hidden" name="expectedUpdatedAt" value={initialState.expectedUpdatedAt} />
          <button
            type="submit"
            disabled={!selectedOption}
            className="inline-flex min-h-13 items-center justify-center rounded-full bg-[var(--color-foreground)] px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-[#2c221d] disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
          >
            Potvrdit nový termín
          </button>
          <a
            href={`tel:${salonContact.phone}`}
            className="inline-flex min-h-13 items-center justify-center rounded-full border border-black/10 bg-white/75 px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-foreground)] transition hover:border-black/20 hover:bg-white sm:text-sm"
          >
            Zavolat do studia
          </a>
        </form>
      </section>
    </section>
  );
}
