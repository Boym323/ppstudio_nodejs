import type { Prisma } from '@/generated/prisma/client';

import { prisma } from '@/lib/prisma';

export type MediaAssetUsageReference = {
  source: string;
  recordId: string;
  field: string;
};

export type MediaAssetUsage = {
  isUsed: boolean;
  references: MediaAssetUsageReference[];
};

type MediaAssetUsageSource = {
  findReferences(mediaAssetId: string, db: Prisma.TransactionClient): Promise<MediaAssetUsageReference[]>;
};

/**
 * Jediné místo pro aplikační usage guard. Další relation tabulky sem přidají
 * vlastní zdroj, aniž by se měnila logika mazání.
 */
const mediaAssetUsageSources: MediaAssetUsageSource[] = [
  {
    async findReferences(mediaAssetId, db) {
      const settings = await db.siteSettings.findMany({
        where: {
          OR: [
            { voucherPdfLogoMediaId: mediaAssetId },
            { contactPhotoMediaId: mediaAssetId },
            { homePortraitMediaId: mediaAssetId },
            { aboutPortraitMediaId: mediaAssetId },
          ],
        },
        select: {
          id: true,
          voucherPdfLogoMediaId: true,
          contactPhotoMediaId: true,
          homePortraitMediaId: true,
          aboutPortraitMediaId: true,
        },
      });

      const fields = [
        'voucherPdfLogoMediaId',
        'contactPhotoMediaId',
        'homePortraitMediaId',
        'aboutPortraitMediaId',
      ] as const;

      return settings.flatMap((setting) => fields
        .filter((field) => setting[field] === mediaAssetId)
        .map((field) => ({ source: 'SiteSettings', recordId: setting.id, field })));
    },
  },
  {
    async findReferences(mediaAssetId, db) {
      const items = await db.mediaCollectionItem.findMany({
        where: { mediaAssetId },
        select: { id: true, collection: { select: { type: true } } },
      });

      return items.map((item) => ({
        source: 'MediaCollectionItem',
        recordId: item.id,
        field: item.collection.type,
      }));
    },
  },
  {
    async findReferences(mediaAssetId, db) {
      const items = await db.serviceMedia.findMany({
        where: { mediaAssetId },
        select: {
          id: true,
          role: true,
          service: { select: { name: true, slug: true } },
        },
      });

      return items.map((item) => ({
        source: 'ServiceMedia',
        recordId: item.id,
        field: `${item.role}:${item.service.name}:${item.service.slug}`,
      }));
    },
  },
];

export async function getMediaAssetUsage(id: string, db: Prisma.TransactionClient = prisma): Promise<MediaAssetUsage> {
  const references = (await Promise.all(mediaAssetUsageSources.map((source) => source.findReferences(id, db)))).flat();
  return { isUsed: references.length > 0, references };
}
