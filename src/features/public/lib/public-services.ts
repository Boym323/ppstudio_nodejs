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

type ServiceCopyOverride = {
  publicName?: string;
  intro?: string;
  description?: string;
  seoDescription?: string;
};

const categoryPublicNameMap: Record<string, string> = {
  "Lash & brow bar": "Řasy a obočí",
  "Úprava řas a obočí": "Barvení a úprava",
  "Vizážistika a líčení": "Líčení",
};

const serviceCopyBySlug: Record<string, ServiceCopyOverride> = {
  "refresh-treatment-60-min": {
    publicName: "Refresh ošetření pleti",
    intro:
      "Ošetření pro pleť, která potřebuje vyčistit, zklidnit a vrátit do rovnováhy. Vhodné pro pravidelnou péči i jako jistý začátek.",
    seoDescription:
      "Refresh ošetření pleti pro vyčištění, zklidnění a podporu rovnováhy pleti.",
  },
  "refresh-treatment-90-min": {
    publicName: "Refresh ošetření pleti s masáží",
    intro:
      "Delší verze ošetření s větším prostorem pro komfort i péči o pleť. Ideální, když chcete spojit účinek ošetření s uvolněnějším průběhem.",
    seoDescription:
      "Delší refresh ošetření pleti s masáží pro komfortnější průběh a vyváženou péči.",
  },
  "anti-age-treatment": {
    publicName: "Anti-age ošetření",
    intro:
      "Péče pro pleť, která potřebuje podpořit pevnost, výživu a celkovou kondici. Výsledkem je kultivovanější a odpočatější vzhled.",
    seoDescription:
      "Anti-age ošetření pro podporu pevnosti, výživy a celkové kondice pleti.",
  },
  "clear-treatment": {
    publicName: "Clear ošetření pleti",
    intro:
      "Ošetření pro pleť se sklonem k nečistotám, přetížení nebo nerovnováze. Pomáhá ji pročistit a vrátit jí větší komfort.",
    seoDescription:
      "Clear ošetření pleti pro pleť se sklonem k nečistotám a narušené rovnováze.",
  },
  "mens-treatment": {
    publicName: "Pánské ošetření pleti",
    intro:
      "Prakticky vedené ošetření zaměřené na čistotu pleti, pohodlí a upravený výsledek. Dobrá volba pro pravidelnou péči i první návštěvu.",
    seoDescription:
      "Pánské ošetření pleti zaměřené na čistotu, komfort a pravidelnou péči.",
  },
  "spicule-pdrn-treatment": {
    publicName: "Spicule & PDRN ošetření",
    intro:
      "Intenzivnější péče pro pleť, která potřebuje podpořit obnovu a dodat novou energii. Vhodné ve chvíli, kdy chcete cílenější zásah.",
    seoDescription:
      "Spicule & PDRN ošetření pro podporu obnovy pleti a cílenější péči.",
  },
  "student-treatment-15-20-let": {
    publicName: "Studentské ošetření pleti",
    intro:
      "Ošetření pro mladou pleť se zaměřením na čistotu, rovnováhu a správné návyky v péči. Citlivě vedený začátek bez zbytečné složitosti.",
    seoDescription:
      "Studentské ošetření pleti pro mladou pleť a správné návyky v péči.",
  },
  "spicule-exosomy-treatment": {
    publicName: "Spicule & Exosomy ošetření",
    intro:
      "Cílená péče pro pleť, která si žádá regeneraci a podporu celkové kondice. Ošetření je vhodné, když chcete pleti dopřát víc než běžný standard.",
    seoDescription:
      "Spicule & Exosomy ošetření pro regeneraci a podporu celkové kondice pleti.",
  },
  "lash-lifting": {
    publicName: "Lash lifting řas",
    intro:
      "Služba, která otevře pohled a dodá řasám výraznější linii bez každodenní práce s řasenkou. Výsledný efekt působí čistě a uspořádaně.",
    seoDescription:
      "Lash lifting řas pro otevřenější pohled a výraznější linii přírodních řas.",
  },
  "laminace-oboci": {
    publicName: "Laminace obočí",
    intro:
      "Úprava pro obočí, které potřebuje tvar, směr a lepší disciplínu. Pomáhá vytvořit upravený rám obličeje.",
    seoDescription:
      "Laminace obočí pro lepší tvar, směr a upravený rám obličeje.",
  },
  "lash-lifting-plus-laminace-oboci": {
    publicName: "Lash lifting a laminace obočí",
    intro:
      "Kombinace pro ženy, které chtějí sladit obočí i řasy v jednom kroku. Pohled je výraznější a obličej působí uceleněji.",
    seoDescription:
      "Kombinace lash liftingu a laminace obočí pro sjednocený výraz očí a obličeje.",
  },
  "lymfaticka-masaz-obliceje": {
    publicName: "Lymfatická masáž obličeje",
    intro:
      "Masáž pro odlehčení obličeje, uvolnění napětí a podporu regenerace. Vhodná, když potřebujete zpomalit a dopřát si pečující reset.",
    seoDescription:
      "Lymfatická masáž obličeje pro odlehčení, uvolnění a podporu regenerace.",
  },
  "barveni-oboci": {
    publicName: "Barvení obočí",
    intro:
      "Rychlá služba pro plnější a čitelnější tvar obočí. Hodí se, když chcete dodat obličeji větší definici.",
    seoDescription:
      "Barvení obočí pro plnější tvar a výraznější rám obličeje.",
  },
  "barveni-ras": {
    publicName: "Barvení řas",
    intro:
      "Zvýraznění řas pro otevřenější pohled i bez líčení. Praktická volba pro každodenní pohodlí.",
    seoDescription:
      "Barvení řas pro otevřenější pohled a pohodlnější každodenní úpravu.",
  },
  "uprava-oboci": {
    publicName: "Úprava obočí",
    intro:
      "Precizní úprava tvaru obočí, která pomáhá vyvážit výraz obličeje. Malý detail s velmi viditelným efektem.",
    seoDescription:
      "Úprava obočí pro vyváženější výraz obličeje a čistou linii.",
  },
  "depilace-horniho-rtu-brady": {
    publicName: "Depilace horního rtu a brady",
    intro:
      "Šetrná úprava drobných partií obličeje pro čistší a hladší vzhled. Vhodná samostatně i jako doplněk k jiné službě.",
    seoDescription:
      "Depilace horního rtu a brady pro hladší a čistší vzhled obličeje.",
  },
  "depilace-periferii": {
    publicName: "Depilace vybraných partií obličeje",
    intro:
      "Úprava menších oblastí podle individuální potřeby. Pomáhá dotáhnout celkový dojem do čistého výsledku.",
    seoDescription:
      "Depilace vybraných partií obličeje podle individuální potřeby.",
  },
  "depilace-cele-nohy": {
    publicName: "Depilace celých nohou",
    intro:
      "Služba pro hladký vzhled nohou a příjemný pocit lehkosti. Praktická volba pro pravidelnou péči.",
    seoDescription:
      "Depilace celých nohou pro hladký vzhled a pravidelnou péči.",
  },
  "depilace-ruce": {
    publicName: "Depilace rukou",
    intro:
      "Jemná úprava pro hladší vzhled pokožky rukou. Vhodná pro ženy, které chtějí čistý a pěstěný výsledek.",
    seoDescription:
      "Depilace rukou pro hladší vzhled a pěstěný výsledek.",
  },
  "denni-liceni": {
    publicName: "Denní líčení",
    intro:
      "Lehký styl líčení pro den, práci nebo schůzku, kdy chcete působit upraveně a sebejistě. Výsledný look zůstává čistý a dobře nositelný.",
    seoDescription:
      "Denní líčení pro práci, schůzku nebo běžný den s čistým a nositelným výsledkem.",
  },
  "vecerni-spolecenske-liceni": {
    publicName: "Večerní a společenské líčení",
    intro:
      "Líčení pro události, kde má vzhled větší roli a prostor pro osobitější styl. Přizpůsobím ho příležitosti i tomu, v čem se cítíte dobře.",
    seoDescription:
      "Večerní a společenské líčení přizpůsobené příležitosti i osobnímu stylu.",
  },
};

