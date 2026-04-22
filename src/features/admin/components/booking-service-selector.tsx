"use client";

import { cn } from "@/lib/utils";

type ServiceOption = {
  id: string;
  categoryName: string;
  name: string;
  durationMinutes: number;
  priceFromCzk: number | null;
};

type BookingServiceSelectorProps = {
  services: ServiceOption[];
  serviceId: string;
  onServiceIdChange: (value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  error?: string;
};

function formatPrice(priceFromCzk: number | null) {
  if (!priceFromCzk) {
    return "Cena na dotaz";
  }

  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(priceFromCzk);
}

export function BookingServiceSelector({
  services,
  serviceId,
  onServiceIdChange,
  search,
  onSearchChange,
  error,
}: BookingServiceSelectorProps) {
  const normalizedQuery = search.trim().toLocaleLowerCase("cs-CZ");
  const filteredServices = normalizedQuery.length === 0
    ? services
    : services.filter((service) =>
        `${service.categoryName} ${service.name}`.toLocaleLowerCase("cs-CZ").includes(normalizedQuery),
      );
  const selectedService = services.find((service) => service.id === serviceId) ?? null;
  const groupedServices = filteredServices.reduce<Map<string, ServiceOption[]>>((accumulator, service) => {
    const current = accumulator.get(service.categoryName) ?? [];
    current.push(service);
    accumulator.set(service.categoryName, current);
    return accumulator;
  }, new Map());

  return (
    <section className="rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-soft)]">
        B. Služba
      </p>
      <h3 className="mt-2 text-lg font-semibold text-white">Vybrat existující službu</h3>
      <p className="mt-1 text-sm leading-6 text-white/62">
        Výběr bere stejné délky a ceny jako veřejný booking flow. Po výběru hned vidíte, s jak dlouhým termínem pracujeme.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <label className="block">
          <span className="text-sm font-medium text-white">Filtrovat služby</span>
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Např. kosmetika, laminace nebo konkrétní název"
            className="mt-2 w-full rounded-[1rem] border border-white/8 bg-black/20 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[var(--color-accent)]/55"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-white">Služba</span>
          <select
            value={serviceId}
            onChange={(event) => onServiceIdChange(event.target.value)}
            className={cn(
              "mt-2 w-full rounded-[1rem] border border-white/8 bg-black/20 px-3.5 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/55",
              error ? "border-red-300/40" : "",
            )}
          >
            <option value="">Vyberte službu</option>
            {Array.from(groupedServices.entries()).map(([categoryName, group]) => (
              <optgroup key={categoryName} label={categoryName}>
                {group.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
        </label>
      </div>

      {selectedService ? (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <SummaryCard label="Kategorie" value={selectedService.categoryName} />
          <SummaryCard label="Délka" value={`${selectedService.durationMinutes} min`} />
          <SummaryCard label="Cena" value={formatPrice(selectedService.priceFromCzk)} />
        </div>
      ) : null}
    </section>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1rem] border border-white/8 bg-black/14 px-3.5 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">{label}</p>
      <p className="mt-2 text-sm font-medium text-white">{value}</p>
    </div>
  );
}
