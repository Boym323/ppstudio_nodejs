import { type AdminArea } from "@/config/navigation";
import {
  type AdminServiceListItem,
} from "@/features/admin/components/admin-services-list";
import { ServiceCompactRow } from "@/features/admin/components/service-compact-row";

export function ServiceCategoryGroup({
  area,
  category,
  currentPath,
  currentServiceId,
  queryString,
  returnTo,
}: {
  area: AdminArea;
  category: {
    id: string;
    name: string;
    isActive: boolean;
    services: AdminServiceListItem[];
  };
  currentPath: string;
  currentServiceId?: string;
  queryString: string;
  returnTo: string;
}) {
  const hasSelectedService = category.services.some((service) => service.id === currentServiceId);
  const hasActiveService = category.services.some((service) => service.isActive);
  const defaultOpen = hasSelectedService || category.isActive || hasActiveService;

  return (
    <details className="rounded-[1.2rem] border border-white/8 bg-white/[0.04]" open={defaultOpen}>
      <summary className="list-none cursor-pointer px-4 py-3 [&::-webkit-details-marker]:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-white sm:text-base">{category.name}</h3>
              <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] text-white/62">
                {category.services.length}
              </span>
              {!category.isActive ? (
                <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] text-white/56">
                  Kategorie vypnutá
                </span>
              ) : null}
            </div>
          </div>

          <span className="text-xs uppercase tracking-[0.18em] text-white/45">
            Rozbalit
          </span>
        </div>
      </summary>

      <div className="border-t border-white/8 p-2 sm:p-3">
        <div className="space-y-2">
          {category.services.map((service) => (
            <ServiceCompactRow
              key={service.id}
              area={area}
              currentPath={currentPath}
              currentServiceId={currentServiceId}
              queryString={queryString}
              returnTo={returnTo}
              service={service}
            />
          ))}
        </div>
      </div>
    </details>
  );
}
