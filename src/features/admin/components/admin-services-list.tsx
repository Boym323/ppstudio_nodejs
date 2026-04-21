import Link from "next/link";

import { type AdminArea } from "@/config/navigation";
import {
  duplicateServiceAction,
  moveServiceAction,
  toggleServiceActiveAction,
  toggleServiceBookableAction,
} from "@/features/admin/actions/service-actions";
import { AdminStatePill } from "@/features/admin/components/admin-state-pill";
import { formatServicePrice } from "@/features/admin/lib/admin-service-format";
import { cn } from "@/lib/utils";

type AdminServicesListProps = {
  area: AdminArea;
  currentPath: string;
  currentServiceId?: string;
  queryString: string;
  returnTo: string;
  services: Array<{
    id: string;
    name: string;
    durationMinutes: number;
    priceFromCzk: number | null;
    sortOrder: number;
    isActive: boolean;
    isPubliclyBookable: boolean;
    isEffectivelyVisible: boolean;
    operationalContext: string;
    warnings: string[];
    category: {
      id: string;
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
  area,
  currentPath,
  currentServiceId,
  queryString,
  returnTo,
  services,
}: AdminServicesListProps) {
  if (services.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-white/14 bg-white/4 p-5">
        <p className="text-base font-medium text-white">Filtru zatím nic neodpovídá.</p>
        <p className="mt-2 text-sm leading-6 text-white/62">
          Zkuste upravit hledání, kategorii nebo přepnout stav služby a veřejnou rezervovatelnost.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {services.map((service) => {
        const detailHref = `${currentPath}?${queryString}${queryString ? "&" : ""}serviceId=${service.id}`;
        const mobileDetailHref = `${detailHref}&mobileDetail=1`;
        const isSelected = currentServiceId === service.id;

        return (
          <article
            key={service.id}
            className={cn(
              "rounded-[1.4rem] border p-4 transition",
              isSelected
                ? "border-[var(--color-accent)]/50 bg-[rgba(190,160,120,0.12)]"
                : "border-white/8 bg-white/5",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-accent-soft)]">
                  {service.category.name}
                  {!service.category.isActive ? " • kategorie je vypnutá" : ""}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <h3 className="text-base font-medium text-white sm:text-lg">{service.name}</h3>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-white/70">
                    #{service.sortOrder}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={detailHref}
                  className="hidden rounded-full border border-white/10 px-4 py-2 text-sm text-white/78 transition hover:border-white/18 hover:bg-white/6 xl:inline-flex"
                >
                  Otevřít detail
                </Link>
                <Link
                  href={mobileDetailHref}
                  className="inline-flex rounded-full border border-white/10 px-4 py-2 text-sm text-white/78 transition hover:border-white/18 hover:bg-white/6 xl:hidden"
                >
                  Detail
                </Link>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <AdminStatePill tone={service.isActive ? "active" : "muted"}>
                {service.isActive ? "Aktivní" : "Neaktivní"}
              </AdminStatePill>
              <AdminStatePill tone={service.isPubliclyBookable ? "active" : "muted"}>
                {service.isPubliclyBookable ? "Veřejná rezervace" : "Jen interní"}
              </AdminStatePill>
              <AdminStatePill tone={service.isEffectivelyVisible ? "accent" : "muted"}>
                {service.isEffectivelyVisible ? "Opravdu viditelná" : "Fakticky skrytá"}
              </AdminStatePill>
              {service.warnings.length > 0 ? (
                <AdminStatePill tone="accent">
                  {service.warnings.length === 1 ? "1 upozornění" : `${service.warnings.length} upozornění`}
                </AdminStatePill>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 text-sm text-white/68 sm:grid-cols-2 xl:grid-cols-4">
              <p><span className="text-white">Cena:</span> {formatServicePrice(service.priceFromCzk)}</p>
              <p><span className="text-white">Délka:</span> {service.durationMinutes} min</p>
              <p><span className="text-white">Rezervace:</span> {service._count.bookings}</p>
              <p><span className="text-white">Slotová omezení:</span> {service._count.allowedAvailabilitySlots}</p>
            </div>

            <p className="mt-3 text-sm leading-6 text-white/62">{service.operationalContext}</p>

            {service.warnings.length > 0 ? (
              <div className="mt-3 rounded-[1.15rem] border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-50">
                {service.warnings[0]}
                {service.warnings.length > 1 ? ` Další: ${service.warnings.length - 1}.` : ""}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <QuickActionForm action={toggleServiceActiveAction} area={area} serviceId={service.id} returnTo={returnTo}>
                <button
                  type="submit"
                  className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/78 transition hover:border-white/18 hover:bg-white/6"
                >
                  {service.isActive ? "Deaktivovat" : "Aktivovat"}
                </button>
              </QuickActionForm>

              <QuickActionForm action={toggleServiceBookableAction} area={area} serviceId={service.id} returnTo={returnTo}>
                <button
                  type="submit"
                  className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/78 transition hover:border-white/18 hover:bg-white/6"
                >
                  {service.isPubliclyBookable ? "Přepnout na interní" : "Povolit veřejně"}
                </button>
              </QuickActionForm>

              <QuickActionForm action={duplicateServiceAction} area={area} serviceId={service.id} returnTo={returnTo}>
                <button
                  type="submit"
                  className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/78 transition hover:border-white/18 hover:bg-white/6"
                >
                  Duplikovat
                </button>
              </QuickActionForm>

              <MoveActionForm
                area={area}
                serviceId={service.id}
                categoryId={service.category.id}
                direction="up"
                returnTo={returnTo}
              />
              <MoveActionForm
                area={area}
                serviceId={service.id}
                categoryId={service.category.id}
                direction="down"
                returnTo={returnTo}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}

function QuickActionForm({
  action,
  area,
  serviceId,
  returnTo,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  area: AdminArea;
  serviceId: string;
  returnTo: string;
  children: React.ReactNode;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="area" value={area} />
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      {children}
    </form>
  );
}

function MoveActionForm({
  area,
  serviceId,
  categoryId,
  direction,
  returnTo,
}: {
  area: AdminArea;
  serviceId: string;
  categoryId: string;
  direction: "up" | "down";
  returnTo: string;
}) {
  return (
    <form action={moveServiceAction}>
      <input type="hidden" name="area" value={area} />
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="categoryId" value={categoryId} />
      <input type="hidden" name="direction" value={direction} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        type="submit"
        className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/78 transition hover:border-white/18 hover:bg-white/6"
      >
        {direction === "up" ? "Posunout výš" : "Posunout níž"}
      </button>
    </form>
  );
}
