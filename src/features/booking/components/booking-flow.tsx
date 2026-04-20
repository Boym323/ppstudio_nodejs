"use client";

import { AvailabilitySlotServiceRestrictionMode } from "@prisma/client";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import { createPublicBookingAction } from "@/features/booking/actions/create-public-booking";
import { initialPublicBookingActionState } from "@/features/booking/actions/public-booking-action-state";
import type { PublicBookingCatalog } from "@/features/booking/lib/booking-public";
import {
  buildSlotTimeOptions,
  groupSlotsByDayPeriod,
  type TimeSlotOption,
} from "@/features/booking/lib/booking-time-slots";
import { cn } from "@/lib/utils";

import { BookingSubmitButton } from "./booking-submit-button";
import { TimeSlotGroup } from "./time-slot-group";

type BookingFlowProps = {
  catalog: PublicBookingCatalog;
};

const stepLabels = [
  "Služba",
  "Termín",
  "Kontakt",
  "Souhrn",
] as const;
const EMPTY_TIME_SLOTS: TimeSlotOption[] = [];
const slotDateKeyFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Europe/Prague",
});
const calendarGridColumnsStyle = {
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
} as const;

function formatPrice(priceFromCzk: number | null) {
  if (!priceFromCzk) {
    return "Cena na vyžádání";
  }

  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(priceFromCzk);
}

function formatSlotDate(startsAt: string) {
  return new Intl.DateTimeFormat("cs-CZ", {
    weekday: "short",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Prague",
  }).format(new Date(startsAt));
}

function formatSlotTime(value: string) {
  return new Intl.DateTimeFormat("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Prague",
  }).format(new Date(value));
}

function formatCalendarMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map((part) => Number(part));

  if (!year || !month) {
    return "";
  }

  return new Intl.DateTimeFormat("cs-CZ", {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Prague",
  }).format(new Date(Date.UTC(year, month - 1, 1, 12, 0, 0)));
}

function getSlotDateKey(value: string) {
  const parsedValue = new Date(value);

  if (Number.isNaN(parsedValue.getTime())) {
    return "";
  }

  let year = "";
  let month = "";
  let day = "";

  for (const part of slotDateKeyFormatter.formatToParts(parsedValue)) {
    if (part.type === "year") {
      year = part.value;
    } else if (part.type === "month") {
      month = part.value;
    } else if (part.type === "day") {
      day = part.value;
    }
  }

  if (!year || !month || !day) {
    return "";
  }

  return `${year}-${month}-${day}`;
}

function getSlotDayNumber(dateKey: string) {
  const dayValue = Number(dateKey.split("-")[2]);

  if (!Number.isInteger(dayValue) || dayValue < 1 || dayValue > 31) {
    return "";
  }

  return String(dayValue);
}

