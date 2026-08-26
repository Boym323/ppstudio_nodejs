import { MediaCollectionType } from '@/generated/prisma/browser';

import { prisma } from '@/lib/prisma';
import { moveMediaCollectionItem } from './media-collection-order';
import { isPublicMediaAsset } from './public-media-asset';

export type ReferenceCollectionMetadata = {
  isVisible: boolean;
  altText: string | null;
  caption: string | null;
};

async function referencesCollection() {
  return prisma.mediaCollection.upsert({
    where: { type: MediaCollectionType.REFERENCES },
    create: { type: MediaCollectionType.REFERENCES },
    update: {},
  });
}

export async function addReferenceMedia(mediaAssetId: string) {
  const collection = await referencesCollection();
  if (!(await isPublicMediaAsset(mediaAssetId))) throw new Error('REFERENCE_MEDIA_ASSET_NOT_PUBLIC');

  // Současné přidání může mezi aggregate a create obsadit další pořadí; opakování
  // pak načte aktuální maximum. Duplicitní membership vrací existující řádek.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.mediaCollectionItem.findUnique({
          where: { collectionId_mediaAssetId: { collectionId: collection.id, mediaAssetId } },
        });
        if (existing) return existing;

        const last = await tx.mediaCollectionItem.aggregate({ where: { collectionId: collection.id }, _max: { sortOrder: true } });
        return tx.mediaCollectionItem.create({
          data: { collectionId: collection.id, mediaAssetId, sortOrder: (last._max.sortOrder ?? -1) + 1 },
        });
      });
    } catch (error) {
      if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') || attempt === 2) throw error;
    }
  }
  throw new Error('REFERENCE_MEMBERSHIP_CREATE_FAILED');
}

export async function removeReferenceMedia(id: string) {
  const collection = await referencesCollection();
  await prisma.mediaCollectionItem.deleteMany({ where: { id, collectionId: collection.id } });
}

export async function updateReferenceMedia(id: string, metadata: ReferenceCollectionMetadata) {
  const collection = await referencesCollection();
  await prisma.mediaCollectionItem.updateMany({
    where: { id, collectionId: collection.id },
    data: metadata,
  });
}

export async function moveReferenceMedia(id: string, direction: 'up' | 'down') {
  const collection = await referencesCollection();
  await prisma.$transaction((tx) => moveMediaCollectionItem(tx, collection.id, id, direction));
}
