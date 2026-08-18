import { Prisma } from "@/generated/prisma/client";

import { type Service } from "@/content/public-site";
import { prisma } from "@/lib/prisma";

const priceFormatter = new Intl.NumberFormat("cs-CZ", {
  style: "currency",
  currency: "CZK",
  maximumFractionDigits: 0,
});

type PublicServiceRow = Prisma.ServiceGetPayload<{
  include: {
    category: {
      select: {
        name: true;
      };
    };
  };
}>;

type PublicPricingCategoryRow = Prisma.ServiceCategoryGetPayload<{
  include: {
    services: {
      select: {
        slug: true;
        name: true;
        publicName: true;
        publicIntro: true;
        pricingShortDescription: true;
        pricingBadge: true;
        durationMinutes: true;
        priceFromCzk: true;
      };
    };
  };
}>;

export type PublicPricingItem = {
  slug: string;
  name: string;
  description: string;
  duration: string;
  price: string;
  badge: string | null;
  ctaHref: string;
};

export type PublicPricingCategory = {
  id: string;
  label: string;
  summary: string;
  layout: "LIST" | "GRID";
  iconKey: "DROPLET" | "EYE_LASHES" | "LOTUS" | "BRUSH" | "LEAF" | "LIPSTICK" | "SPARK";
  items: PublicPricingItem[];
};

export type PublicServiceSitemapEntry = {
  slug: string;
  updatedAt: Date;
};

const publicServiceVisibilityWhere = {
  isActive: true,
  isPubliclyBookable: true,
  OR: [
    { publicIntro: { not: null } },
    { description: { not: null } },
    { seoDescription: { not: null } },
    { pricingShortDescription: { not: null } },
  ],
} satisfies Prisma.ServiceWhereInput;

function formatPrice(value: number | null) {
  if (value === null) {
    return "Na dotaz";
  }

  return priceFormatter.format(value);
}

function getServiceDisplayName(service: { name: string; publicName: string | null }) {
  return service.publicName || service.name;
}

function getCategoryLabel(category: { name?: string | null } | null) {
  const fallbackLabel = category?.name?.trim();

  if (fallbackLabel) {
    return fallbackLabel;
  }

  return "Služby salonu";
}

function buildServiceIntro(service: PublicServiceRow) {
  const serviceName = getServiceDisplayName(service);

  return (
    service.publicIntro ??
    service.description ??
    `Klidná péče pro službu ${serviceName.toLowerCase()}, navržená tak, aby byla srozumitelná i při rychlém rozhodnutí.`
  );
}

function buildServiceDetail(service: PublicServiceRow) {
  const serviceName = getServiceDisplayName(service);

  return (
    service.description ??
    service.publicIntro ??
    `Služba ${serviceName.toLowerCase()} je připravená jako pečlivě vedená návštěva s důrazem na komfort a jasný výsledek.`
  );
}

function buildIdealFor(service: PublicServiceRow) {
  if (service.idealFor.length > 0) {
    return service.idealFor;
  }

  const serviceName = getServiceDisplayName(service);
  const categoryLabel = getCategoryLabel(service.category);

  switch (categoryLabel) {
    case "Kosmetické ošetření":
      return [
        "pleť, která potřebuje vyčistit, zklidnit nebo podpořit rovnováhu",
        "návštěvu zvolenou podle aktuální kondice pleti",
        `${serviceName.toLowerCase()} jako pravidelnou péči i promyšlený restart`,
      ];
    case "Řasy a obočí":
    case "Barvení a úprava":
      return [
        "výraz očí a obočí, který chcete sjednotit a zpřesnit",
        "ženy, které chtějí mít upravený rám obličeje bez velké námahy",
        `${serviceName.toLowerCase()} jako praktickou součást pravidelné úpravy`,
      ];
    case "Masáže":
      return [
        "chvíle, kdy potřebujete uvolnit napětí a zpomalit",
        "péči zaměřenou na odlehčení a regeneraci",
        `${serviceName.toLowerCase()} jako pečující reset během náročnějšího období`,
      ];
    case "Líčení":
      return [
        "běžný den, pracovní schůzku i společenskou událost",
        "ženy, které chtějí styl přizpůsobený vlastnímu typu",
        `${serviceName.toLowerCase()} bez dojmu přetížení nebo cizí masky`,
      ];
    default:
      return [
        `klientky hledající ${serviceName.toLowerCase()}`,
        "návštěvu vedenou klidně a přehledně",
        "službu s jasně popsaným průběhem",
      ];
  }
}

