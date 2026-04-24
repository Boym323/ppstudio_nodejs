import Link from "next/link";

import { type AdminArea } from "@/config/navigation";
import {
  toggleServiceActiveAction,
  toggleServiceBookableAction,
} from "@/features/admin/actions/service-actions";
import { type AdminServiceListItem } from "@/features/admin/components/admin-services-list";
import { ServiceActionsMenu } from "@/features/admin/components/service-actions-menu";
import { ServiceStatusBadges } from "@/features/admin/components/service-status-badges";
import { formatServicePrice } from "@/features/admin/lib/admin-service-format";
import { cn } from "@/lib/utils";

export function ServiceCompactRow({
  area,
  currentPath,
  currentServiceId,
  queryString,
  returnTo,
  service,
}: {
  area: AdminArea;
  currentPath: string;
  currentServiceId?: string;
  queryString: string;
  returnTo: string;
  service: AdminServiceListItem;
}) {
  const detailHref = `${currentPath}?${queryString}${queryString ? "&" : ""}serviceId=${service.id}`;
  const mobileDetailHref = `${detailHref}&mobileDetail=1`;
  const isSelected = currentServiceId === service.id;
  const hasWarnings = service.warnings.length > 0;

  return (
    <details
      className={cn(
        "rounded-[1rem] border transition",
        isSelected
          ? "border-[var(--color-accent)]/45 bg-[rgba(190,160,120,0.1)]"
          : "border-white/8 bg-white/[0.035]",
      )}
      open={isSelected}
    >
      <summary className="list-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-start gap-3 px-3 py-3 sm:px-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <Link
                href={detailHref}
                className="truncate text-sm font-semibold text-white transition hover:text-[var(--color-accent-soft)] sm:text-[0.97rem]"
              >
                {service.name}
              </Link>
              <div className="flex flex-wrap items-center gap-2 text-xs text-white/62 sm:text-sm">
                <span>{service.durationMinutes} min</span>
                <span className="hidden text-white/20 sm:inline">|</span>
                <span>{formatServicePrice(service.priceFromCzk)}</span>
                <span className="hidden text-white/20 lg:inline">|</span>
                <span>Rezervace: {service._count.bookings}</span>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <ServiceStatusBadges
                isActive={service.isActive}
                isPubliclyBookable={service.isPubliclyBookable}
                isEffectivelyVisible={service.isEffectivelyVisible}
                compact
              />
              {hasWarnings ? (
                <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-2.5 py-0.5 text-[11px] text-amber-100">
                  Upozornění {service.warnings.length}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-start gap-2">
            <div className="hidden items-center gap-2 lg:flex">
              <InlineToggleForm
                action={toggleServiceActiveAction}
                area={area}
                serviceId={service.id}
                returnTo={returnTo}
                active={service.isActive}
                label={service.isActive ? "Aktivní" : "Neaktivní"}
              />
              <InlineToggleForm
                action={toggleServiceBookableAction}
                area={area}
                serviceId={service.id}
                returnTo={returnTo}
                active={service.isPubliclyBookable}
                label={service.isPubliclyBookable ? "Veřejná" : "Interní"}
              />
            </div>
            <Link
              href={mobileDetailHref}
              className="inline-flex rounded-full border border-white/10 px-3 py-2 text-xs text-white/74 transition hover:border-white/18 hover:bg-white/6 xl:hidden"
            >
              Detail
            </Link>
            <ServiceActionsMenu
              area={area}
              categoryId={service.category.id}
              detailHref={detailHref}
              isActive={service.isActive}
              isPubliclyBookable={service.isPubliclyBookable}
              returnTo={returnTo}
              serviceId={service.id}
            />
          </div>
        </div>
      </summary>

      <div className="border-t border-white/8 px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/58 sm:text-sm">
          <p>Pořadí #{service.sortOrder}</p>
          <p>Slotová omezení: {service._count.allowedAvailabilitySlots}</p>
          <p>{service.category.isActive ? "Kategorie aktivní" : "Kategorie vypnutá"}</p>
        </div>

        <p className="mt-2 text-sm leading-6 text-white/66">{service.operationalContext}</p>

        {hasWarnings ? (
          <div className="mt-2 rounded-[0.95rem] border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-sm leading-6 text-amber-50">
            {service.warnings[0]}
            {service.warnings.length > 1 ? ` Další: ${service.warnings.length - 1}.` : ""}
          </div>
        ) : null}
      </div>
    </details>
  );
}

function InlineToggleForm({
  action,
  area,
  serviceId,
  returnTo,
  active,
  label,
}: {
  action: (formData: FormData) => Promise<void>;
  area: AdminArea;
  serviceId: string;
  returnTo: string;
  active: boolean;
  label: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="area" value={area} />
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        type="submit"
        className={cn(
          "rounded-full border px-3 py-1.5 text-xs transition",
          active
            ? "border-[var(--color-accent)]/35 bg-[rgba(190,160,120,0.1)] text-[var(--color-accent-soft)]"
            : "border-white/10 bg-white/5 text-white/58 hover:border-white/18 hover:bg-white/8",
        )}
      >
        {label}
      </button>
    </form>
  );
}
