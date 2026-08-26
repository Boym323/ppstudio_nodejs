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

/** Jediné místo pro aplikační usage guard; každý zdroj pracuje hromadně. */
export async function getMediaAssetUsageBatch(ids: string[], db: Prisma.TransactionClient = prisma): Promise<Map<string, MediaAssetUsage>> {
  const uniqueIds = [...new Set(ids)];
  const usages = new Map<string, MediaAssetUsage>(uniqueIds.map((id) => [id, { isUsed: false, references: [] }]));
  if (!uniqueIds.length) return usages;

  const [settings, collectionItems, serviceItems] = await Promise.all([
    db.siteSettings.findMany({
      where: { OR: [
        { voucherPdfLogoMediaId: { in: uniqueIds } },
        { contactPhotoMediaId: { in: uniqueIds } },
        { homePortraitMediaId: { in: uniqueIds } },
        { aboutPortraitMediaId: { in: uniqueIds } },
      ] },
      select: { id: true, voucherPdfLogoMediaId: true, contactPhotoMediaId: true, homePortraitMediaId: true, aboutPortraitMediaId: true },
    }),
    db.mediaCollectionItem.findMany({
      where: { mediaAssetId: { in: uniqueIds } },
      select: { id: true, mediaAssetId: true, collection: { select: { type: true } } },
    }),
    db.serviceMedia.findMany({
      where: { mediaAssetId: { in: uniqueIds } },
      select: { id: true, mediaAssetId: true, role: true, service: { select: { name: true, slug: true } } },
    }),
  ]);

  const fields = ['voucherPdfLogoMediaId', 'contactPhotoMediaId', 'homePortraitMediaId', 'aboutPortraitMediaId'] as const;
  for (const setting of settings) {
    for (const field of fields) {
      const mediaAssetId = setting[field];
      if (mediaAssetId && usages.has(mediaAssetId)) usages.get(mediaAssetId)!.references.push({ source: 'SiteSettings', recordId: setting.id, field });
    }
  }
  for (const item of collectionItems) usages.get(item.mediaAssetId)?.references.push({ source: 'MediaCollectionItem', recordId: item.id, field: item.collection.type });
  for (const item of serviceItems) usages.get(item.mediaAssetId)?.references.push({ source: 'ServiceMedia', recordId: item.id, field: `${item.role}:${item.service.name}:${item.service.slug}` });
  for (const usage of usages.values()) usage.isUsed = usage.references.length > 0;
  return usages;
}

export async function getMediaAssetUsage(id: string, db: Prisma.TransactionClient = prisma): Promise<MediaAssetUsage> {
  return (await getMediaAssetUsageBatch([id], db)).get(id)!;
}
