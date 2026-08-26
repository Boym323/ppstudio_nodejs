import type { Prisma } from '@/generated/prisma/client';

import { isPublicMediaAsset } from './public-media-asset';

/** Přepíše pořadí přes dočasné záporné hodnoty, aby nikdy nenarazilo na unique(collectionId, sortOrder). */
export async function moveMediaCollectionItem(tx: Prisma.TransactionClient, collectionId: string, id: string, direction: 'up' | 'down') {
  const rows = await tx.mediaCollectionItem.findMany({
    where: { collectionId },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { id: true, sortOrder: true },
  });
  const index = rows.findIndex((row) => row.id === id);
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= rows.length) return;

  const reordered = [...rows];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  const minimum = Math.min(...rows.map((row) => row.sortOrder), 0);
  await Promise.all(reordered.map((row, position) => tx.mediaCollectionItem.update({
    where: { id: row.id }, data: { sortOrder: minimum - position - 1 },
  })));
  await Promise.all(reordered.map((row, position) => tx.mediaCollectionItem.update({
    where: { id: row.id }, data: { sortOrder: position },
  })));
}

/** Nové membershipy vždy zařadí na konec; existující pouze upraví viditelnost. */
export async function saveMediaCollectionMembership(
  tx: Prisma.TransactionClient,
  collectionId: string,
  mediaAssetId: string,
  isVisible: boolean,
  options?: { requirePublicAsset?: boolean },
) {
  const existing = await tx.mediaCollectionItem.findUnique({
    where: { collectionId_mediaAssetId: { collectionId, mediaAssetId } },
    select: { id: true },
  });
  if (existing) return tx.mediaCollectionItem.update({ where: { id: existing.id }, data: { isVisible } });

  if (options?.requirePublicAsset && !(await isPublicMediaAsset(mediaAssetId, tx))) return null;

  const last = await tx.mediaCollectionItem.aggregate({ where: { collectionId }, _max: { sortOrder: true } });
  return tx.mediaCollectionItem.create({
    data: { collectionId, mediaAssetId, isVisible, sortOrder: (last._max.sortOrder ?? -1) + 1 },
  });
}
