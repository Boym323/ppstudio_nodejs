import Link from "next/link";

import { type AdminArea } from "@/config/navigation";
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
        <div className="grid gap-2 px-3 py-2.5 sm:px-4 xl:grid-cols-[minmax(0,1.8fr)_78px_110px_108px_auto_auto_auto] xl:items-center xl:gap-3">
          <div className="min-w-0">
            <Link
              href={detailHref}
              className="block truncate text-sm font-semibold text-white transition hover:text-[var(--color-accent-soft)] sm:text-[0.97rem]"
              title={service.name}
            >
              {service.name}
            </Link>
            <p className="mt-0.5 text-xs text-white/50 xl:hidden">
              {service.durationMinutes} min · {formatServicePrice(service.priceFromCzk)} · {service._count.bookings} rezervací
            </p>
          </div>

          <p className="hidden text-sm text-white/64 xl:block">{service.durationMinutes} min</p>
          <p className="hidden text-sm text-white/64 xl:block">{formatServicePrice(service.priceFromCzk)}</p>
          <p className="hidden text-sm text-white/64 xl:block">{service._count.bookings} rezervací</p>

          <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
            <ServiceStatusBadges
              isActive={service.isActive}
              isPubliclyBookable={service.isPubliclyBookable}
              isEffectivelyVisible={service.isEffectivelyVisible}
              compact
              showHiddenState={false}
            />
            {hasWarnings ? (
              <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-100">
                Upoz. {service.warnings.length}
              </span>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-2 xl:col-start-7 xl:row-start-1">
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
