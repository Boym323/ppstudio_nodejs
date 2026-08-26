import type { Prisma } from '@/generated/prisma/client';

import { prisma } from '@/lib/prisma';

export const publicMediaAssetWhere = {
  visibility: 'PUBLIC' as const,
  isPublished: true,
  deletionRequestedAt: null,
};

/** Kontrola pro nové vazby, které se mohou zobrazit na veřejném webu. */
export async function isPublicMediaAsset(mediaAssetId: string, db: Prisma.TransactionClient = prisma) {
  return Boolean(await db.mediaAsset.findFirst({
    where: { id: mediaAssetId, ...publicMediaAssetWhere },
    select: { id: true },
  }));
}
