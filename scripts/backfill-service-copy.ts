import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { serviceCopyOverrides } from "../src/features/public/lib/service-copy-overrides";

type Args = {
  confirm: boolean;
  dryRun: boolean;
};

type StructuredCopyUpdate = {
  seoTitle: string;
  idealFor: string[];
  includes: string[];
  benefits: string[];
  goodToKnow: string[];
};

const FIELD_LIMITS = {
  seoTitle: 120,
  listMaxItems: 8,
  listItemMaxLength: 240,
} as const;

function parseArgs(argv: string[]): Args {
  const confirm = argv.includes("--confirm");
  const dryRun = argv.includes("--dry-run") || !confirm;

  return { confirm, dryRun };
}

function buildStructuredCopyUpdate(slug: string): StructuredCopyUpdate {
  const copy = serviceCopyOverrides[slug];

  return {
    seoTitle: copy.seoTitle,
    idealFor: copy.idealFor,
    includes: copy.includes,
    benefits: copy.results,
    goodToKnow: copy.goodToKnow,
  };
}

function validateStructuredCopy(slug: string, update: StructuredCopyUpdate) {
  const errors: string[] = [];

  if (update.seoTitle.length > FIELD_LIMITS.seoTitle) {
    errors.push(`${slug}.seoTitle: ${update.seoTitle.length}/${FIELD_LIMITS.seoTitle}`);
  }

  for (const field of ["idealFor", "includes", "benefits", "goodToKnow"] as const) {
    const items = update[field];

    if (items.length > FIELD_LIMITS.listMaxItems) {
      errors.push(`${slug}.${field}: ${items.length}/${FIELD_LIMITS.listMaxItems} položek`);
    }

    items.forEach((item, index) => {
      if (item.trim() !== item || item.length === 0) {
        errors.push(`${slug}.${field}[${index}]: položka není čistě trimovaný plain text`);
      }

      if (item.length > FIELD_LIMITS.listItemMaxLength) {
        errors.push(`${slug}.${field}[${index}]: ${item.length}/${FIELD_LIMITS.listItemMaxLength}`);
      }
    });
  }

  if (errors.length > 0) {
    throw new Error(`Některé texty překračují limity admin validace:\n${errors.join("\n")}`);
  }
}

function sameStringArray(left: string[], right: string[]) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function describeChangedFields(
  current: StructuredCopyUpdate,
  next: StructuredCopyUpdate,
): Array<keyof StructuredCopyUpdate> {
  return (Object.keys(next) as Array<keyof StructuredCopyUpdate>).filter((field) => {
    if (Array.isArray(next[field])) {
      return !sameStringArray(current[field] as string[], next[field] as string[]);
    }

    return current[field] !== next[field];
  });
}

async function main() {
  const { confirm, dryRun } = parseArgs(process.argv.slice(2));

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing.");
  }

  const slugs = Object.keys(serviceCopyOverrides);
  const plannedUpdates = new Map(slugs.map((slug) => {
    const update = buildStructuredCopyUpdate(slug);
    validateStructuredCopy(slug, update);

    return [slug, update] as const;
  }));

  const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL) });

  try {
    const services = await prisma.service.findMany({
      where: {
        slug: {
          in: slugs,
        },
      },
      orderBy: [{ slug: "asc" }],
      select: {
        slug: true,
        name: true,
        seoTitle: true,
        idealFor: true,
        includes: true,
        benefits: true,
        goodToKnow: true,
      },
    });

    const foundSlugs = new Set(services.map((service) => service.slug));
    const missingSlugs = slugs.filter((slug) => !foundSlugs.has(slug));

    if (missingSlugs.length > 0) {
      throw new Error(
        [
          "Backfill zastaven: v DB chybí některé známé služby.",
          "Skript záměrně nezasahuje neznámé ani chybějící položky.",
          `Chybějící slugy: ${missingSlugs.join(", ")}`,
        ].join("\n"),
      );
    }

    const changes = services.map((service) => {
      const next = plannedUpdates.get(service.slug);

      if (!next) {
        throw new Error(`Interní chyba: pro slug ${service.slug} není připravený text.`);
      }

      const current: StructuredCopyUpdate = {
        seoTitle: service.seoTitle ?? "",
        idealFor: service.idealFor,
        includes: service.includes,
        benefits: service.benefits,
        goodToKnow: service.goodToKnow,
      };
      const changedFields = describeChangedFields(current, next);

      return {
        slug: service.slug,
        name: service.name,
        next,
        changedFields,
      };
    });

    const changed = changes.filter((change) => change.changedFields.length > 0);

    console.log(`Připraveno služeb k ověření: ${slugs.length}`);
    console.log(`Nalezeno v DB: ${services.length}`);
    console.log(`Služby se změnou strukturovaného obsahu: ${changed.length}`);

    for (const change of changes) {
      const status = change.changedFields.length > 0 ? change.changedFields.join(", ") : "beze změny";
      console.log(`- ${change.slug} (${change.name}): ${status}`);
    }

    if (dryRun) {
      console.log("");
      console.log("Dry-run režim: DB nebyla změněna.");
      console.log("Před ostrým spuštěním udělejte zálohu produkční DB.");
      console.log("Ostré spuštění: npm run db:backfill-service-copy -- --confirm");
      return;
    }

    if (!confirm) {
      throw new Error("Ostrý zápis vyžaduje explicitní přepínač --confirm.");
    }

    await prisma.$transaction(
      changed.map((change) =>
        prisma.service.update({
          where: {
            slug: change.slug,
          },
          data: change.next,
        }),
      ),
    );

    console.log("");
    console.log(`Hotovo: aktualizováno ${changed.length} služeb.`);
    console.log("Změněná pole: seoTitle, idealFor, includes, benefits, goodToKnow.");
    console.log("Ceny, délky, slugy, ID, aktivita, dostupnost, kategorie, pořadí ani názvy nebyly měněny.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