function buildIncludes(service: PublicServiceRow) {
  if (service.includes.length > 0) {
    return service.includes;
  }

  const categoryLabel = getCategoryLabel(service.category);

  switch (categoryLabel) {
    case "Kosmetické ošetření":
      return [
        "krátké zhodnocení pleti a volbu vhodného postupu",
        `péči vedenou v rozsahu přibližně ${service.durationMinutes} minut`,
        "doporučení k navazující nebo domácí péči",
      ];
    case "Řasy a obočí":
    case "Barvení a úprava":
      return [
        "konzultaci tvaru, směru nebo výsledného efektu",
        `službu v rozsahu přibližně ${service.durationMinutes} minut`,
        "doporučení k následné úpravě a péči",
      ];
    case "Masáže":
      return [
        "klidně vedený začátek bez zbytečného spěchu",
        `masáž v rozsahu přibližně ${service.durationMinutes} minut`,
        "čas na doznění a krátké doporučení po návštěvě",
      ];
    case "Líčení":
      return [
        "domluvu výsledného stylu podle příležitosti",
        `líčení v rozsahu přibližně ${service.durationMinutes} minut`,
        "úpravu respektující rysy obličeje i celkový outfit",
      ];
    default:
      return [
        "úvodní zhodnocení a krátké doporučení před začátkem",
        `časový rozsah přibližně ${service.durationMinutes} minut`,
        "závěrečné doporučení k další péči nebo navazující návštěvě",
      ];
  }
}

function buildResults(service: PublicServiceRow) {
  if (service.benefits.length > 0) {
    return service.benefits;
  }

  const categoryLabel = getCategoryLabel(service.category);

  switch (categoryLabel) {
    case "Kosmetické ošetření":
      return [
        "větší komfort pleti a srozumitelnější směr další péče",
        `služba s délkou ${service.durationMinutes} minut a cenou od ${formatPrice(service.priceFromCzk)}`,
        "pocit, že pleť dostala to, co právě potřebovala",
      ];
    case "Řasy a obočí":
    case "Barvení a úprava":
      return [
        "čistší rám obličeje a jistější výraz",
        `služba s délkou ${service.durationMinutes} minut a cenou od ${formatPrice(service.priceFromCzk)}`,
        "snazší každodenní úprava bez zbytečné námahy",
      ];
    case "Masáže":
      return [
        "odlehčení, uvolnění a prostor na regeneraci",
        `služba s délkou ${service.durationMinutes} minut a cenou od ${formatPrice(service.priceFromCzk)}`,
        "pocit, že se obličej i mysl na chvíli zpomalily",
      ];
    case "Líčení":
      return [
        "look, který sedí příležitosti i vašemu stylu",
        `služba s délkou ${service.durationMinutes} minut a cenou od ${formatPrice(service.priceFromCzk)}`,
        "větší jistota v tom, jak působíte",
      ];
    default:
      return [
        `přehledná služba s cenou od ${formatPrice(service.priceFromCzk)}`,
        `délka nastavená na ${service.durationMinutes} minut`,
        "návštěva vedená s důrazem na pohodlí a srozumitelnost",
      ];
  }
}

function buildPlaceholderBrief(service: PublicServiceRow) {
  return `Autentický detail ${getServiceDisplayName(service).toLowerCase()} v prostoru salonu, jemné světlo, čisté prostředí a minimum stock vzhledu.`;
}

function mapService(service: PublicServiceRow): Service {
  return {
    slug: service.slug,
    name: getServiceDisplayName(service),
    category: getCategoryLabel(service.category),
    priceFrom: formatPrice(service.priceFromCzk),
    duration: `${service.durationMinutes} min`,
    durationMinutes: service.durationMinutes,
    intro: buildServiceIntro(service),
    description: buildServiceDetail(service),
    idealFor: buildIdealFor(service),
    includes: buildIncludes(service),
    results: buildResults(service),
    goodToKnow: service.goodToKnow.length > 0 ? service.goodToKnow : undefined,
    placeholderAssetBrief: buildPlaceholderBrief(service),
    seoTitle: service.seoTitle ?? undefined,
    seoDescription: service.seoDescription ?? buildServiceIntro(service),
  };
}

