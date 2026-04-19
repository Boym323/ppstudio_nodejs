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
      };
    };
  };
}>;

function formatPrice(value: number | null) {
  if (value === null) {
    return "Na dotaz";
  }

  return priceFormatter.format(value);
}

function buildServiceIntro(service: PublicServiceRow) {
  return (
    service.shortDescription ??
    service.description ??
    `Klidná péče pro službu ${service.name.toLowerCase()}, navržená tak, aby byla srozumitelná i při rychlém rozhodnutí.`
  );
}

function buildServiceDetail(service: PublicServiceRow) {
  return (
    service.description ??
    service.shortDescription ??
    `Detail služby ${service.name} je v databázi připravený pro další doplnění a může být rozšířen bez zásahu do routy.`
  );
}

function buildIdealFor(service: PublicServiceRow) {
  const category = service.category.name.toLowerCase();

  return [
    `klientky hledající ${service.name.toLowerCase()}`,
    `návštěvu v kategorii ${category}`,
    "jasně popsaný průběh bez zbytečných překvapení",
  ];
}

function buildIncludes(service: PublicServiceRow) {
  return [
    "úvodní zhodnocení a krátké doporučení před začátkem",
    `časový rozsah přibližně ${service.durationMinutes} minut`,
    "závěrečné doporučení k další péči nebo navazující návštěvě",
  ];
}

function buildResults(service: PublicServiceRow) {
  return [
    `přehledná služba s cenou od ${formatPrice(service.priceFromCzk)}`,
    `délka nastavená na ${service.durationMinutes} minut`,
    "napojení na booking flow i provozní plánování bez dalších mezikroků",
  ];
}

function buildPlaceholderBrief(service: PublicServiceRow) {
  return `Autentický detail ${service.name.toLowerCase()} v prostoru salonu, jemné světlo, čisté prostředí a minimum stock vzhledu.`;
}

function mapService(service: PublicServiceRow): Service {
  return {
    slug: service.slug,
    name: service.name,
    category: service.category.name,
    priceFrom: formatPrice(service.priceFromCzk),
    duration: `${service.durationMinutes} min`,
    intro: buildServiceIntro(service),
    description: buildServiceDetail(service),
    idealFor: buildIdealFor(service),
    includes: buildIncludes(service),
    results: buildResults(service),
    placeholderAssetBrief: buildPlaceholderBrief(service),
    seoDescription: buildServiceIntro(service),
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
        },
      },
    },
  });

  return services.map(mapService);
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
        },
      },
    },
  });

  return service ? mapService(service) : null;
}
