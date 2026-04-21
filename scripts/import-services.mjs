import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const categorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullish(),
  publicName: z.string().nullish(),
  pricingDescription: z.string().nullish(),
  pricingLayout: z.enum(['LIST', 'GRID']).optional(),
  pricingIconKey: z.enum(['DROPLET', 'EYE_LASHES', 'LOTUS', 'BRUSH', 'LEAF', 'LIPSTICK', 'SPARK']).optional(),
  sortOrder: z.number().int().optional().default(0),
  pricingSortOrder: z.number().int().optional(),
  isActive: z.boolean().optional().default(true),
});

const serviceSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  publicName: z.string().nullish(),
  shortDescription: z.string().nullish(),
  description: z.string().nullish(),
  publicIntro: z.string().nullish(),
  seoDescription: z.string().nullish(),
  pricingShortDescription: z.string().nullish(),
  pricingBadge: z.string().nullish(),
  durationMinutes: z.number().int().positive(),
  priceFromCzk: z.number().int().positive().nullish(),
  sortOrder: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
  categorySlug: z.string().min(1).optional(),
});

const importSchema = z.object({
  categories: z.array(categorySchema).default([]),
  services: z.array(serviceSchema).default([]),
});

function parseArgs(argv) {
  const args = {
    file: null,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (value === '--file') {
      args.file = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (!args.file && !value.startsWith('--')) {
      args.file = value;
    }
  }

  return args;
}

async function loadImportFile(filePath) {
  const raw = await readFile(resolve(process.cwd(), filePath), 'utf8');
  const parsed = JSON.parse(raw);

  return importSchema.parse(parsed);
}

async function main() {
  const { file, dryRun } = parseArgs(process.argv.slice(2));

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing.');
  }

  if (!file) {
    console.error('Použití: node scripts/import-services.mjs --file <soubor.json> [--dry-run]');
    process.exitCode = 1;
    return;
  }

  const input = await loadImportFile(file);
  const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL) });

  try {
    const categoryRows = [];
    const categoryBySlug = new Map();

    for (const category of input.categories) {
      const row = {
        name: category.name,
        slug: category.slug,
        description: category.description ?? null,
        publicName: category.publicName ?? null,
        pricingDescription: category.pricingDescription ?? null,
        pricingLayout: category.pricingLayout ?? 'GRID',
        pricingIconKey: category.pricingIconKey ?? 'SPARK',
        sortOrder: category.sortOrder ?? 0,
        pricingSortOrder: category.pricingSortOrder ?? category.sortOrder ?? 0,
        isActive: category.isActive ?? true,
      };

      categoryRows.push(row);
      categoryBySlug.set(category.slug, row);
    }

    const serviceRows = [];
    for (const service of input.services) {
      const categorySlug = service.categorySlug;
      if (!categorySlug) {
        throw new Error(`Služba "${service.slug}" nemá categorySlug.`);
      }

      if (!categoryBySlug.has(categorySlug)) {
        throw new Error(`Služba "${service.slug}" odkazuje na neznámou kategorii "${categorySlug}".`);
      }

      serviceRows.push({
        name: service.name,
        slug: service.slug,
        publicName: service.publicName ?? null,
        shortDescription: service.shortDescription ?? null,
        description: service.description ?? null,
        publicIntro: service.publicIntro ?? null,
        seoDescription: service.seoDescription ?? null,
        pricingShortDescription: service.pricingShortDescription ?? null,
        pricingBadge: service.pricingBadge ?? null,
        durationMinutes: service.durationMinutes,
        priceFromCzk: service.priceFromCzk ?? null,
        sortOrder: service.sortOrder ?? 0,
        isActive: service.isActive ?? true,
        categorySlug,
      });
    }

    if (dryRun) {
      console.log(JSON.stringify({ categories: categoryRows, services: serviceRows }, null, 2));
      return;
    }

    await prisma.$transaction(async (tx) => {
      for (const category of categoryRows) {
        await tx.serviceCategory.upsert({
          where: { slug: category.slug },
          create: category,
          update: {
            name: category.name,
            description: category.description,
            publicName: category.publicName,
            pricingDescription: category.pricingDescription,
            pricingLayout: category.pricingLayout,
            pricingIconKey: category.pricingIconKey,
            sortOrder: category.sortOrder,
            pricingSortOrder: category.pricingSortOrder,
            isActive: category.isActive,
          },
        });
      }

      const categoryIds = new Map(
        (await tx.serviceCategory.findMany({
          where: { slug: { in: categoryRows.map((category) => category.slug) } },
          select: { id: true, slug: true },
        })).map((category) => [category.slug, category.id]),
      );

      for (const service of serviceRows) {
        const categoryId = categoryIds.get(service.categorySlug);
        if (!categoryId) {
          throw new Error(`Nepodařilo se dohledat categoryId pro "${service.categorySlug}".`);
        }

        await tx.service.upsert({
          where: { slug: service.slug },
          create: {
            name: service.name,
            slug: service.slug,
            publicName: service.publicName,
            shortDescription: service.shortDescription,
            description: service.description,
            publicIntro: service.publicIntro,
            seoDescription: service.seoDescription,
            pricingShortDescription: service.pricingShortDescription,
            pricingBadge: service.pricingBadge,
            durationMinutes: service.durationMinutes,
            priceFromCzk: service.priceFromCzk,
            sortOrder: service.sortOrder,
            isActive: service.isActive,
            categoryId,
          },
          update: {
            name: service.name,
            publicName: service.publicName,
            shortDescription: service.shortDescription,
            description: service.description,
            publicIntro: service.publicIntro,
            seoDescription: service.seoDescription,
            pricingShortDescription: service.pricingShortDescription,
            pricingBadge: service.pricingBadge,
            durationMinutes: service.durationMinutes,
            priceFromCzk: service.priceFromCzk,
            sortOrder: service.sortOrder,
            isActive: service.isActive,
            categoryId,
          },
        });
      }
    });

    console.log(`Import hotový: ${categoryRows.length} kategorií, ${serviceRows.length} služeb.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