function formatPrice(value: number | null) {
  if (value === null) {
    return "Na dotaz";
  }

  return priceFormatter.format(value);
}

function buildServiceIntro(service: PublicServiceRow) {
  const override = serviceCopyBySlug[service.slug];

  if (override?.intro) {
    return override.intro;
  }

  return (
    service.shortDescription ??
    service.description ??
    `Klidná péče pro službu ${service.name.toLowerCase()}, navržená tak, aby byla srozumitelná i při rychlém rozhodnutí.`
  );
}

function buildServiceDetail(service: PublicServiceRow) {
  const override = serviceCopyBySlug[service.slug];

  if (override?.description) {
    return override.description;
  }

  return (
    override?.intro ??
    service.description ??
    service.shortDescription ??
    `Služba ${service.name.toLowerCase()} je připravená jako pečlivě vedená návštěva s důrazem na komfort a jasný výsledek.`
  );
}

function buildIdealFor(service: PublicServiceRow) {
  const publicName = serviceCopyBySlug[service.slug]?.publicName ?? service.name;

  switch (service.category.name) {
    case "Kosmetické ošetření":
      return [
        "pleť, která potřebuje vyčistit, zklidnit nebo podpořit rovnováhu",
        "návštěvu zvolenou podle aktuální kondice pleti",
        `${publicName.toLowerCase()} jako pravidelnou péči i promyšlený restart`,
      ];
    case "Lash & brow bar":
    case "Úprava řas a obočí":
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
    case "Vizážistika a líčení":
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
  switch (service.category.name) {
    case "Kosmetické ošetření":
      return [
        "krátké zhodnocení pleti a volbu vhodného postupu",
        `péči vedenou v rozsahu přibližně ${service.durationMinutes} minut`,
        "doporučení k navazující nebo domácí péči",
      ];
    case "Lash & brow bar":
    case "Úprava řas a obočí":
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
    case "Vizážistika a líčení":
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
  switch (service.category.name) {
    case "Kosmetické ošetření":
      return [
        "větší komfort pleti a srozumitelnější směr další péče",
        `služba s délkou ${service.durationMinutes} minut a cenou od ${formatPrice(service.priceFromCzk)}`,
        "pocit, že pleť dostala to, co právě potřebovala",
      ];
    case "Lash & brow bar":
    case "Úprava řas a obočí":
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
    case "Vizážistika a líčení":
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
  return `Autentický detail ${service.name.toLowerCase()} v prostoru salonu, jemné světlo, čisté prostředí a minimum stock vzhledu.`;
}

function mapService(service: PublicServiceRow): Service {
  return {
    slug: service.slug,
    name: serviceCopyBySlug[service.slug]?.publicName ?? service.name,
    category: categoryPublicNameMap[service.category.name] ?? service.category.name,
    priceFrom: formatPrice(service.priceFromCzk),
    duration: `${service.durationMinutes} min`,
    intro: buildServiceIntro(service),
    description: buildServiceDetail(service),
    idealFor: buildIdealFor(service),
    includes: buildIncludes(service),
    results: buildResults(service),
    placeholderAssetBrief: buildPlaceholderBrief(service),
    seoDescription: serviceCopyBySlug[service.slug]?.seoDescription ?? buildServiceIntro(service),
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
