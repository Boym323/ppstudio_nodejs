import { Prisma } from "@prisma/client";

import { type AdminArea } from "@/config/navigation";
import {
  serviceListSearchParamsSchema,
  type ServiceListBookableValue,
  type ServiceListSortValue,
  type ServiceListStatusValue,
} from "@/features/admin/lib/admin-service-validation";
import { prisma } from "@/lib/prisma";

const formatDateTime = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function normalizeSearchParams(searchParams?: Record<string, string | string[] | undefined>) {
  const parsed = serviceListSearchParamsSchema.safeParse({
    query: typeof searchParams?.query === "string" ? searchParams.query : undefined,
    status: typeof searchParams?.status === "string" ? searchParams.status : undefined,
    bookable: typeof searchParams?.bookable === "string" ? searchParams.bookable : undefined,
    sort: typeof searchParams?.sort === "string" ? searchParams.sort : undefined,
    category: typeof searchParams?.category === "string" ? searchParams.category : undefined,
    serviceId: typeof searchParams?.serviceId === "string" ? searchParams.serviceId : undefined,
    mode: typeof searchParams?.mode === "string" ? searchParams.mode : undefined,
    mobileDetail: typeof searchParams?.mobileDetail === "string" ? searchParams.mobileDetail : undefined,
  });

  const defaults = {
    query: "",
    status: "all" as ServiceListStatusValue,
    bookable: "all" as ServiceListBookableValue,
    sort: "category" as ServiceListSortValue,
    category: undefined as string | undefined,
    serviceId: undefined as string | undefined,
    mode: "list" as "list" | "create",
    mobileDetail: "0" as "0" | "1",
  };

  if (!parsed.success) {
    return defaults;
  }

  return {
    query: parsed.data.query ?? defaults.query,
    status: parsed.data.status ?? defaults.status,
    bookable: parsed.data.bookable ?? defaults.bookable,
    sort: parsed.data.sort ?? defaults.sort,
    category: parsed.data.category,
    serviceId: parsed.data.serviceId,
    mode: parsed.data.mode ?? defaults.mode,
    mobileDetail: parsed.data.mobileDetail ?? defaults.mobileDetail,
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

  if (filters.category) {
    where.categoryId = filters.category;
  }

  if (filters.query) {
    where.OR = [
      { name: { contains: filters.query, mode: "insensitive" } },
      { slug: { contains: filters.query, mode: "insensitive" } },
      { shortDescription: { contains: filters.query, mode: "insensitive" } },
      { publicIntro: { contains: filters.query, mode: "insensitive" } },
      { pricingShortDescription: { contains: filters.query, mode: "insensitive" } },
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
      return [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }];
    case "category":
    default:
      return [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }];
  }
}

function describeServiceWarnings(service: {
  isActive: boolean;
  isPubliclyBookable: boolean;
  priceFromCzk: number | null;
  publicIntro: string | null;
  pricingShortDescription: string | null;
  category: {
    isActive: boolean;
  };
}) {
  const warnings: string[] = [];

  if (service.isActive && !service.category.isActive) {
    warnings.push("Služba je aktivní, ale její kategorie je vypnutá.");
  }

  if (service.isPubliclyBookable && (!service.isActive || !service.category.isActive)) {
    warnings.push("Je označená jako veřejná, ale klientka ji teď stejně neuvidí.");
  }

  if (service.priceFromCzk === null) {
    warnings.push("Chybí cena.");
  }

  if (service.isPubliclyBookable && (!service.publicIntro || service.publicIntro.trim().length < 12)) {
    warnings.push("Veřejné službě chybí srozumitelný úvod pro web i rezervaci.");
  }

  if (service.isPubliclyBookable && !service.pricingShortDescription) {
    warnings.push("Veřejné službě chybí krátký popis do ceníku.");
  }

  return warnings;
}

function buildServiceContext(service: {
  isActive: boolean;
  isPubliclyBookable: boolean;
  _count: {
    bookings: number;
    allowedAvailabilitySlots: number;
  };
}) {
  if (!service.isActive) {
    return "Služba je vypnutá a zůstává jen pro interní evidenci nebo pozdější návrat.";
  }

  if (service.isPubliclyBookable) {
    return service._count.bookings > 0
      ? `Veřejně nabízená služba s historií ${service._count.bookings} rezervací.`
      : "Veřejně nabízená služba připravená pro web i booking flow.";
  }

  return "Interní nebo připravovaná služba, která se klientkám ve veřejné rezervaci neukazuje.";
}

