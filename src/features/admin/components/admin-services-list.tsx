import { ServiceCategoryGroup } from "@/features/admin/components/service-category-group";

export type AdminServiceListItem = {
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
};

type AdminServicesListProps = {
  area: "owner" | "salon";
  currentPath: string;
  currentServiceId?: string;
  queryString: string;
  returnTo: string;
  services: AdminServiceListItem[];
};

function groupServicesByCategory(services: AdminServiceListItem[]) {
  const groups = new Map<
    string,
    {
      id: string;
      name: string;
      isActive: boolean;
      services: AdminServiceListItem[];
    }
  >();

  for (const service of services) {
    const existing = groups.get(service.category.id);

    if (existing) {
      existing.services.push(service);
      continue;
    }

    groups.set(service.category.id, {
      id: service.category.id,
      name: service.category.name,
      isActive: service.category.isActive,
      services: [service],
    });
  }

  return Array.from(groups.values());
}

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
      <div className="rounded-[1.3rem] border border-dashed border-white/14 bg-white/4 p-4">
        <p className="text-base font-medium text-white">Filtru zatím nic neodpovídá.</p>
        <p className="mt-1.5 text-sm leading-6 text-white/62">
          Zkuste upravit hledání, kategorii nebo přepnout stav služby a veřejnou rezervovatelnost.
        </p>
      </div>
    );
  }

  const groups = groupServicesByCategory(services);

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <ServiceCategoryGroup
          key={group.id}
          area={area}
          category={group}
          currentPath={currentPath}
          currentServiceId={currentServiceId}
          queryString={queryString}
          returnTo={returnTo}
        />
      ))}
    </div>
  );
}
