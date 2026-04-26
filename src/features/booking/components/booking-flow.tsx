"use client";

import { AvailabilitySlotServiceRestrictionMode } from "@prisma/client";
import { useActionState, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";

import { SectionHeading } from "@/components/ui/section-heading";
import { createPublicBookingAction } from "@/features/booking/actions/create-public-booking";
import { initialPublicBookingActionState } from "@/features/booking/actions/public-booking-action-state";
import { trackMatomoEvent } from "@/features/analytics/matomo";
import {
  buildSlotTimeOptions,
  groupSlotsByDayPeriod,
  type TimeSlotOption,
} from "@/features/booking/lib/booking-time-slots";

import { BookingConfirmationPanel } from "./booking-confirmation-panel";
import { StickyCTA } from "./sticky-cta";
import { BookingContactStep } from "./booking-flow/contact-step";
import {
  buildContactFieldErrors,
  EMPTY_TIME_SLOTS,
  getCategoryKey,
  getSlotDateKey,
  getSlotDurationMinutes,
  formatSlotDate,
  formatSlotTime,
  stepLabels,
} from "./booking-flow/helpers";
import { BookingProgressPanel } from "./booking-flow/progress-panel";
import { BookingServiceStep } from "./booking-flow/service-step";
import { BookingSummarySidebar } from "./booking-flow/summary-sidebar";
import { BookingTermStep } from "./booking-flow/term-step";
import type { BookingFlowProps, ContactFieldKey, ServiceCategory } from "./booking-flow/types";

export function BookingFlow({ catalog, initialSelectedServiceSlug, salonProfile }: BookingFlowProps) {
  const [serverState, formAction] = useActionState(
    createPublicBookingAction,
    initialPublicBookingActionState,
  );
  const initialSelectedService = initialSelectedServiceSlug
    ? catalog.services.find((service) => service.slug === initialSelectedServiceSlug)
    : undefined;
  const initialCategoryKey = getCategoryKey(
    initialSelectedService?.categoryName ?? catalog.services[0]?.categoryName ?? "",
  );
  const [selectedCategoryKey, setSelectedCategoryKey] = useState(initialCategoryKey);
  const [selectedServiceId, setSelectedServiceId] = useState(initialSelectedService?.id ?? "");
  const [selectedTimeOptionKey, setSelectedTimeOptionKey] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [clientNote, setClientNote] = useState("");
  const [currentStep, setCurrentStep] = useState(initialSelectedService ? 2 : 1);
  const [selectedDateKey, setSelectedDateKey] = useState("");
  const [visibleMonthKey, setVisibleMonthKey] = useState("");
  const [isServiceStepHighlighted, setIsServiceStepHighlighted] = useState(false);
  const [isTermStepHighlighted, setIsTermStepHighlighted] = useState(false);
  const [isContactStepHighlighted, setIsContactStepHighlighted] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Record<ContactFieldKey, boolean>>({
    fullName: false,
    email: false,
    phone: false,
  });
  const serviceStepSectionRef = useRef<HTMLDivElement | null>(null);
  const serviceStepHighlightTimeoutRef = useRef<number | null>(null);
  const termStepSectionRef = useRef<HTMLDivElement | null>(null);
  const termStepHighlightTimeoutRef = useRef<number | null>(null);
  const contactStepSectionRef = useRef<HTMLDivElement | null>(null);
  const firstContactInputRef = useRef<HTMLInputElement | null>(null);
  const contactStepHighlightTimeoutRef = useRef<number | null>(null);
  const contactStepFocusTimeoutRef = useRef<number | null>(null);
  const createdBookingTrackedRef = useRef(false);
  const contactStartedTrackedRef = useRef(false);

  const focusSection = (
    sectionElement: HTMLDivElement | null,
    setHighlighted: (value: boolean) => void,
    timeoutRef: MutableRefObject<number | null>,
    durationMs: number,
  ) => {
    if (!sectionElement) {
      return;
    }

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }

    setHighlighted(true);
    timeoutRef.current = window.setTimeout(() => {
      setHighlighted(false);
      timeoutRef.current = null;
    }, durationMs);

    window.requestAnimationFrame(() => {
      const rect = sectionElement.getBoundingClientRect();
      const topSafeArea = 120;
      const bottomSafeArea = 64;
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

  const focusServiceStepSection = () => {
    focusSection(
      serviceStepSectionRef.current,
      setIsServiceStepHighlighted,
      serviceStepHighlightTimeoutRef,
      750,
    );
  };

  const focusTermStepSection = () => {
    focusSection(
      termStepSectionRef.current,
      setIsTermStepHighlighted,
      termStepHighlightTimeoutRef,
      750,
    );
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
    const serviceStepHighlightTimeout = serviceStepHighlightTimeoutRef.current;
    const termStepHighlightTimeout = termStepHighlightTimeoutRef.current;
    const contactStepHighlightTimeout = contactStepHighlightTimeoutRef.current;
    const contactStepFocusTimeout = contactStepFocusTimeoutRef.current;

    return () => {
      if (serviceStepHighlightTimeout !== null) {
        window.clearTimeout(serviceStepHighlightTimeout);
      }
      if (termStepHighlightTimeout !== null) {
        window.clearTimeout(termStepHighlightTimeout);
      }
      if (contactStepHighlightTimeout !== null) {
        window.clearTimeout(contactStepHighlightTimeout);
      }
      if (contactStepFocusTimeout !== null) {
        window.clearTimeout(contactStepFocusTimeout);
      }
    };
  }, []);

  useEffect(() => {
    if (!initialSelectedServiceSlug) {
      return;
    }

    const sectionElement = termStepSectionRef.current;

    if (!sectionElement) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      setCurrentStep(2);
      const rect = sectionElement.getBoundingClientRect();
      const topSafeArea = 120;
      const bottomSafeArea = 64;
      const isComfortablyVisible =
        rect.top >= topSafeArea && rect.bottom <= window.innerHeight - bottomSafeArea;

      if (isComfortablyVisible) {
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
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [initialSelectedServiceSlug]);

  const servicesById = useMemo(
    () => new Map(catalog.services.map((service) => [service.id, service])),
    [catalog.services],
  );

  const serviceCategories = useMemo(() => {
    const grouped = new Map<string, ServiceCategory>();

    for (const service of catalog.services) {
      const key = getCategoryKey(service.categoryName);
      const existing = grouped.get(key);

      if (existing) {
        existing.serviceCount += 1;
      } else {
        grouped.set(key, {
          key,
          label: service.categoryName,
          serviceCount: 1,
        });
      }
    }

    return [...grouped.values()];
  }, [catalog.services]);

  const effectiveCategoryKey =
    selectedCategoryKey && serviceCategories.some((category) => category.key === selectedCategoryKey)
      ? selectedCategoryKey
      : serviceCategories[0]?.key ?? "";

  const visibleServices = useMemo(
    () => catalog.services.filter((service) => getCategoryKey(service.categoryName) === effectiveCategoryKey),
    [catalog.services, effectiveCategoryKey],
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

  const suggestedSlots = useMemo(
    () => selectableTimeOptions.slice(0, 6),
    [selectableTimeOptions],
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
    () => Array.from(new Set(availableDateKeys.map((dateKey) => dateKey.slice(0, 7)))).sort((monthA, monthB) => monthA.localeCompare(monthB)),
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

  const contactValues = {
    fullName,
    email,
    phone,
  } satisfies Record<ContactFieldKey, string>;
  const clientFieldErrors = buildContactFieldErrors(contactValues);
  const hasClientContactErrors = Object.values(clientFieldErrors).some(Boolean);
  const canGoToStep2 = Boolean(selectedService);
  const canGoToStep3 = canGoToStep2 && Boolean(selectedTimeOption && !selectedTimeOption.isDisabled);
  const canGoToStep4 = canGoToStep3 && !hasClientContactErrors && Boolean(fullName.trim() && email.trim());

  const getDisplayedFieldError = (field: ContactFieldKey) => {
    if (touchedFields[field] && clientFieldErrors[field]) {
      return clientFieldErrors[field];
    }

    return serverState.fieldErrors?.[field];
  };

  const resetServiceDependentSelection = () => {
    setSelectedTimeOptionKey("");
    setSelectedDateKey("");
    setVisibleMonthKey("");
    contactStartedTrackedRef.current = false;
  };

  const getSelectedServiceEventName = () => {
    if (!selectedService) {
      return undefined;
    }

    return `${selectedService.categoryName} / ${selectedService.name}`;
  };

  const trackContactStarted = () => {
    if (contactStartedTrackedRef.current) {
      return;
    }

    const eventName = getSelectedServiceEventName();

    if (!eventName) {
      return;
    }

    contactStartedTrackedRef.current = true;
    trackMatomoEvent("Booking", "Contact started", eventName);
  };

  const selectSlot = (slotOption: TimeSlotOption) => {
    if (slotOption.isDisabled) {
      return;
    }

    const dateKey = getSlotDateKey(slotOption.startsAt);
    const durationMinutes = selectedService?.durationMinutes;

    setSelectedDateKey(dateKey);
    setSelectedTimeOptionKey(slotOption.key);
    setCurrentStep(3);
    trackMatomoEvent("Booking", "Date selected", dateKey);
    trackMatomoEvent(
      "Booking",
      "Time selected",
      `${formatSlotTime(slotOption.startsAt)} / ${formatSlotTime(slotOption.endsAt)}`,
      durationMinutes,
    );
    trackContactStarted();
    focusContactStepSection();
  };

  const goToSummary = () => {
    setTouchedFields({
      fullName: true,
      email: true,
      phone: true,
    });

    if (!canGoToStep4) {
      focusContactStepSection();
      return;
    }

    setCurrentStep(4);
  };

  useEffect(() => {
    if (serverState.status !== "success" || !serverState.confirmation || createdBookingTrackedRef.current) {
      return;
    }

    createdBookingTrackedRef.current = true;
    trackMatomoEvent(
      "Booking",
      "Created",
      selectedService?.name ?? serverState.confirmation.serviceName,
      selectedService?.priceFromCzk ?? undefined,
    );
  }, [selectedService?.name, selectedService?.priceFromCzk, serverState.confirmation, serverState.status]);

  const updateVisibleMonth = (nextMonthKey: string) => {
    setVisibleMonthKey(nextMonthKey);
    const firstDateInMonth = availableDateKeys.find((dateKey) =>
      dateKey.startsWith(`${nextMonthKey}-`),
    );
    if (firstDateInMonth) {
      setSelectedDateKey(firstDateInMonth);
      setSelectedTimeOptionKey("");
    }
  };

  if (serverState.status === "success" && serverState.confirmation) {
    return (
      <BookingConfirmationPanel
        confirmation={serverState.confirmation}
        salonContact={{
          name: salonProfile.name,
          email: salonProfile.email,
          phone: salonProfile.phone,
        }}
      />
    );
  }

  return (
    <>
      <SectionHeading
        eyebrow="Rezervace"
        title="Vyberte si termín, který vám nejlépe vyhovuje."
        description="Rezervace zabere jen chvilku. Nejdřív zvolíte službu, potom nejbližší termín a nakonec doplníte kontakt."
      />

      <form action={formAction} className="grid gap-5 pb-28 sm:gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:pb-0">
      <input type="hidden" name="serviceId" value={selectedServiceId} />
      <input type="hidden" name="slotId" value={selectedTimeOption?.slotId ?? ""} />
      <input type="hidden" name="startsAt" value={selectedTimeOption?.startsAt ?? ""} />

      <div className="space-y-5 sm:space-y-6">
        <section className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-5 shadow-[var(--shadow-panel)] sm:p-7 lg:p-8">
          <BookingProgressPanel
            currentStep={currentStep}
            formError={serverState.formError}
            stepLabels={stepLabels}
          />

          <div className="mt-6 space-y-7 sm:mt-8 sm:space-y-8">
            <BookingServiceStep
              sectionRef={serviceStepSectionRef}
              highlighted={isServiceStepHighlighted}
              categories={serviceCategories}
              effectiveCategoryKey={effectiveCategoryKey}
              visibleServices={visibleServices}
              selectedServiceId={selectedServiceId}
              serviceIdError={serverState.fieldErrors?.serviceId}
              onCategorySelect={(categoryKey) => {
                setSelectedCategoryKey(categoryKey);
                setSelectedServiceId("");
                resetServiceDependentSelection();
                setCurrentStep(1);
              }}
              onServiceSelect={(serviceId) => {
                const service = servicesById.get(serviceId);
                setSelectedServiceId(serviceId);
                resetServiceDependentSelection();
                setCurrentStep(2);
                trackMatomoEvent(
                  "Booking",
                  "Service selected",
                  service ? `${service.categoryName} / ${service.name}` : undefined,
                  service?.priceFromCzk ?? undefined,
                );
                focusTermStepSection();
              }}
            />

            <BookingTermStep
              sectionRef={termStepSectionRef}
              highlighted={isTermStepHighlighted}
              selectedService={selectedService}
              selectableTimeOptions={selectableTimeOptions}
              suggestedSlots={suggestedSlots}
              selectedTimeOptionKey={selectedTimeOptionKey}
              availableMonths={availableMonths}
              effectiveVisibleMonthKey={effectiveVisibleMonthKey}
              calendarCells={calendarCells}
              availableSlotsByDate={availableSlotsByDate}
              effectiveSelectedDateKey={effectiveSelectedDateKey}
              selectedDateSlots={selectedDateSlots}
              selectedDateSlotGroups={selectedDateSlotGroups}
              canGoToStep3={canGoToStep3}
              slotError={serverState.fieldErrors?.slotId ?? serverState.fieldErrors?.startsAt}
              onContinue={() => {
                setCurrentStep(3);
                trackContactStarted();
                focusContactStepSection();
              }}
              onSlotSelect={selectSlot}
              onSelectDate={(dateKey) => {
                setSelectedDateKey(dateKey);
                trackMatomoEvent("Booking", "Date selected", dateKey);
                if (selectedSlotDateKey && selectedSlotDateKey !== dateKey) {
                  setSelectedTimeOptionKey("");
                }
              }}
              onPreviousMonth={() => {
                const monthIndex = availableMonths.indexOf(effectiveVisibleMonthKey);
                if (monthIndex > 0) {
                  updateVisibleMonth(availableMonths[monthIndex - 1] ?? "");
                }
              }}
              onNextMonth={() => {
                const monthIndex = availableMonths.indexOf(effectiveVisibleMonthKey);
                if (monthIndex < availableMonths.length - 1) {
                  updateVisibleMonth(availableMonths[monthIndex + 1] ?? "");
                }
              }}
            />

            <BookingContactStep
              sectionRef={contactStepSectionRef}
              firstContactInputRef={firstContactInputRef}
              highlighted={isContactStepHighlighted}
              fullName={fullName}
              email={email}
              phone={phone}
              clientNote={clientNote}
              clientNoteError={serverState.fieldErrors?.clientNote}
              getDisplayedFieldError={getDisplayedFieldError}
              onShowSummary={goToSummary}
              onFullNameChange={setFullName}
              onEmailChange={setEmail}
              onPhoneChange={setPhone}
              onClientNoteChange={setClientNote}
              onFieldBlur={(field) => {
                setTouchedFields((current) => ({ ...current, [field]: true }));
              }}
            />
          </div>
        </section>
      </div>

      <BookingSummarySidebar
        currentStep={currentStep}
        selectedService={selectedService}
        selectedTimeOption={selectedTimeOption}
        fullName={fullName}
        email={email}
        phone={phone}
        canGoToStep4={canGoToStep4}
        serverState={serverState}
        onEditService={() => {
          setCurrentStep(1);
          focusServiceStepSection();
        }}
        onEditTerm={() => {
          setCurrentStep(2);
          focusTermStepSection();
        }}
        onEditContact={() => {
          setCurrentStep(3);
          focusContactStepSection();
        }}
        onStepBack={() => setCurrentStep(Math.max(currentStep - 1, 1))}
      />

      {!selectedService ? null : !selectedTimeOption ? (
        <StickyCTA
          label="Vybrat termín"
          note={`${selectedService.name} • ${selectedService.durationMinutes} min`}
          onClick={() => {
            setCurrentStep(2);
            focusTermStepSection();
          }}
        />
      ) : !canGoToStep4 ? (
        <StickyCTA
          label="Doplnit kontakt"
          note={`${formatSlotDate(selectedTimeOption.startsAt)} • ${formatSlotTime(selectedTimeOption.startsAt)}`}
          onClick={() => {
            setCurrentStep(3);
            trackContactStarted();
            focusContactStepSection();
          }}
        />
      ) : (
        <StickyCTA
          type="submit"
          label="Odeslat rezervaci"
          note={`${formatSlotDate(selectedTimeOption.startsAt)} • ${formatSlotTime(selectedTimeOption.startsAt)}`}
          disabled={!canGoToStep4}
        />
      )}
      </form>
    </>
  );
}
