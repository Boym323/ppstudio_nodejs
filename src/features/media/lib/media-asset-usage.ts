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
  findReferences(mediaAssetId: string): Promise<MediaAssetUsageReference[]>;
};

/**
 * Jediné místo pro aplikační usage guard. Další relation tabulky sem přidají
 * vlastní zdroj, aniž by se měnila logika mazání.
 */
const mediaAssetUsageSources: MediaAssetUsageSource[] = [
  {
    async findReferences(mediaAssetId) {
      const settings = await prisma.siteSettings.findMany({
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
    async findReferences(mediaAssetId) {
      const items = await prisma.mediaCollectionItem.findMany({
        where: { mediaAssetId },
        select: { id: true },
      });

      return items.map((item) => ({
        source: 'MediaCollectionItem',
        recordId: item.id,
        field: 'mediaAssetId',
      }));
    },
  },
  {
    async findReferences(mediaAssetId) {
      const items = await prisma.serviceMedia.findMany({
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

export async function getMediaAssetUsage(id: string): Promise<MediaAssetUsage> {
  const references = (await Promise.all(mediaAssetUsageSources.map((source) => source.findReferences(id)))).flat();
  return { isUsed: references.length > 0, references };
}