export async function getAdminServicesPageData(
  area: AdminArea,
  searchParams?: Record<string, string | string[] | undefined>,
) {
  const filters = normalizeSearchParams(searchParams);
  const where = buildServiceWhere(filters);

  const [services, categories] = await Promise.all([
    prisma.service.findMany({
      where,
      orderBy: buildServiceOrderBy(filters.sort),
      select: {
        id: true,
        name: true,
        durationMinutes: true,
        priceFromCzk: true,
        sortOrder: true,
        isActive: true,
        isPubliclyBookable: true,
        publicIntro: true,
        pricingShortDescription: true,
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
        publicName: true,
        isActive: true,
        sortOrder: true,
        _count: {
          select: {
            services: true,
          },
        },
      },
    }),
  ]);

  const servicesWithMeta = services.map((service) => {
    const warnings = describeServiceWarnings(service);

    return {
      ...service,
      warnings,
      operationalContext: buildServiceContext(service),
      isEffectivelyVisible: service.isActive && service.isPubliclyBookable && service.category.isActive,
      problemCount: warnings.length,
    };
  });

  const selectedServiceId = filters.mode === "create" ? undefined : filters.serviceId;

  const selectedService = selectedServiceId
    ? await prisma.service.findUnique({
        where: { id: selectedServiceId },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              publicName: true,
              isActive: true,
              sortOrder: true,
            },
          },
          _count: {
            select: {
              bookings: true,
              allowedAvailabilitySlots: true,
            },
          },
          priceChangeLogs: {
            orderBy: {
              createdAt: "desc",
            },
            take: 10,
            include: {
              changedByUser: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      })
    : null;

  const selectedServiceWithAudit = selectedService
    ? {
        ...selectedService,
        priceChangeLogs: selectedService.priceChangeLogs.map((log) => ({
          id: log.id,
          oldPriceFromCzk: log.oldPriceFromCzk,
          newPriceFromCzk: log.newPriceFromCzk,
          createdAtLabel: formatDateTime.format(log.createdAt),
          changedByUser: log.changedByUser,
        })),
      }
    : null;

  const publicServicesCount = servicesWithMeta.filter((service) => service.isEffectivelyVisible).length;
  const currentCategoryCount = new Set(servicesWithMeta.map((service) => service.category.id)).size;
  const internalOrHiddenCount = servicesWithMeta.filter(
    (service) => !service.isActive || !service.isPubliclyBookable,
  ).length;
  const problematicCount = servicesWithMeta.filter((service) => service.problemCount > 0).length;
  const summary = {
    listed: servicesWithMeta.length,
    categories: currentCategoryCount,
    visible: publicServicesCount,
    warnings: problematicCount,
  };
  const stats: Array<{
    label: string;
    value: string;
    tone?: "default" | "accent" | "muted";
    detail: string;
  }> = [
    {
      label: "Veřejné služby",
      value: String(publicServicesCount),
      tone: "accent",
      detail: "veřejně dostupné",
    },
    {
      label: "Kategorie",
      value: String(currentCategoryCount),
      tone: "default",
      detail: "skupiny katalogu",
    },
    {
      label: "Interní / skryté",
      value: String(internalOrHiddenCount),
      tone: internalOrHiddenCount > 0 ? "muted" : "default",
      detail: "interní nebo skryté",
    },
    {
      label: "Vyžaduje kontrolu",
      value: String(problematicCount),
      tone: problematicCount > 0 ? "accent" : "muted",
      detail: "k opravě",
    },
  ];

  return {
    area,
    filters,
    stats,
    summary,
    catalogScopeNotice: "Systémové/testovací položky jsou skryté.",
    services: servicesWithMeta,
    categories,
    selectedService: selectedServiceWithAudit,
    draftCategoryId:
      filters.category && categories.some((category) => category.id === filters.category)
        ? filters.category
        : categories.find((category) => category.isActive)?.id ?? categories[0]?.id,
    currentPath: area === "owner" ? "/admin/sluzby" : "/admin/provoz/sluzby",
  };
}
