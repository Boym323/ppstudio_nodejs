import { type MediaType, type Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

export async function createMediaAsset(data: Prisma.MediaAssetUncheckedCreateInput) {
  return prisma.mediaAsset.create({ data });
}

export async function getMediaAssetById(id: string) {
  return prisma.mediaAsset.findUnique({ where: { id } });
}

export async function getPublicMediaAssetByTypeAndPath(type: MediaType, storagePath: string) {
  return prisma.mediaAsset.findFirst({
    where: {
      type,
      isPublished: true,
      OR: [
        { storagePath },
        { optimizedStoragePath: storagePath },
        { thumbnailStoragePath: storagePath },
      ],
    },
  });
}

export async function getPublicMediaAssetByPath(storagePath: string) {
  return prisma.mediaAsset.findFirst({
    where: {
      isPublished: true,
      OR: [
        { storagePath },
        { optimizedStoragePath: storagePath },
        { thumbnailStoragePath: storagePath },
      ],
    },
  });
}

export async function listMediaAssets(type?: MediaType) {
  return prisma.mediaAsset.findMany({
    where: type ? { type } : undefined,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });
}

export async function listPublicMediaAssets(type?: MediaType) {
  return prisma.mediaAsset.findMany({
    where: {
      ...(type ? { type } : {}),
      isPublished: true,
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });
}

export async function updateMediaAsset(id: string, data: Prisma.MediaAssetUncheckedUpdateInput) {
  return prisma.mediaAsset.update({ where: { id }, data });
}

export async function deleteMediaAsset(id: string) {
  return prisma.mediaAsset.delete({ where: { id } });
}

export const getPublicMediaAssetByKindAndPath = getPublicMediaAssetByTypeAndPath;
export const listMediaAssetsByKind = listMediaAssets;
export const listPublicMediaAssetsByKind = listPublicMediaAssets;
