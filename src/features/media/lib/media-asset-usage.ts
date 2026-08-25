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
        where: { voucherPdfLogoMediaId: mediaAssetId },
        select: { id: true },
      });

      return settings.map((setting) => ({
        source: 'SiteSettings',
        recordId: setting.id,
        field: 'voucherPdfLogoMediaId',
      }));
    },
  },
];

export async function getMediaAssetUsage(id: string): Promise<MediaAssetUsage> {
  const references = (await Promise.all(mediaAssetUsageSources.map((source) => source.findReferences(id)))).flat();
  return { isUsed: references.length > 0, references };
}
