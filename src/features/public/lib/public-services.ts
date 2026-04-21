import { Prisma } from "@prisma/client";

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
        publicName: true;
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

function formatPrice(value: number | null) {
  if (value === null) {
    return "Na dotaz";
  }

  return priceFormatter.format(value);
}

function getCategoryLabel(category: { name: string; publicName: string | null }) {
  return category.publicName ?? category.name;
}

function buildServiceIntro(service: PublicServiceRow) {
  return (
    service.publicIntro ??
    service.shortDescription ??
    service.description ??
    `Klidná péče pro službu ${resolveServiceName(service).toLowerCase()}, navržená tak, aby byla srozumitelná i při rychlém rozhodnutí.`
  );
}

function buildServiceDetail(service: PublicServiceRow) {
  return (
    service.description ??
    service.publicIntro ??
    service.shortDescription ??
    `Služba ${resolveServiceName(service).toLowerCase()} je připravená jako pečlivě vedená návštěva s důrazem na komfort a jasný výsledek.`
  );
}

function resolveServiceName(service: { name: string; publicName: string | null }) {
  return service.publicName ?? service.name;
}

function buildIdealFor(service: PublicServiceRow) {
  const publicName = resolveServiceName(service);
  const categoryLabel = getCategoryLabel(service.category);

  switch (categoryLabel) {
    case "Kosmetické ošetření":
      return [
        "pleť, která potřebuje vyčistit, zklidnit nebo podpořit rovnováhu",
        "návštěvu zvolenou podle aktuální kondice pleti",
        `${publicName.toLowerCase()} jako pravidelnou péči i promyšlený restart`,
      ];
    case "Řasy a obočí":
    case "Barvení a úprava":
      return [
        "výraz očí a obočí, který chcete sjednotit a zpřesnit",
        "ženy, které chtějí mít upravený rám obličeje bez velké námahy",
        `${publicName.toLowerCase()} jako praktickou součást pravidelné úpravy`,
      ];
    case "Masáže":
      return [
        "chvíle, kdy potřebujete uvolnit napětí a zpomalit",
        "péči zaměřenou na odlehčení a regeneraci",
        `${publicName.toLowerCase()} jako pečující reset během náročnějšího období`,
      ];
    case "Líčení":
      return [
        "běžný den, pracovní schůzku i společenskou událost",
        "ženy, které chtějí styl přizpůsobený vlastnímu typu",
        `${publicName.toLowerCase()} bez dojmu přetížení nebo cizí masky`,
      ];
    default:
      return [
        `klientky hledající ${publicName.toLowerCase()}`,
        "návštěvu vedenou klidně a přehledně",
        "službu s jasně popsaným průběhem",
      ];
  }
}

function buildIncludes(service: PublicServiceRow) {
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
  return `Autentický detail ${resolveServiceName(service).toLowerCase()} v prostoru salonu, jemné světlo, čisté prostředí a minimum stock vzhledu.`;
}

function mapService(service: PublicServiceRow): Service {
  return {
    slug: service.slug,
    name: resolveServiceName(service),
    category: getCategoryLabel(service.category),
    priceFrom: formatPrice(service.priceFromCzk),
    duration: `${service.durationMinutes} min`,
    intro: buildServiceIntro(service),
    description: buildServiceDetail(service),
    idealFor: buildIdealFor(service),
    includes: buildIncludes(service),
    results: buildResults(service),
    placeholderAssetBrief: buildPlaceholderBrief(service),
    seoDescription: service.seoDescription ?? buildServiceIntro(service),
  };
}

function mapPricingCategory(category: PublicPricingCategoryRow): PublicPricingCategory {
  return {
    id: category.slug,
    label: category.publicName ?? category.name,
    summary:
      category.pricingDescription ??
      category.description ??
      "Přehled služeb v této kategorii.",
    layout: category.pricingLayout,
    iconKey: category.pricingIconKey,
    items: category.services.map((service) => ({
      slug: service.slug,
      name: resolveServiceName(service),
      description:
        service.pricingShortDescription ??
        service.publicIntro ??
        "Klidně vedená služba s jasně popsaným průběhem.",
      duration: `${service.durationMinutes} min`,
      price: formatPrice(service.priceFromCzk),
      badge: service.pricingBadge,
      ctaHref: "/rezervace",
    })),
  };
}

export async function getPublicServices(): Promise<Service[]> {
  const services = await prisma.service.findMany({
    where: {
      isActive: true,
      isPubliclyBookable: true,
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

export async function getPublicPricingCatalog(): Promise<PublicPricingCategory[]> {
  const categories = await prisma.serviceCategory.findMany({
    where: {
      isActive: true,
      services: {
        some: {
          isActive: true,
          isPubliclyBookable: true,
        },
      },
    },
    orderBy: [{ pricingSortOrder: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    include: {
      services: {
        where: {
          isActive: true,
          isPubliclyBookable: true,
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

  return categories.map(mapPricingCategory);
}

export async function getPublicServiceBySlug(slug: string): Promise<Service | null> {
  const service = await prisma.service.findFirst({
    where: {
      slug,
      isActive: true,
      isPubliclyBookable: true,
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
          publicName: true,
        },
      },
    },
  });

  return service ? mapService(service) : null;
}
