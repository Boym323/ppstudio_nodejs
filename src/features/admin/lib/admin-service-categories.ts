import { Prisma } from "@prisma/client";

import { type AdminArea } from "@/config/navigation";
import {
  serviceCategoryListSearchParamsSchema,
  type ServiceCategoryListSortValue,
  type ServiceCategoryListStatusValue,
} from "@/features/admin/lib/admin-service-category-validation";
import { prisma } from "@/lib/prisma";

function normalizeSearchParams(searchParams?: Record<string, string | string[] | undefined>) {
  const parsed = serviceCategoryListSearchParamsSchema.safeParse({
    query: typeof searchParams?.query === "string" ? searchParams.query : undefined,
    status: typeof searchParams?.status === "string" ? searchParams.status : undefined,
    sort: typeof searchParams?.sort === "string" ? searchParams.sort : undefined,
    categoryId: typeof searchParams?.categoryId === "string" ? searchParams.categoryId : undefined,
    mode: typeof searchParams?.mode === "string" ? searchParams.mode : undefined,
    mobileDetail: typeof searchParams?.mobileDetail === "string" ? searchParams.mobileDetail : undefined,
  });

  const defaults = {
    query: "",
    status: "all" as ServiceCategoryListStatusValue,
    sort: "order" as ServiceCategoryListSortValue,
    categoryId: undefined as string | undefined,
    mode: "list" as "list" | "create",
    mobileDetail: "0" as "0" | "1",
  };

  if (!parsed.success) {
    return defaults;
  }

  return {
    query: parsed.data.query ?? defaults.query,
    status: parsed.data.status ?? defaults.status,
    sort: parsed.data.sort ?? defaults.sort,
    categoryId: parsed.data.categoryId,
    mode: parsed.data.mode ?? defaults.mode,
    mobileDetail: parsed.data.mobileDetail ?? defaults.mobileDetail,
  };
}

function buildCategoryWhere(
  filters: ReturnType<typeof normalizeSearchParams>,
): Prisma.ServiceCategoryWhereInput {
  const where: Prisma.ServiceCategoryWhereInput = {};

  if (filters.status === "active") {
    where.isActive = true;
  }

  if (filters.status === "inactive") {
    where.isActive = false;
  }

  if (filters.query) {
    where.OR = [
      { name: { contains: filters.query, mode: "insensitive" } },
      { slug: { contains: filters.query, mode: "insensitive" } },
      { description: { contains: filters.query, mode: "insensitive" } },
    ];
  }

  return where;
}

function buildCategoryOrderBy(
  sort: ServiceCategoryListSortValue,
): Prisma.ServiceCategoryOrderByWithRelationInput[] {
  switch (sort) {
    case "name":
      return [{ name: "asc" }];
    case "services":
      return [{ services: { _count: "desc" } }, { sortOrder: "asc" }, { name: "asc" }];
    case "order":
    default:
      return [{ sortOrder: "asc" }, { name: "asc" }];
  }
}

type CategoryCounts = {
  total: number;
  active: number;
  public: number;
};

function describeCategoryWarnings(category: {
  isActive: boolean;
  counts: CategoryCounts;
}) {
  const warnings: string[] = [];

  if (category.counts.total === 0) {
    warnings.push("Kategorie je prázdná.");
  }

  if (category.isActive && category.counts.public === 0) {
    warnings.push("Aktivní kategorie zatím nemá žádnou veřejnou službu.");
  }

  if (!category.isActive && category.counts.active > 0) {
    warnings.push("Neaktivní kategorie stále obsahuje aktivní služby.");
  }

  return warnings;
}

export async function getAdminServiceCategoriesPageData(
  area: AdminArea,
  searchParams?: Record<string, string | string[] | undefined>,
) {
  const filters = normalizeSearchParams(searchParams);
  const where = buildCategoryWhere(filters);

  const [activeCount, inactiveCount, categoriesWithServicesCount, categories, services] = await Promise.all([
    prisma.serviceCategory.count({ where: { isActive: true } }),
    prisma.serviceCategory.count({ where: { isActive: false } }),
    prisma.serviceCategory.count({ where: { services: { some: {} } } }),
    prisma.serviceCategory.findMany({
      where,
      orderBy: buildCategoryOrderBy(filters.sort),
      include: {
        _count: {
          select: {
            services: true,
          },
        },
      },
    }),
    prisma.service.findMany({
      select: {
        id: true,
        categoryId: true,
        isActive: true,
        isPubliclyBookable: true,
      },
    }),
  ]);

  const countsByCategory = new Map<string, CategoryCounts>();

  for (const service of services) {
    const current = countsByCategory.get(service.categoryId) ?? {
      total: 0,
      active: 0,
      public: 0,
    };

    current.total += 1;

    if (service.isActive) {
      current.active += 1;
    }

    if (service.isActive && service.isPubliclyBookable) {
      current.public += 1;
    }

    countsByCategory.set(service.categoryId, current);
  }

  const categoriesWithMeta = categories.map((category) => {
    const counts = countsByCategory.get(category.id) ?? {
      total: 0,
      active: 0,
      public: 0,
    };
    const warnings = describeCategoryWarnings({
      isActive: category.isActive,
      counts,
    });

    return {
      ...category,
      counts,
      warnings,
      problemCount: warnings.length,
    };
  });

  const selectedCategoryId = filters.mode === "create" ? undefined : filters.categoryId ?? categoriesWithMeta[0]?.id;

  const selectedCategory = selectedCategoryId
    ? await prisma.serviceCategory.findUnique({
        where: { id: selectedCategoryId },
        include: {
          _count: {
            select: {
              services: true,
            },
          },
          services: {
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            take: 6,
            select: {
              id: true,
              name: true,
              sortOrder: true,
              isActive: true,
              isPubliclyBookable: true,
            },
          },
        },
      })
    : null;

  const problematicCount = categoriesWithMeta.filter((category) => category.problemCount > 0).length;
  const stats: Array<{
    label: string;
    value: string;
    tone?: "default" | "accent" | "muted";
    detail: string;
  }> = [
    {
      label: "Aktivní kategorie",
      value: String(activeCount),
      tone: "accent",
      detail: "Tyto kategorie se propisují do adminu i veřejného katalogu.",
    },
    {
      label: "Kategorie se službami",
      value: String(categoriesWithServicesCount),
      tone: "default",
      detail: "Mají navázané služby a dávají smysl spíš pro úpravu než mazání.",
    },
    {
      label: "Prázdné kategorie",
      value: String(Math.max(activeCount + inactiveCount - categoriesWithServicesCount, 0)),
      tone: "muted",
      detail: "Prázdné kategorie lze bezpečně odstranit, pokud už je nechcete držet pro později.",
    },
    {
      label: "Potřebují pozornost",
      value: String(problematicCount),
      tone: problematicCount > 0 ? "accent" : "muted",
      detail: "Prázdné, vypnuté nebo bez veřejných služeb podle aktuálního stavu.",
    },
  ];

  return {
    area,
    filters,
    stats,
    categories: categoriesWithMeta,
    selectedCategory,
    selectedCategoryCounts: selectedCategory
      ? countsByCategory.get(selectedCategory.id) ?? { total: 0, active: 0, public: 0 }
      : { total: 0, active: 0, public: 0 },
    currentPath: area === "owner" ? "/admin/kategorie-sluzeb" : "/admin/provoz/kategorie-sluzeb",
    servicesPath: area === "owner" ? "/admin/sluzby" : "/admin/provoz/sluzby",
  };
}