function mapPricingCategory(category: PublicPricingCategoryRow): PublicPricingCategory {
  return {
    id: category.slug,
    label: getCategoryLabel(category),
    summary:
      category.pricingDescription ??
      category.description ??
      "Přehled služeb v této kategorii.",
    layout: category.pricingLayout,
    iconKey: category.pricingIconKey,
    items: category.services.map((service) => ({
      slug: service.slug,
      name: getServiceDisplayName(service),
      description:
        service.pricingShortDescription ??
        service.publicIntro ??
        "Klidně vedená služba s jasně popsaným průběhem.",
      duration: `${service.durationMinutes} min`,
      price: formatPrice(service.priceFromCzk),
      badge: service.pricingBadge,
      ctaHref: `/rezervace?service=${encodeURIComponent(service.slug)}`,
    })),
  };
}

function assertUniquePricingServicePlacement(categories: PublicPricingCategory[]) {
  const seenServiceToCategory = new Map<string, string>();

  for (const category of categories) {
    for (const item of category.items) {
      const existingCategory = seenServiceToCategory.get(item.slug);

      if (existingCategory) {
        throw new Error(
          `Služba "${item.slug}" je v ceníku zařazená ve více kategoriích: "${existingCategory}" a "${category.label}".`,
        );
      }

      seenServiceToCategory.set(item.slug, category.label);
    }
  }
}

export async function getPublicServices(): Promise<Service[]> {
  const services = await prisma.service.findMany({
    where: {
      ...publicServiceVisibilityWhere,
      category: {
        is: {
          isActive: true,
        },
      },
    },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
    include: {
      category: {
        select: {
          name: true,
          publicName: true,
        },
      },
    },
  });

  return services.map(mapService);
}

export async function getVoucherSuggestedServices(limit = 3): Promise<Service[]> {
  const services = await prisma.service.findMany({
    where: {
      ...publicServiceVisibilityWhere,
      category: {
        is: {
          isActive: true,
        },
      },
    },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
    take: limit,
    include: {
      category: {
        select: {
          name: true,
          publicName: true,
        },
      },
    },
  });

  return services.map(mapService);
}

export async function getHomepageFeaturedServices(limit = 3): Promise<Service[]> {
  const featuredServices = await prisma.service.findMany({
    where: {
      ...publicServiceVisibilityWhere,
      isFeaturedOnHomepage: true,
      category: {
        is: {
          isActive: true,
        },
      },
    },
    orderBy: [{ homepageSortOrder: "asc" }, { category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
    take: limit,
    include: {
      category: {
        select: {
          name: true,
        },
      },
    },
  });

  if (featuredServices.length > 0) {
    return featuredServices.map(mapService);
  }

  const fallbackServices = await prisma.service.findMany({
    where: {
      ...publicServiceVisibilityWhere,
      category: {
        is: {
          isActive: true,
        },
      },
    },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
    take: limit,
    include: {
      category: {
        select: {
          name: true,
        },
      },
    },
  });

  return fallbackServices.map(mapService);
}

export async function getPublicPricingCatalog(): Promise<PublicPricingCategory[]> {
  const categories = await prisma.serviceCategory.findMany({
    where: {
      isActive: true,
      services: {
        some: {
          ...publicServiceVisibilityWhere,
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { pricingSortOrder: "asc" }, { name: "asc" }],
    include: {
      services: {
        where: {
          ...publicServiceVisibilityWhere,
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          slug: true,
          name: true,
          publicName: true,
          publicIntro: true,
          pricingShortDescription: true,
          pricingBadge: true,
          durationMinutes: true,
          priceFromCzk: true,
        },
      },
    },
  });

  const pricingCategories = categories.map(mapPricingCategory);
  assertUniquePricingServicePlacement(pricingCategories);

  return pricingCategories;
}

export async function getPublicServiceBySlug(slug: string): Promise<Service | null> {
  const service = await prisma.service.findFirst({
    where: {
      ...publicServiceVisibilityWhere,
      slug,
      category: {
        is: {
          isActive: true,
        },
      },
    },
    include: {
      category: {
        select: {
          name: true,
        },
      },
    },
  });

  return service ? mapService(service) : null;
}

export async function getPublicServiceSitemapEntries(): Promise<PublicServiceSitemapEntry[]> {
  return prisma.service.findMany({
    where: {
      ...publicServiceVisibilityWhere,
      category: {
        is: {
          isActive: true,
        },
      },
    },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
    select: {
      slug: true,
      updatedAt: true,
    },
  });
}
