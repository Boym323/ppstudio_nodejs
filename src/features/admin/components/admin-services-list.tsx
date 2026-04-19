import Link from "next/link";

import { cn } from "@/lib/utils";
import { formatServicePrice } from "@/features/admin/lib/admin-service-format";

type AdminServicesListProps = {
  currentPath: string;
  currentServiceId?: string;
  queryString: string;
  services: Array<{
    id: string;
    name: string;
    durationMinutes: number;
    priceFromCzk: number | null;
    sortOrder: number;
    isActive: boolean;
    isPubliclyBookable: boolean;
    category: {
      name: string;
      isActive: boolean;
    };
    _count: {
      bookings: number;
      allowedAvailabilitySlots: number;
    };
  }>;
};

export function AdminServicesList({
  currentPath,
  currentServiceId,
  queryString,
  services,
}: AdminServicesListProps) {
  if (services.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-white/14 bg-white/4 p-5">
        <p className="text-base font-medium text-white">Filtru zatím nic neodpovídá.</p>
        <p className="mt-2 text-sm leading-6 text-white/62">
          Zkuste upravit hledání nebo přepnout stav služby či veřejnou rezervovatelnost.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {services.map((service) => {
        const href = `${currentPath}?${queryString}${queryString ? "&" : ""}serviceId=${service.id}`;
        const isSelected = currentServiceId === service.id;

        return (
          <Link
            key={service.id}
            href={href}
            className={cn(
              "block rounded-[1.4rem] border p-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/60",
              isSelected
                ? "border-[var(--color-accent)]/50 bg-[rgba(190,160,120,0.12)]"
                : "border-white/8 bg-white/5 hover:border-white/16 hover:bg-white/7",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-accent-soft)]">
                  {service.category.name}
                  {!service.category.isActive ? " • kategorie skrytá" : ""}
                </p>
                <h3 className="mt-2 text-base font-medium text-white sm:text-lg">{service.name}</h3>
              </div>
              <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.16em]">
                <StatusBadge active={service.isActive} activeLabel="Aktivní" inactiveLabel="Neaktivní" />
                <StatusBadge
                  active={service.isPubliclyBookable}
                  activeLabel="Rezervovatelná"
                  inactiveLabel="Jen interní"
                />
              </div>
            </div>

            <div className="mt-4 grid gap-3 text-sm text-white/68 sm:grid-cols-2">
              <p>{service.durationMinutes} min • {formatServicePrice(service.priceFromCzk)}</p>
              <p>Pořadí {service.sortOrder} • rezervace {service._count.bookings}</p>
            </div>

            <p className="mt-3 text-sm leading-6 text-white/56">
              Omezení slotů: {service._count.allowedAvailabilitySlots}
            </p>
          </Link>
        );
      })}
    </div>
  );
}

type StatusBadgeProps = {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
};

function StatusBadge({ active, activeLabel, inactiveLabel }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "rounded-full border px-3 py-1",
        active
          ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
          : "border-white/10 bg-black/10 text-white/58",
      )}
    >
      {active ? activeLabel : inactiveLabel}
    </span>
  );
}
