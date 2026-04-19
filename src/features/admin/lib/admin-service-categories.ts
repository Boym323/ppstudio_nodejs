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
  });

  const defaults = {
    query: "",
    status: "all" as ServiceCategoryListStatusValue,
    sort: "order" as ServiceCategoryListSortValue,
    categoryId: undefined as string | undefined,
  };

  if (!parsed.success) {
    return defaults;
  }

  return {
    query: parsed.data.query ?? defaults.query,
    status: parsed.data.status ?? defaults.status,
    sort: parsed.data.sort ?? defaults.sort,
    categoryId: parsed.data.categoryId,
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

export async function getAdminServiceCategoriesPageData(
  area: AdminArea,
  searchParams?: Record<string, string | string[] | undefined>,
) {
  const filters = normalizeSearchParams(searchParams);
  const where = buildCategoryWhere(filters);

  const [activeCount, inactiveCount, categoriesWithServicesCount, categories] = await Promise.all([
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
  ]);

  const selectedCategoryId = filters.categoryId ?? categories[0]?.id;

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

  return {
    area,
    filters,
    stats: [
      {
        label: "Aktivní kategorie",
        value: String(activeCount),
        tone: "accent" as const,
        detail: "Tyto kategorie se dál propisují do admin přehledu i veřejných výpisů služeb.",
      },
      {
        label: "Neaktivní kategorie",
        value: String(inactiveCount),
        tone: "muted" as const,
        detail: "Vazby na služby zůstávají zachované, ale web a booking je běžně schovají.",
      },
      {
        label: "Kategorie se službami",
        value: String(categoriesWithServicesCount),
        detail: "Tyto kategorie už mají navázané služby, takže dává smysl je spíš upravit než mazat.",
      },
      {
        label: "Prázdné kategorie",
        value: String(Math.max(activeCount + inactiveCount - categoriesWithServicesCount, 0)),
        tone: "muted" as const,
        detail: "Prázdné kategorie lze bezpečně odstranit bez zásahu do služeb.",
      },
    ],
    categories,
    selectedCategory,
    currentPath: area === "owner" ? "/admin/kategorie-sluzeb" : "/admin/provoz/kategorie-sluzeb",
  };
}
