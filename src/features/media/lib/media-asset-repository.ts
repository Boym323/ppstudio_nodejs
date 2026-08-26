import { MediaAssetVisibility, type Prisma } from '@/generated/prisma/client';

import { prisma } from '@/lib/prisma';

export async function createMediaAsset(data: Prisma.MediaAssetUncheckedCreateInput) {
  return prisma.mediaAsset.create({ data });
}

export async function getMediaAssetById(id: string) {
  return prisma.mediaAsset.findFirst({
    where: { id, deletionRequestedAt: null },
  });
}

export async function getPublicMediaAssetByPath(storagePath: string) {
  return prisma.mediaAsset.findFirst({
    where: {
      isPublished: true,
      visibility: MediaAssetVisibility.PUBLIC,
      deletionRequestedAt: null,
      OR: [
        { storagePath },
        { optimizedStoragePath: storagePath },
        { thumbnailStoragePath: storagePath },
      ],
    },
  });
}

export async function listMediaAssets() {
  return prisma.mediaAsset.findMany({
    where: { deletionRequestedAt: null },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
  });
}

export async function listPublicMediaAssets() {
  return prisma.mediaAsset.findMany({
    where: {
      isPublished: true,
      visibility: MediaAssetVisibility.PUBLIC,
      deletionRequestedAt: null,
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
  });
}

export async function updateMediaAsset(id: string, data: Prisma.MediaAssetUncheckedUpdateInput) {
  return prisma.mediaAsset.update({ where: { id }, data });
}

export async function markMediaAssetForDeletion(id: string) {
  return prisma.mediaAsset.update({
    where: { id },
    data: { deletionRequestedAt: new Date() },
  });
}

export async function deleteMediaAsset(id: string) {
  return prisma.mediaAsset.delete({ where: { id } });
}
