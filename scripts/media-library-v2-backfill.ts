import "dotenv/config";

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

export const COLLECTION_TYPES = ["CERTIFICATES", "STUDIO_GALLERY", "REFERENCES"] as const;

type CollectionType = (typeof COLLECTION_TYPES)[number];

type ExpectedItem = {
  mediaAssetId: string;
  isVisible: boolean;
};

export const CERTIFICATE_ASSET_IDS = [
  "cmod3lrnu0002h1o41urgylvb",
  "cmod6tg1y0000c9o4kx5tzsm7",
  "cmod6tpyx0001c9o48apynqz6",
  "cmod6u2050002c9o4ntksx58s",
  "cmod6ua2e0003c9o4dyf8pd0a",
  "cmsezuytz0001n9l15pwcjoca",
] as const;

export const VOUCHER_LOGO_ASSET_ID = "cmoqt8k10000aarlcr95bt36c";
export const HIDDEN_STUDIO_ASSET_ID = "cmoq71a3v0001arlc1c5i3woh";

// Pořadí materializuje auditované legacy sortOrder vzestupně; shodu sortOrder=1
// stabilizuje pořadí ID, protože relační pořadí už musí být jednoznačné.
export const STUDIO_ASSET_IDS = [
  HIDDEN_STUDIO_ASSET_ID,
  "cmp9x85w4000cm0l1cda89s3k",
  "cmoq75gfv0004arlcl2pfvitq",
  "cmoq73bfe0002arlcgop25wj8",
  "cmoq74d4u0003arlcvwppnkwm",
  "cmoq76gbq0005arlcwc6vdy1r",
] as const;

export const SINGULAR_MEDIA = {
  contactPhotoMediaId: "cmoq703640000arlcaaf7v5bx",
  homePortraitMediaId: "cmonaquhg000dnni1vguglowq",
  aboutPortraitMediaId: "cmod7yatk0000pvo44myd7zjp",
} as const;

const EXPECTED_ITEMS: Record<CollectionType, readonly ExpectedItem[]> = {
  CERTIFICATES: CERTIFICATE_ASSET_IDS.map((mediaAssetId) => ({ mediaAssetId, isVisible: true })),
  STUDIO_GALLERY: STUDIO_ASSET_IDS.map((mediaAssetId) => ({
    mediaAssetId,
    isVisible: mediaAssetId !== HIDDEN_STUDIO_ASSET_ID,
  })),
  REFERENCES: [],
};

type Collection = { id: string; type: CollectionType };
type CollectionItem = {
  id: string;
  collectionId: string;
  mediaAssetId: string;
  sortOrder: number;
  isVisible: boolean;
};
type SiteSettings = {
  id: string;
  voucherPdfLogoMediaId: string | null;
  contactPhotoMediaId: string | null;
  homePortraitMediaId: string | null;
  aboutPortraitMediaId: string | null;
};

export type MediaLibraryV2BackfillClient = {
  mediaAsset: {
    findMany(args: unknown): Promise<Array<{ id: string }>>;
  };
  mediaCollection: {
    findMany(args: unknown): Promise<Collection[]>;
    upsert(args: unknown): Promise<Collection>;
  };
  mediaCollectionItem: {
    findMany(args: unknown): Promise<CollectionItem[]>;
    create(args: unknown): Promise<CollectionItem>;
    update(args: unknown): Promise<CollectionItem>;
  };
  siteSettings: {
    findUnique(args: unknown): Promise<SiteSettings | null>;
    update(args: unknown): Promise<SiteSettings>;
  };
};

export type BackfillReport = {
  createdCollections: CollectionType[];
  createdMemberships: number;
  updatedMemberships: number;
  updatedSiteSettingsFields: Array<keyof typeof SINGULAR_MEDIA>;
  missingCollectionAssetIds: Partial<Record<CollectionType, string[]>>;
  missingSingularAssetIds: string[];
  siteSettingsMissing: boolean;
  voucherPdfLogoMediaId: string | null;
};

const ALL_REFERENCED_ASSET_IDS = [
  ...CERTIFICATE_ASSET_IDS,
  ...STUDIO_ASSET_IDS,
  ...Object.values(SINGULAR_MEDIA),
  VOUCHER_LOGO_ASSET_ID,
];

function describeConflicts(conflicts: string[]) {
  return [
    "Backfill zastaven kvůli neočekávanému existujícímu stavu.",
    "Žádný konflikt nebyl automaticky přepsán:",
    ...conflicts.map((conflict) => `- ${conflict}`),
  ].join("\n");
}

