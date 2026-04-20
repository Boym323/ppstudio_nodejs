import { MediaAssetVisibility, type MediaAssetKind } from '@prisma/client';

import { buildMediaPublicUrl } from '@/lib/media/media-config';
import { readImageMetadata } from '@/lib/media/media-image';
import { localMediaStorage } from '@/lib/media/local-media-storage';
import type { MediaUploadInput } from '@/lib/media/media-types';
import { validateMediaFile } from '@/lib/media/media-validation';

import {
  createMediaAsset,
  deleteMediaAsset,
  getMediaAssetById,
  listMediaAssetsByKind,
  listPublicMediaAssetsByKind,
} from './media-asset-repository';

export function normalizeMediaText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export async function saveMediaAsset(input: MediaUploadInput) {
  const visibility = input.visibility ?? MediaAssetVisibility.PUBLIC;
  const validatedFile = await validateMediaFile(input.file);

  await localMediaStorage.ensureBaseDirectories();

  const preparedFile = localMediaStorage.prepareFile({
    file: validatedFile,
    kind: input.kind,
    visibility,
  });
  const imageMetadata = readImageMetadata(validatedFile.buffer, validatedFile.mimeType);

  await localMediaStorage.writeFile({
    ...preparedFile,
    visibility,
  });

  try {
    const asset = await createMediaAsset({
      kind: input.kind,
      visibility,
      storageProvider: 'LOCAL',
      originalFilename: validatedFile.originalFilename,
      storedFilename: preparedFile.storedFilename,
      mimeType: validatedFile.mimeType,
      extension: validatedFile.extension,
      sizeBytes: validatedFile.sizeBytes,
      width: imageMetadata.width,
      height: imageMetadata.height,
      alt: normalizeMediaText(input.alt),
      title: normalizeMediaText(input.title),
      storagePath: preparedFile.storagePath,
    });

    return {
      ...asset,
      publicUrl:
        asset.visibility === MediaAssetVisibility.PUBLIC
          ? buildMediaPublicUrl(asset.storagePath)
          : null,
    };
  } catch (error) {
    await localMediaStorage.deleteFile({
      visibility,
      kind: input.kind,
      storagePath: preparedFile.storagePath,
      storedFilename: preparedFile.storedFilename,
      mimeType: preparedFile.mimeType,
      sizeBytes: preparedFile.sizeBytes,
    });

    throw error;
  }
}

export async function removeMediaAsset(id: string) {
  const asset = await getMediaAssetById(id);

  if (!asset) {
    throw new Error('MEDIA_ASSET_NOT_FOUND');
  }

  await localMediaStorage.deleteFile({
    visibility: asset.visibility,
    kind: asset.kind,
    storagePath: asset.storagePath,
    storedFilename: asset.storedFilename,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
  });

  await deleteMediaAsset(asset.id);
}

export async function replaceMediaAsset(id: string, input: MediaUploadInput) {
  const nextAsset = await saveMediaAsset(input);

  try {
    await removeMediaAsset(id);
  } catch (error) {
    await removeMediaAsset(nextAsset.id);
    throw error;
  }

  return nextAsset;
}

export async function getMediaLibraryByKind(kind: MediaAssetKind) {
  const assets = await listMediaAssetsByKind(kind);

  return assets.map((asset) => ({
    ...asset,
    publicUrl:
      asset.visibility === MediaAssetVisibility.PUBLIC
        ? buildMediaPublicUrl(asset.storagePath)
        : null,
  }));
}

export async function getPublicMediaLibraryByKind(kind: MediaAssetKind) {
  const assets = await listPublicMediaAssetsByKind(kind);

  return assets.map((asset) => ({
    ...asset,
    publicUrl: buildMediaPublicUrl(asset.storagePath),
  }));
}

export async function ensureMediaStorageReady() {
  await localMediaStorage.ensureBaseDirectories();
}
