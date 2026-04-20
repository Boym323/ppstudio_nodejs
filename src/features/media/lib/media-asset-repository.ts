import { type MediaAssetKind, type Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

export async function createMediaAsset(data: Prisma.MediaAssetUncheckedCreateInput) {
  return prisma.mediaAsset.create({ data });
}

export async function getMediaAssetById(id: string) {
  return prisma.mediaAsset.findUnique({ where: { id } });
}

export async function getPublicMediaAssetByKindAndPath(kind: MediaAssetKind, storagePath: string) {
  return prisma.mediaAsset.findFirst({
    where: {
      kind,
      visibility: 'PUBLIC',
      storagePath,
    },
  });
}

export async function listMediaAssetsByKind(kind: MediaAssetKind) {
  return prisma.mediaAsset.findMany({
    where: { kind },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listPublicMediaAssetsByKind(kind: MediaAssetKind) {
  return prisma.mediaAsset.findMany({
    where: {
      kind,
      visibility: 'PUBLIC',
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function deleteMediaAsset(id: string) {
  return prisma.mediaAsset.delete({ where: { id } });
}