export async function backfillMediaLibraryV2(
  db: MediaLibraryV2BackfillClient,
): Promise<BackfillReport> {
  const [existingCollections, assets, settings] = await Promise.all([
    db.mediaCollection.findMany({
      where: { type: { in: COLLECTION_TYPES } },
      select: { id: true, type: true },
      orderBy: { type: "asc" },
    }),
    db.mediaAsset.findMany({
      where: { id: { in: ALL_REFERENCED_ASSET_IDS } },
      select: { id: true },
    }),
    db.siteSettings.findUnique({
      where: { id: "site-settings" },
      select: {
        id: true,
        voucherPdfLogoMediaId: true,
        contactPhotoMediaId: true,
        homePortraitMediaId: true,
        aboutPortraitMediaId: true,
      },
    }),
  ]);

  const initialCollectionTypes = new Set(existingCollections.map(({ type }) => type));
  const collections = await Promise.all(COLLECTION_TYPES.map((type) =>
    db.mediaCollection.upsert({
      where: { type },
      create: { type },
      update: {},
      select: { id: true, type: true },
    })));
  const collectionByType = new Map(collections.map((collection) => [collection.type, collection]));
  const collectionTypeById = new Map(collections.map((collection) => [collection.id, collection.type]));
  const items = await db.mediaCollectionItem.findMany({
    where: { collectionId: { in: collections.map(({ id }) => id) } },
    select: {
      id: true,
      collectionId: true,
      mediaAssetId: true,
      sortOrder: true,
      isVisible: true,
    },
    orderBy: [{ collectionId: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
  });

  const foundAssetIds = new Set(assets.map(({ id }) => id));
  const conflicts: string[] = [];

  for (const item of items) {
    const type = collectionTypeById.get(item.collectionId);
    if (!type) {
      conflicts.push(`membership ${item.id} odkazuje na neznámou backfill kolekci`);
      continue;
    }

    const allowedIds = new Set(EXPECTED_ITEMS[type].map(({ mediaAssetId }) => mediaAssetId));
    if (!allowedIds.has(item.mediaAssetId)) {
      conflicts.push(`${type} obsahuje neočekávaný asset ${item.mediaAssetId}`);
    }
  }

  if (settings) {
    for (const [field, expectedAssetId] of Object.entries(SINGULAR_MEDIA) as Array<
      [keyof typeof SINGULAR_MEDIA, string]
    >) {
      const currentAssetId = settings[field];
      if (foundAssetIds.has(expectedAssetId) && currentAssetId && currentAssetId !== expectedAssetId) {
        conflicts.push(`${field} už odkazuje na jiný asset ${currentAssetId}`);
      }
    }
  }

  if (conflicts.length > 0) {
    throw new Error(describeConflicts(conflicts));
  }

  const report: BackfillReport = {
    createdCollections: COLLECTION_TYPES.filter((type) => !initialCollectionTypes.has(type)),
    createdMemberships: 0,
    updatedMemberships: 0,
    updatedSiteSettingsFields: [],
    missingCollectionAssetIds: {},
    missingSingularAssetIds: [],
    siteSettingsMissing: !settings,
    voucherPdfLogoMediaId: settings?.voucherPdfLogoMediaId ?? null,
  };

  for (const type of COLLECTION_TYPES) {
    const collection = collectionByType.get(type);
    if (!collection) {
      throw new Error(`Interní chyba: chybí kolekce ${type}.`);
    }

    const configuredItems = EXPECTED_ITEMS[type];
    const expectedItems = configuredItems.filter(({ mediaAssetId }) => foundAssetIds.has(mediaAssetId));
    const missingIds = configuredItems
      .filter(({ mediaAssetId }) => !foundAssetIds.has(mediaAssetId))
      .map(({ mediaAssetId }) => mediaAssetId);
    if (missingIds.length > 0) {
      report.missingCollectionAssetIds[type] = missingIds;
    }

    const currentItems = items.filter(({ collectionId }) => collectionId === collection.id);
    const currentByAssetId = new Map(currentItems.map((item) => [item.mediaAssetId, item]));
    const needsChange = expectedItems.some((expected, sortOrder) => {
      const current = currentByAssetId.get(expected.mediaAssetId);
      return !current || current.sortOrder !== sortOrder || current.isVisible !== expected.isVisible;
    });

    if (!needsChange) {
      continue;
    }

    const temporaryStart = Math.min(-1, ...currentItems.map(({ sortOrder }) => sortOrder))
      - currentItems.length
      - 1;
    for (const [index, item] of currentItems.entries()) {
      await db.mediaCollectionItem.update({
        where: { id: item.id },
        data: { sortOrder: temporaryStart + index },
      });
    }

    for (const [sortOrder, expected] of expectedItems.entries()) {
      const current = currentByAssetId.get(expected.mediaAssetId);
      if (current) {
        if (current.sortOrder !== sortOrder || current.isVisible !== expected.isVisible) {
          report.updatedMemberships += 1;
        }
        await db.mediaCollectionItem.update({
          where: { id: current.id },
          data: { sortOrder, isVisible: expected.isVisible },
        });
      } else {
        await db.mediaCollectionItem.create({
          data: {
            collectionId: collection.id,
            mediaAssetId: expected.mediaAssetId,
            sortOrder,
            isVisible: expected.isVisible,
          },
        });
        report.createdMemberships += 1;
      }
    }
  }

  if (settings) {
    const data: Partial<Record<keyof typeof SINGULAR_MEDIA, string>> = {};
    for (const [field, expectedAssetId] of Object.entries(SINGULAR_MEDIA) as Array<
      [keyof typeof SINGULAR_MEDIA, string]
    >) {
      if (!foundAssetIds.has(expectedAssetId)) {
        report.missingSingularAssetIds.push(expectedAssetId);
      } else if (settings[field] !== expectedAssetId) {
        data[field] = expectedAssetId;
        report.updatedSiteSettingsFields.push(field);
      }
    }

    if (Object.keys(data).length > 0) {
      await db.siteSettings.update({ where: { id: settings.id }, data });
    }
  } else {
    report.missingSingularAssetIds.push(...Object.values(SINGULAR_MEDIA));
  }

  return report;
}

export function assertAllowedBackfillDatabase(databaseUrl: string, actualDatabase?: string) {
  const configuredDatabase = decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
  const isAllowed = (database: string) => database === "ppstudio_dev" || database.endsWith("_test");

  if (!isAllowed(configuredDatabase)) {
    throw new Error(`Backfill je povolen pouze pro ppstudio_dev nebo *_test DB; nakonfigurováno: ${configuredDatabase || "(prázdné)"}.`);
  }
  if (actualDatabase !== undefined && (!isAllowed(actualDatabase) || actualDatabase !== configuredDatabase)) {
    throw new Error(`Identita připojené DB neodpovídá povolené konfiguraci (${configuredDatabase} != ${actualDatabase}).`);
  }
}

function printReport(report: BackfillReport, dryRun: boolean) {
  console.log(dryRun ? "Dry-run dokončen; transakce byla vrácena zpět." : "Backfill dokončen a potvrzen.");
  console.log(`Nové kolekce: ${report.createdCollections.join(", ") || "žádné"}`);
  console.log(`Membershipy: vytvořeno ${report.createdMemberships}, dorovnáno ${report.updatedMemberships}`);
  console.log(`SiteSettings FK: ${report.updatedSiteSettingsFields.join(", ") || "beze změny"}`);
  console.log(`voucherPdfLogoMediaId ponecháno: ${report.voucherPdfLogoMediaId ?? "null"}`);

  const missingCollectionIds = Object.entries(report.missingCollectionAssetIds)
    .flatMap(([type, ids]) => (ids ?? []).map((id) => `${type}:${id}`));
  console.log(`Chybějící kolekční assety: ${missingCollectionIds.join(", ") || "žádné"}`);
  console.log(`Chybějící singularní assety: ${report.missingSingularAssetIds.join(", ") || "žádné"}`);
  if (report.siteSettingsMissing) {
    console.log("SiteSettings 'site-settings' chybí; singularní FK byly přeskočeny.");
  }
}

class DryRunRollback extends Error {
  constructor(readonly report: BackfillReport) {
    super("MEDIA_LIBRARY_V2_DRY_RUN_ROLLBACK");
  }
}

async function main() {
  const confirm = process.argv.slice(2).includes("--confirm");
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL není nastavené.");
  }
  assertAllowedBackfillDatabase(databaseUrl);

  const prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl) });
  try {
    const identity = await prisma.$queryRaw<Array<{ database: string }>>`SELECT current_database() AS database`;
    const actualDatabase = identity[0]?.database;
    if (!actualDatabase) {
      throw new Error("Nepodařilo se ověřit identitu připojené DB.");
    }
    assertAllowedBackfillDatabase(databaseUrl, actualDatabase);

    try {
      const report = await prisma.$transaction(async (transaction) => {
        const result = await backfillMediaLibraryV2(transaction as unknown as MediaLibraryV2BackfillClient);
        if (!confirm) {
          throw new DryRunRollback(result);
        }
        return result;
      });
      printReport(report, false);
    } catch (error) {
      if (error instanceof DryRunRollback) {
        printReport(error.report, true);
        console.log("Ostré spuštění: npm run db:backfill-media-library-v2 -- --confirm");
        return;
      }
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

const invokedPath = process.argv[1];
if (invokedPath && fileURLToPath(import.meta.url) === resolve(invokedPath)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
