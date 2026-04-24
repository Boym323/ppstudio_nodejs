import { MediaAssetKind, MediaAssetVisibility, MediaType } from '@prisma/client';

import { buildMediaPublicUrl } from '@/lib/media/media-config';
import { readImageMetadata } from '@/lib/media/media-image';
import { localMediaStorage } from '@/lib/media/local-media-storage';
import type { MediaUploadInput } from '@/lib/media/media-types';
import { validateMediaFile } from '@/lib/media/media-validation';

import {
  createMediaAsset,
  deleteMediaAsset,
  getMediaAssetById,
  listMediaAssets,
  listPublicMediaAssets,
  updateMediaAsset,
} from './media-asset-repository';

export function normalizeMediaText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function legacyKindForType(type: MediaType) {
  switch (type) {
    case MediaType.CERTIFICATE:
      return MediaAssetKind.CERTIFICATE;
    case MediaType.SALON_PHOTO:
      return MediaAssetKind.SPACE;
    case MediaType.PORTRAIT:
    case MediaType.GENERAL:
      return MediaAssetKind.CONTENT;
  }
}

function visibilityForPublished(isPublished: boolean) {
  return isPublished ? MediaAssetVisibility.PUBLIC : MediaAssetVisibility.PRIVATE;
}

function withPublicUrl<T extends { isPublished: boolean; url: string }>(asset: T) {
  return {
    ...asset,
    publicUrl: asset.isPublished ? asset.url : null,
  };
}

export async function createMedia(input: MediaUploadInput) {
  const isPublished = input.isPublished ?? true;
  const visibility = input.visibility ?? visibilityForPublished(isPublished);
  const validatedFile = await validateMediaFile(input.file);

  await localMediaStorage.ensureBaseDirectories();

  const preparedFile = localMediaStorage.prepareFile({
    file: validatedFile,
    type: input.type,
    visibility,
  });
  const imageMetadata = readImageMetadata(validatedFile.buffer, validatedFile.mimeType);
  const url = buildMediaPublicUrl(preparedFile.storagePath);

  await localMediaStorage.writeFile({
    ...preparedFile,
    visibility,
  });

  try {
    const asset = await createMediaAsset({
      type: input.type,
      kind: legacyKindForType(input.type),
      visibility,
      storageProvider: 'LOCAL',
      originalFilename: validatedFile.originalFilename,
      fileName: validatedFile.originalFilename,
      storedFilename: preparedFile.storedFilename,
      mimeType: validatedFile.mimeType,
      extension: validatedFile.extension,
      sizeBytes: validatedFile.sizeBytes,
      size: validatedFile.sizeBytes,
      width: imageMetadata.width,
      height: imageMetadata.height,
      alt: normalizeMediaText(input.altText),
      altText: normalizeMediaText(input.altText),
      title: normalizeMediaText(input.title),
      storagePath: preparedFile.storagePath,
      url,
      isPublished,
    });

    return withPublicUrl(asset);
  } catch (error) {
    await localMediaStorage.deleteFile({
      visibility,
      storagePath: preparedFile.storagePath,
      storedFilename: preparedFile.storedFilename,
      mimeType: preparedFile.mimeType,
      sizeBytes: preparedFile.sizeBytes,
    });

    throw error;
  }
}

export async function listMedia(type?: MediaType) {
  const assets = await listMediaAssets(type);
  return assets.map(withPublicUrl);
}

export async function listPublishedMedia(type?: MediaType) {
  const assets = await listPublicMediaAssets(type);
  return assets.map((asset) => ({ ...asset, publicUrl: asset.url }));
}

export async function updateMedia(
  id: string,
  input: {
    type?: MediaType;
    title?: string | null;
    altText?: string | null;
    isPublished?: boolean;
  },
) {
  const data = {
    ...(input.type ? { type: input.type, kind: legacyKindForType(input.type) } : {}),
    ...(input.title !== undefined ? { title: normalizeMediaText(input.title) } : {}),
    ...(input.altText !== undefined
      ? { altText: normalizeMediaText(input.altText), alt: normalizeMediaText(input.altText) }
      : {}),
    ...(input.isPublished !== undefined
      ? { isPublished: input.isPublished, visibility: visibilityForPublished(input.isPublished) }
      : {}),
  };

  const asset = await updateMediaAsset(id, data);
  return withPublicUrl(asset);
}

export async function deleteMedia(id: string) {
  const asset = await getMediaAssetById(id);

  if (!asset) {
    throw new Error('MEDIA_ASSET_NOT_FOUND');
  }

  await localMediaStorage.deleteFile({
    visibility: asset.visibility,
    storagePath: asset.storagePath,
    storedFilename: asset.storedFilename,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
  });

  await deleteMediaAsset(asset.id);
}

export async function saveMediaAsset(input: MediaUploadInput) {
  return createMedia(input);
}

export async function removeMediaAsset(id: string) {
  return deleteMedia(id);
}

export async function replaceMediaAsset(id: string, input: MediaUploadInput) {
  const nextAsset = await createMedia(input);

  try {
    await deleteMedia(id);
  } catch (error) {
    await deleteMedia(nextAsset.id);
    throw error;
  }

  return nextAsset;
}

export async function getMediaLibraryByType(type: MediaType) {
  return listMedia(type);
}

export async function getPublishedMediaLibraryByType(type: MediaType) {
  return listPublishedMedia(type);
}

export async function getMediaLibraryByKind(type: MediaType) {
  return listMedia(type);
}

export async function getPublicMediaLibraryByKind(type: MediaType) {
  return listPublishedMedia(type);
}

export async function ensureMediaStorageReady() {
  await localMediaStorage.ensureBaseDirectories();
}
