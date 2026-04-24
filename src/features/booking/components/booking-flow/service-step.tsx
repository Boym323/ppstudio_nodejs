import type { RefObject } from "react";

import type { PublicBookingCatalog } from "@/features/booking/lib/booking-public";
import { cn } from "@/lib/utils";

import { CategorySelect } from "../category-select";
import { formatPrice, getCategoryKey } from "./helpers";
import type { ServiceCategory } from "./types";

type BookingServiceStepProps = {
  sectionRef: RefObject<HTMLDivElement | null>;
  highlighted: boolean;
  categories: ServiceCategory[];
  effectiveCategoryKey: string;
  visibleServices: PublicBookingCatalog["services"];
  selectedServiceId: string;
  serviceIdError?: string;
  onCategorySelect: (categoryKey: string) => void;
  onServiceSelect: (serviceId: string) => void;
};

export function BookingServiceStep({
  sectionRef,
  highlighted,
  categories,
  effectiveCategoryKey,
  visibleServices,
  selectedServiceId,
  serviceIdError,
  onCategorySelect,
  onServiceSelect,
}: BookingServiceStepProps) {
  return (
    <div
      ref={sectionRef}
      className={cn(
        "space-y-5 rounded-3xl transition-all duration-300",
        highlighted
          ? "bg-[var(--color-surface-strong)]/20 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
          : "",
      )}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">
          Krok 1
        </p>
        <h3 className="mt-2 font-display text-3xl text-[var(--color-foreground)]">
          Vyberte službu
        </h3>
        <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
          Nejdřív zvolte kategorii. Potom vám ukážeme jen konkrétní služby z ní.
        </p>
      </div>

      <CategorySelect
        categories={categories}
        selectedKey={effectiveCategoryKey}
        onSelect={onCategorySelect}
      />

      <div className="grid gap-3">
        {visibleServices.map((service) => {
          const isSelected = service.id === selectedServiceId;

          return (
            <button
              key={service.id}
              type="button"
              onClick={() => {
                onCategorySelect(getCategoryKey(service.categoryName));
                onServiceSelect(service.id);
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

      {serviceIdError ? (
        <p className="text-sm text-red-700">{serviceIdError}</p>
      ) : null}
    </div>
  );
}