function formatSlotDuration(startsAt: string, endsAt: string) {
  const durationMinutes = Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / (1000 * 60));
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours} h ${minutes} min`;
  }

  if (hours > 0) {
    return `${hours} h`;
  }

  return `${minutes} min`;
}

function getSlotDurationMinutes(slot: PublicBookingCatalog["slots"][number]) {
  return (new Date(slot.endsAt).getTime() - new Date(slot.startsAt).getTime()) / (1000 * 60);
}

export function BookingFlow({ catalog }: BookingFlowProps) {
  const [serverState, formAction] = useActionState(
    createPublicBookingAction,
    initialPublicBookingActionState,
  );
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedTimeOptionKey, setSelectedTimeOptionKey] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [clientNote, setClientNote] = useState("");
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedDateKey, setSelectedDateKey] = useState("");
  const [visibleMonthKey, setVisibleMonthKey] = useState("");
  const [isTermStepHighlighted, setIsTermStepHighlighted] = useState(false);
  const [isContactStepHighlighted, setIsContactStepHighlighted] = useState(false);
  const termStepSectionRef = useRef<HTMLDivElement | null>(null);
  const termStepHighlightTimeoutRef = useRef<number | null>(null);
  const contactStepSectionRef = useRef<HTMLDivElement | null>(null);
  const firstContactInputRef = useRef<HTMLInputElement | null>(null);
  const contactStepHighlightTimeoutRef = useRef<number | null>(null);
  const contactStepFocusTimeoutRef = useRef<number | null>(null);

  const focusTermStepSection = () => {
    const sectionElement = termStepSectionRef.current;

    if (!sectionElement) {
      return;
    }

    if (termStepHighlightTimeoutRef.current !== null) {
      window.clearTimeout(termStepHighlightTimeoutRef.current);
    }

    setIsTermStepHighlighted(true);
    termStepHighlightTimeoutRef.current = window.setTimeout(() => {
      setIsTermStepHighlighted(false);
      termStepHighlightTimeoutRef.current = null;
    }, 750);

    window.requestAnimationFrame(() => {
      const rect = sectionElement.getBoundingClientRect();
      const topSafeArea = 120;
      const bottomSafeArea = 48;
      const isComfortablyVisible =
        rect.top >= topSafeArea && rect.bottom <= window.innerHeight - bottomSafeArea;

      if (isComfortablyVisible) {
        return;
      }

      const desktopOffset = 112;
      const mobileOffset = 88;
      const targetTop =
        window.scrollY + rect.top - (window.innerWidth >= 1024 ? desktopOffset : mobileOffset);

      window.scrollTo({
        top: Math.max(0, targetTop),
        behavior: "smooth",
      });
    });
  };

  const focusContactStepSection = () => {
    const sectionElement = contactStepSectionRef.current;
    const firstInputElement = firstContactInputRef.current;

    if (!sectionElement || !firstInputElement) {
      return;
    }

    if (contactStepHighlightTimeoutRef.current !== null) {
      window.clearTimeout(contactStepHighlightTimeoutRef.current);
    }

    if (contactStepFocusTimeoutRef.current !== null) {
      window.clearTimeout(contactStepFocusTimeoutRef.current);
    }

    setIsContactStepHighlighted(true);
    contactStepHighlightTimeoutRef.current = window.setTimeout(() => {
      setIsContactStepHighlighted(false);
      contactStepHighlightTimeoutRef.current = null;
    }, 900);

    window.requestAnimationFrame(() => {
      const rect = sectionElement.getBoundingClientRect();
      const topSafeArea = 120;
      const bottomSafeArea = 64;
      const isComfortablyVisible =
        rect.top >= topSafeArea && rect.bottom <= window.innerHeight - bottomSafeArea;

      const focusFirstInput = () => {
        firstInputElement.focus({ preventScroll: true });
      };

      if (isComfortablyVisible) {
        focusFirstInput();
        return;
      }

      const desktopOffset = 104;
      const mobileOffset = 72;
      const targetTop =
        window.scrollY + rect.top - (window.innerWidth >= 1024 ? desktopOffset : mobileOffset);

      window.scrollTo({
        top: Math.max(0, targetTop),
        behavior: "smooth",
      });

      contactStepFocusTimeoutRef.current = window.setTimeout(() => {
        focusFirstInput();
        contactStepFocusTimeoutRef.current = null;
      }, 280);
    });
  };

  useEffect(() => {
    return () => {
      if (termStepHighlightTimeoutRef.current !== null) {
        window.clearTimeout(termStepHighlightTimeoutRef.current);
      }
      if (contactStepHighlightTimeoutRef.current !== null) {
        window.clearTimeout(contactStepHighlightTimeoutRef.current);
      }
      if (contactStepFocusTimeoutRef.current !== null) {
        window.clearTimeout(contactStepFocusTimeoutRef.current);
      }
    };
  }, []);

  const servicesById = useMemo(
    () => new Map(catalog.services.map((service) => [service.id, service])),
    [catalog.services],
  );

  const selectedService = selectedServiceId ? servicesById.get(selectedServiceId) : undefined;
  const availableSlots = useMemo(() => {
    if (!selectedServiceId) {
      return [];
    }

    return catalog.slots.filter((slot) => {
      if (!selectedService) {
        return false;
      }

      if (getSlotDurationMinutes(slot) < selectedService.durationMinutes) {
        return false;
      }

      if (slot.serviceRestrictionMode === AvailabilitySlotServiceRestrictionMode.ANY) {
        return true;
      }

      return slot.allowedServiceIds.includes(selectedServiceId);
    });
  }, [catalog.slots, selectedService, selectedServiceId]);
  const availableTimeOptions = useMemo(() => {
    if (!selectedService) {
      return [];
    }

    return availableSlots.flatMap((slot) => buildSlotTimeOptions(slot, selectedService.durationMinutes));
  }, [availableSlots, selectedService]);
  const selectedTimeOptionCandidate = selectedTimeOptionKey
    ? availableTimeOptions.find((option) => option.key === selectedTimeOptionKey)
    : undefined;
  const selectedTimeOption = selectedTimeOptionCandidate && !selectedTimeOptionCandidate.isDisabled
    ? selectedTimeOptionCandidate
    : undefined;
  const selectableTimeOptions = useMemo(
    () => availableTimeOptions.filter((option) => !option.isDisabled),
    [availableTimeOptions],
  );
  const availableSlotsByDate = useMemo(() => {
    const grouped = new Map<string, TimeSlotOption[]>();

    for (const slotOption of availableTimeOptions) {
      const dateKey = getSlotDateKey(slotOption.startsAt);
      if (!dateKey) {
        continue;
      }
      const current = grouped.get(dateKey) ?? [];
      current.push(slotOption);
      grouped.set(dateKey, current);
    }

    for (const [dateKey, slots] of grouped.entries()) {
      grouped.set(
        dateKey,
        [...slots].sort((slotA, slotB) => new Date(slotA.startsAt).getTime() - new Date(slotB.startsAt).getTime()),
      );
    }

    return grouped;
  }, [availableTimeOptions]);
  const availableDateKeys = useMemo(
    () => [...availableSlotsByDate.keys()].sort((dateA, dateB) => dateA.localeCompare(dateB)),
    [availableSlotsByDate],
  );
  const availableMonths = useMemo(
    () =>
      Array.from(
        new Set(availableDateKeys.map((dateKey) => dateKey.slice(0, 7))),
      ).sort((monthA, monthB) => monthA.localeCompare(monthB)),
    [availableDateKeys],
  );
  const selectedSlotDateKey = selectedTimeOption ? getSlotDateKey(selectedTimeOption.startsAt) : "";
  const firstAvailableDateKey = availableDateKeys[0] ?? "";
  const effectiveSelectedDateKey = selectedSlotDateKey
    || (selectedDateKey && availableSlotsByDate.has(selectedDateKey) ? selectedDateKey : firstAvailableDateKey);
  const fallbackVisibleMonthKey = (effectiveSelectedDateKey || firstAvailableDateKey).slice(0, 7);
  const effectiveVisibleMonthKey =
    visibleMonthKey && availableMonths.includes(visibleMonthKey) ? visibleMonthKey : fallbackVisibleMonthKey;
  const selectedDateSlots = effectiveSelectedDateKey
    ? availableSlotsByDate.get(effectiveSelectedDateKey) ?? EMPTY_TIME_SLOTS
    : EMPTY_TIME_SLOTS;
  const selectedDateSlotGroups = useMemo(
    () => groupSlotsByDayPeriod(selectedDateSlots),
    [selectedDateSlots],
  );

  const calendarCells = useMemo(() => {
    if (!effectiveVisibleMonthKey) {
      return [];
    }

    const [yearLabel, monthLabel] = effectiveVisibleMonthKey.split("-");
    const year = Number(yearLabel);
    const month = Number(monthLabel);

    if (!year || !month) {
      return [];
    }

    const daysInMonth = new Date(year, month, 0).getDate();
    const firstWeekday = new Date(year, month - 1, 1).getDay();
    const leadingPlaceholders = (firstWeekday + 6) % 7;
    const cells: Array<string | null> = Array.from({ length: leadingPlaceholders }, () => null);

    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(`${yearLabel}-${monthLabel}-${day.toString().padStart(2, "0")}`);
    }

    const trailingPlaceholders = (7 - (cells.length % 7)) % 7;

    for (let index = 0; index < trailingPlaceholders; index += 1) {
      cells.push(null);
    }

    return cells;
  }, [effectiveVisibleMonthKey]);

  const canGoToStep2 = Boolean(selectedService);
  const canGoToStep3 = canGoToStep2 && Boolean(selectedTimeOption && !selectedTimeOption.isDisabled);
  const canGoToStep4 = canGoToStep3 && fullName.trim() && email.trim();

  if (serverState.status === "success" && serverState.confirmation) {
    return (
      <section className="rounded-[var(--radius-panel)] border border-[var(--color-accent-soft)]/50 bg-white p-8 shadow-[var(--shadow-panel)]">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">
          Rezervace přijata
        </p>
        <h3 className="mt-5 font-display text-4xl text-[var(--color-foreground)]">
          Děkujeme, {serverState.confirmation.clientName}.
        </h3>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--color-muted)]">
          Rezervaci jsme přijali ke schválení. Jakmile ji potvrdíme, pošleme vám e-mail.
        </p>
        <dl className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-black/6 bg-[var(--color-surface)]/45 p-5">
            <dt className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">
              Referenční kód
            </dt>
            <dd className="mt-2 text-lg font-semibold text-[var(--color-foreground)]">
              {serverState.confirmation.referenceCode}
            </dd>
          </div>
          <div className="rounded-3xl border border-black/6 bg-[var(--color-surface)]/45 p-5">
            <dt className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">Služba</dt>
            <dd className="mt-2 text-lg font-semibold text-[var(--color-foreground)]">
              {serverState.confirmation.serviceName}
            </dd>
          </div>
          <div className="rounded-3xl border border-black/6 bg-[var(--color-surface)]/45 p-5 sm:col-span-2">
            <dt className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">Termín</dt>
            <dd className="mt-2 text-lg font-semibold text-[var(--color-foreground)]">
              {serverState.confirmation.scheduledAtLabel}
            </dd>
          </div>
          <div className="rounded-3xl border border-black/6 bg-[var(--color-surface)]/45 p-5 sm:col-span-2">
            <dt className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">Kontakt</dt>
            <dd className="mt-2 text-lg font-semibold text-[var(--color-foreground)]">
              {serverState.confirmation.clientEmail}
            </dd>
          </div>
        </dl>
      </section>
    );
  }

  return (
    <form action={formAction} className="grid gap-5 sm:gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <input type="hidden" name="serviceId" value={selectedServiceId} />
      <input type="hidden" name="slotId" value={selectedTimeOption?.slotId ?? ""} />
      <input type="hidden" name="startsAt" value={selectedTimeOption?.startsAt ?? ""} />

      <div className="space-y-5 sm:space-y-6">
        <section className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-5 shadow-[var(--shadow-panel)] sm:p-7 lg:p-8">
          <div className="flex flex-wrap gap-3">
            {stepLabels.map((label, index) => {
              const stepNumber = index + 1;

              return (
                <div
                  key={label}
                  className={cn(
                    "inline-flex items-center gap-3 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em]",
                    stepNumber <= currentStep
                      ? "border-[var(--color-accent)] bg-[var(--color-surface-strong)]/50 text-[var(--color-foreground)]"
                      : "border-black/8 bg-[var(--color-surface)]/35 text-[var(--color-muted)]",
                  )}
                >
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-[10px]">
                    {stepNumber}
                  </span>
                  {label}
                </div>
              );
            })}
          </div>

          {serverState.formError ? (
            <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {serverState.formError}
            </div>
          ) : null}

          <div className="mt-6 space-y-7 sm:mt-8 sm:space-y-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">
                    Krok 1
                  </p>
                  <h3 className="mt-2 font-display text-3xl text-[var(--color-foreground)]">
                    Vyberte službu
                  </h3>
                </div>
              </div>

              <div className="grid gap-3">
                {catalog.services.map((service) => {
                  const isSelected = service.id === selectedServiceId;

                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => {
                        setSelectedServiceId(service.id);
                        setSelectedTimeOptionKey("");
                        setCurrentStep(2);
                        focusTermStepSection();
                      }}
                      className={cn(
                        "rounded-3xl border p-5 text-left transition-all duration-150",
                        isSelected
                          ? "border-[var(--color-accent)] bg-[var(--color-surface-strong)]/45 shadow-[0_6px_14px_rgba(0,0,0,0.06)]"
                          : "border-black/6 bg-[var(--color-surface)]/25 hover:bg-[var(--color-surface)]/45",
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] text-[var(--color-muted)]">
                            {service.categoryName}
                          </p>
                          <h4 className="mt-2 font-display text-2xl text-[var(--color-foreground)]">
                            {service.name}
                          </h4>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-[var(--color-foreground)]">
                            {service.durationMinutes} min
                          </p>
                          <p className="mt-1 text-sm text-[var(--color-muted)]">
                            {formatPrice(service.priceFromCzk)}
                          </p>
                        </div>
                      </div>
                      {service.shortDescription ? (
                        <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
                          {service.shortDescription}
                        </p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {serverState.fieldErrors?.serviceId ? (
                <p className="text-sm text-red-700">{serverState.fieldErrors.serviceId}</p>
              ) : null}
            </div>

            <div
              ref={termStepSectionRef}
              className={cn(
                "space-y-4 rounded-3xl transition-all duration-300",
                isTermStepHighlighted
                  ? "bg-[var(--color-surface-strong)]/30 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
                  : "",
              )}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">
                    Krok 2
                  </p>
                  <h3 className="mt-2 font-display text-3xl text-[var(--color-foreground)]">
                    Vyberte den a čas
                  </h3>
                </div>
                {canGoToStep3 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="rounded-full border border-black/8 px-4 py-2 text-sm font-semibold text-[var(--color-foreground)]"
                  >
                    Pokračovat
                  </button>
                ) : null}
              </div>

              {!selectedService ? (
                <div className="rounded-3xl border border-dashed border-black/10 bg-[var(--color-surface)]/20 px-5 py-6 text-sm text-[var(--color-muted)]">
                  Nejprve vyberte službu. Pak zobrazíme jen kompatibilní ručně publikované termíny.
                </div>
              ) : selectableTimeOptions.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-black/10 bg-[var(--color-surface)]/20 px-5 py-6 text-sm text-[var(--color-muted)]">
                  Pro tuto službu teď není publikovaný žádný volný termín s dostatečnou délkou.
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="rounded-3xl border border-black/6 bg-white p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--color-foreground)]">
                        {formatCalendarMonthLabel(effectiveVisibleMonthKey)}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const monthIndex = availableMonths.indexOf(effectiveVisibleMonthKey);
                            if (monthIndex > 0) {
                              const nextMonthKey = availableMonths[monthIndex - 1];
                              setVisibleMonthKey(nextMonthKey);
                              const firstDateInMonth = availableDateKeys.find((dateKey) =>
                                dateKey.startsWith(`${nextMonthKey}-`),
                              );
                              if (firstDateInMonth) {
                                setSelectedDateKey(firstDateInMonth);
                                setSelectedTimeOptionKey("");
                              }
                            }
                          }}
                          disabled={availableMonths.indexOf(effectiveVisibleMonthKey) <= 0}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/8 text-lg text-[var(--color-foreground)] disabled:opacity-40"
                          aria-label="Předchozí měsíc"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const monthIndex = availableMonths.indexOf(effectiveVisibleMonthKey);
                            if (monthIndex < availableMonths.length - 1) {
                              const nextMonthKey = availableMonths[monthIndex + 1];
                              setVisibleMonthKey(nextMonthKey);
                              const firstDateInMonth = availableDateKeys.find((dateKey) =>
                                dateKey.startsWith(`${nextMonthKey}-`),
                              );
                              if (firstDateInMonth) {
                                setSelectedDateKey(firstDateInMonth);
                                setSelectedTimeOptionKey("");
                              }
                            }
                          }}
                          disabled={availableMonths.indexOf(effectiveVisibleMonthKey) >= availableMonths.length - 1}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/8 text-lg text-[var(--color-foreground)] disabled:opacity-40"
                          aria-label="Další měsíc"
                        >
                          ›
                        </button>
                      </div>
                    </div>

                    <div
                      className="mt-4 grid gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]"
                      style={calendarGridColumnsStyle}
                    >
                      {["Po", "Út", "St", "Čt", "Pá", "So", "Ne"].map((dayLabel) => (
                        <span key={dayLabel}>{dayLabel}</span>
                      ))}
                    </div>

                    <div className="mt-3 grid gap-2" style={calendarGridColumnsStyle}>
                      {calendarCells.map((dateKey, index) => {
                        if (!dateKey) {
                          return <div key={`calendar-empty-${index}`} className="h-11 rounded-2xl bg-[var(--color-surface)]/20" />;
                        }

                        const dateSlots = availableSlotsByDate.get(dateKey) ?? [];
                        const hasSlots = dateSlots.length > 0;
                        const hasSelectableSlots = dateSlots.some((slot) => !slot.isDisabled);
                        const isSelectedDate = dateKey === effectiveSelectedDateKey;

                        return (
                          <button
                            key={dateKey}
                            type="button"
                            onClick={() => {
                              setSelectedDateKey(dateKey);
                              if (selectedSlotDateKey && selectedSlotDateKey !== dateKey) {
                                setSelectedTimeOptionKey("");
                              }
                            }}
                            disabled={!hasSlots}
                            className={cn(
                              "h-11 rounded-2xl border text-sm font-semibold",
                              hasSlots
                                ? "border-black/8 bg-white text-[var(--color-foreground)] hover:bg-[var(--color-surface)]/35"
                                : "border-transparent bg-[var(--color-surface)]/20 text-[var(--color-muted)]/50",
                              !hasSelectableSlots && hasSlots
                                ? "border-black/6 bg-[var(--color-surface)]/30 text-[var(--color-muted)]"
                                : "",
                              isSelectedDate && hasSlots
                                ? "border-[var(--color-accent)] bg-[var(--color-surface-strong)]/45"
                                : "",
                            )}
                            aria-label={`Vybrat den ${dateKey}`}
                          >
                            {getSlotDayNumber(dateKey)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {selectedDateSlots.length === 0 ? (
                      <div className="rounded-3xl border border-dashed border-black/10 bg-[var(--color-surface)]/20 px-5 py-6 text-sm text-[var(--color-muted)]">
                        Vyberte v kalendáři den se zvýrazněným termínem.
                      </div>
                    ) : null}
                    {selectedDateSlotGroups.map((group) => (
                      <TimeSlotGroup
                        key={group.key}
                        label={group.label}
                        slots={group.slots}
                        selectedKey={selectedTimeOptionKey}
                        formatTime={formatSlotTime}
                        onSelect={(slotOption) => {
                          if (slotOption.isDisabled) {
                            return;
                          }

                          setSelectedTimeOptionKey(slotOption.key);
                          setCurrentStep(3);
                          focusContactStepSection();
                        }}
                      />
                    ))}
                    {selectedDateSlots.length > 0 && selectedDateSlots.every((slot) => slot.isDisabled) ? (
                      <div className="rounded-3xl border border-dashed border-black/10 bg-[var(--color-surface)]/20 px-5 py-6 text-sm text-[var(--color-muted)]">
                        Pro vybraný den už nejsou volné žádné časy. Zkuste prosím jiný den.
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
              {serverState.fieldErrors?.slotId || serverState.fieldErrors?.startsAt ? (
                <p className="text-sm text-red-700">{serverState.fieldErrors.slotId ?? serverState.fieldErrors.startsAt}</p>
              ) : null}
            </div>

            <div
              ref={contactStepSectionRef}
              className={cn(
                "space-y-4 rounded-3xl transition-all duration-300",
                isContactStepHighlighted
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
                </div>
                {canGoToStep4 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(4)}
                    className="rounded-full border border-black/8 px-4 py-2 text-sm font-semibold text-[var(--color-foreground)]"
                  >
                    Zobrazit souhrn
                  </button>
                ) : null}
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
                    onChange={(event) => setFullName(event.target.value)}
                    aria-invalid={serverState.fieldErrors?.fullName ? true : undefined}
                    className="min-h-12 w-full rounded-2xl border border-black/8 bg-white px-4 py-3 outline-none focus:border-[var(--color-accent)]"
                    autoComplete="name"
                  />
                  {serverState.fieldErrors?.fullName ? (
                    <span className="text-sm text-red-700">{serverState.fieldErrors.fullName}</span>
                  ) : null}
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-[var(--color-foreground)]">E-mail</span>
                  <input
                    name="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    aria-invalid={serverState.fieldErrors?.email ? true : undefined}
                    className="min-h-12 w-full rounded-2xl border border-black/8 bg-white px-4 py-3 outline-none focus:border-[var(--color-accent)]"
                    autoComplete="email"
                  />
                  {serverState.fieldErrors?.email ? (
                    <span className="text-sm text-red-700">{serverState.fieldErrors.email}</span>
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
                    onChange={(event) => setPhone(event.target.value)}
                    aria-invalid={serverState.fieldErrors?.phone ? true : undefined}
                    className="min-h-12 w-full rounded-2xl border border-black/8 bg-white px-4 py-3 outline-none focus:border-[var(--color-accent)]"
                    autoComplete="tel"
                  />
                  {serverState.fieldErrors?.phone ? (
                    <span className="text-sm text-red-700">{serverState.fieldErrors.phone}</span>
                  ) : null}
                </label>

                <label className="space-y-2 sm:col-span-2">
                  <span className="text-sm font-semibold text-[var(--color-foreground)]">
                    Poznámka k rezervaci
                  </span>
                  <textarea
                    name="clientNote"
                    value={clientNote}
                    onChange={(event) => setClientNote(event.target.value)}
                    rows={4}
                    aria-invalid={serverState.fieldErrors?.clientNote ? true : undefined}
                    className="w-full rounded-2xl border border-black/8 bg-white px-4 py-3 outline-none focus:border-[var(--color-accent)]"
                  />
                  {serverState.fieldErrors?.clientNote ? (
                    <span className="text-sm text-red-700">{serverState.fieldErrors.clientNote}</span>
                  ) : null}
                </label>
              </div>
            </div>
          </div>
        </section>
      </div>

      <aside className="lg:sticky lg:top-28 lg:self-start">
        <section className="rounded-[var(--radius-panel)] border border-[var(--color-accent-soft)]/45 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(231,213,195,0.52))] p-6 shadow-[var(--shadow-panel)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">
            Krok 4
          </p>
          <h3 className="mt-3 font-display text-3xl text-[var(--color-foreground)]">
            Souhrn a potvrzení
          </h3>
          <div className="mt-6 space-y-4">
            <div
              className={cn(
                "rounded-3xl border border-black/6 bg-white/80 p-5 transition-all duration-150 ease-out",
                selectedTimeOption ? "border-[var(--color-accent)]/30 shadow-[0_6px_16px_rgba(0,0,0,0.06)]" : "",
              )}
            >
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

            <div className="rounded-3xl border border-black/6 bg-white/80 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Termín</p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-foreground)]">
                {selectedTimeOption
                  ? `${formatSlotDate(selectedTimeOption.startsAt)} • ${formatSlotTime(selectedTimeOption.startsAt)}`
                  : "Zatím nevybráno"}
              </p>
              {selectedTimeOption ? (
                <div className="mt-3 space-y-1 text-sm text-[var(--color-muted)]">
                  <p>Konec v {formatSlotTime(selectedTimeOption.endsAt)}</p>
                  <p>Délka {formatSlotDuration(selectedTimeOption.startsAt, selectedTimeOption.endsAt)}</p>
                  {selectedTimeOption.publicNote ? <p>{selectedTimeOption.publicNote}</p> : null}
                </div>
              ) : null}
            </div>

            <div className="rounded-3xl border border-black/6 bg-white/80 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Kontakt</p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-foreground)]">
                {fullName.trim() || "Doplňte kontaktní údaje"}
              </p>
              {email.trim() ? <p className="mt-1 text-sm text-[var(--color-muted)]">{email.trim()}</p> : null}
              {phone.trim() ? <p className="mt-1 text-sm text-[var(--color-muted)]">{phone.trim()}</p> : null}
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-black/6 bg-white/80 p-5 text-sm leading-6 text-[var(--color-muted)]">
            Odesláním formuláře vytvoříme rezervaci ke schválení, navážeme klienta, uzamkneme slot
            a pošleme vám e-mail s přehledem i storno odkazem.
          </div>

          {serverState.status === "error" && serverState.suggestedStep ? (
            <p className="mt-4 text-sm text-[var(--color-muted)]">
              Doporučený návrat ke kroku {serverState.suggestedStep}, kde je potřeba výběr nebo údaje
              upravit.
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <BookingSubmitButton disabled={!canGoToStep4} />
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(Math.max(currentStep - 1, 1))}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-black/8 px-5 py-3 text-sm font-semibold text-[var(--color-foreground)]"
              >
                Zpět
              </button>
            ) : null}
          </div>

          {!canGoToStep4 ? (
            <p className="mt-4 text-sm text-[var(--color-muted)]">
              Pro odeslání dokončete výběr služby, termínu a kontaktních údajů.
            </p>
          ) : null}
        </section>
      </aside>
    </form>
  );
}
