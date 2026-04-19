import { Prisma } from "@prisma/client";

import { type AdminArea } from "@/config/navigation";
import {
  serviceListSearchParamsSchema,
  type ServiceListBookableValue,
  type ServiceListSortValue,
  type ServiceListStatusValue,
} from "@/features/admin/lib/admin-service-validation";
import { prisma } from "@/lib/prisma";

function normalizeSearchParams(searchParams?: Record<string, string | string[] | undefined>) {
  const parsed = serviceListSearchParamsSchema.safeParse({
    query: typeof searchParams?.query === "string" ? searchParams.query : undefined,
    status: typeof searchParams?.status === "string" ? searchParams.status : undefined,
    bookable: typeof searchParams?.bookable === "string" ? searchParams.bookable : undefined,
    sort: typeof searchParams?.sort === "string" ? searchParams.sort : undefined,
    serviceId: typeof searchParams?.serviceId === "string" ? searchParams.serviceId : undefined,
  });

  const defaults = {
    query: "",
    status: "all" as ServiceListStatusValue,
    bookable: "all" as ServiceListBookableValue,
    sort: "category" as ServiceListSortValue,
    serviceId: undefined as string | undefined,
  };

  if (!parsed.success) {
    return defaults;
  }

  return {
    query: parsed.data.query ?? defaults.query,
    status: parsed.data.status ?? defaults.status,
    bookable: parsed.data.bookable ?? defaults.bookable,
    sort: parsed.data.sort ?? defaults.sort,
    serviceId: parsed.data.serviceId,
  };
}

function buildServiceWhere(filters: ReturnType<typeof normalizeSearchParams>): Prisma.ServiceWhereInput {
  const where: Prisma.ServiceWhereInput = {};

  if (filters.status === "active") {
    where.isActive = true;
  }

  if (filters.status === "inactive") {
    where.isActive = false;
  }

  if (filters.bookable === "public") {
    where.isPubliclyBookable = true;
  }

  if (filters.bookable === "private") {
    where.isPubliclyBookable = false;
  }

  if (filters.query) {
    where.OR = [
      { name: { contains: filters.query, mode: "insensitive" } },
      { slug: { contains: filters.query, mode: "insensitive" } },
      { shortDescription: { contains: filters.query, mode: "insensitive" } },
      { category: { is: { name: { contains: filters.query, mode: "insensitive" } } } },
    ];
  }

  return where;
}

function buildServiceOrderBy(sort: ServiceListSortValue): Prisma.ServiceOrderByWithRelationInput[] {
  switch (sort) {
    case "name":
      return [{ name: "asc" }];
    case "duration":
      return [{ durationMinutes: "asc" }, { name: "asc" }];
    case "price":
      return [{ priceFromCzk: "asc" }, { name: "asc" }];
    case "order":
      return [{ sortOrder: "asc" }, { name: "asc" }];
    case "category":
    default:
      return [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }];
  }
}

export async function getAdminServicesPageData(
  area: AdminArea,
  searchParams?: Record<string, string | string[] | undefined>,
) {
  const filters = normalizeSearchParams(searchParams);
  const where = buildServiceWhere(filters);

  const [
    activeCount,
    inactiveCount,
    publicCount,
    privateCount,
    services,
    categories,
  ] = await Promise.all([
    prisma.service.count({ where: { isActive: true } }),
    prisma.service.count({ where: { isActive: false } }),
    prisma.service.count({ where: { isPubliclyBookable: true } }),
    prisma.service.count({ where: { isPubliclyBookable: false } }),
    prisma.service.findMany({
      where,
      orderBy: buildServiceOrderBy(filters.sort),
      include: {
        category: {
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            bookings: true,
            allowedAvailabilitySlots: true,
          },
        },
      },
    }),
    prisma.serviceCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        isActive: true,
        sortOrder: true,
      },
    }),
  ]);

  const selectedServiceId = filters.serviceId ?? services[0]?.id;

  const selectedService = selectedServiceId
    ? await prisma.service.findUnique({
        where: { id: selectedServiceId },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              isActive: true,
            },
          },
          _count: {
            select: {
              bookings: true,
              allowedAvailabilitySlots: true,
            },
          },
        },
      })
    : null;

  return {
    area,
    filters,
    stats: [
      {
        label: "Aktivní služby",
        value: String(activeCount),
        tone: "accent" as const,
        detail: "Služby, které zůstávají dostupné pro interní práci a další navazující flow.",
      },
      {
        label: "Neaktivní služby",
        value: String(inactiveCount),
        tone: "muted" as const,
        detail: "Služby dočasně vypnuté nebo historicky ponechané v katalogu.",
      },
      {
        label: "Veřejně rezervovatelné",
        value: String(publicCount),
        detail: "Tyto služby se mohou objevit ve veřejném booking flow, pokud jsou zároveň aktivní.",
      },
      {
        label: "Jen interní / skryté",
        value: String(privateCount),
        tone: "muted" as const,
        detail: "Hodí se pro provozní nebo připravované služby bez veřejné rezervace.",
      },
    ],
    services,
    categories,
    selectedService,
    currentPath: area === "owner" ? "/admin/sluzby" : "/admin/provoz/sluzby",
  };
}
