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
  const publicCount = category.services.filter((service) => service.isEffectivelyVisible).length;
  const internalCount = category.services.filter(
    (service) => !service.isActive || !service.isPubliclyBookable,
  ).length;
  const warningCount = category.services.filter((service) => service.warnings.length > 0).length;
  const categorySummary = [
    formatServiceCount(category.services.length),
    formatPublicCount(publicCount),
    formatInternalCount(internalCount),
    warningCount > 0 ? `${warningCount} ${warningCount === 1 ? "upozornění" : "upozornění"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <details className="group rounded-[1.2rem] border border-white/8 bg-white/[0.04]" open={defaultOpen}>
      <summary className="list-none cursor-pointer px-4 py-3 [&::-webkit-details-marker]:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white sm:text-base">{category.name}</h3>
            <p className="mt-1 text-xs text-white/62 sm:text-sm">{categorySummary}</p>
          </div>

          <div className="flex items-center gap-2">
            {!category.isActive ? (
              <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] text-white/56">
                Kategorie vypnutá
              </span>
            ) : null}
            <span className="text-xs uppercase tracking-[0.18em] text-white/45 group-open:hidden">Rozbalit</span>
            <span className="hidden text-xs uppercase tracking-[0.18em] text-white/45 group-open:inline">Sbalit</span>
          </div>
        </div>
      </summary>

      <div className="border-t border-white/8 p-2 sm:p-3">
        <div className="space-y-1.5">
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

function formatServiceCount(count: number) {
  if (count === 1) {
    return "1 služba";
  }

  if (count >= 2 && count <= 4) {
    return `${count} služby`;
  }

  return `${count} služeb`;
}

function formatPublicCount(count: number) {
  if (count === 1) {
    return "1 veřejná";
  }

  return `${count} veřejných`;
}

function formatInternalCount(count: number) {
  if (count === 0) {
    return "žádná interní/skrytá";
  }

  if (count === 1) {
    return "1 interní/skrytá";
  }

  return `${count} interní/skryté`;
}
