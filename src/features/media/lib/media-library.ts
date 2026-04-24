import { MediaAssetKind, MediaAssetVisibility, MediaType } from '@prisma/client';

import { buildMediaPublicUrl } from '@/lib/media/media-config';
import { localMediaStorage } from '@/lib/media/local-media-storage';
import {
  createMediaVariants,
  normalizeOriginalMediaImage,
} from '@/lib/media/media-pipeline';
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

function withPublicUrl<
  T extends {
    isPublished: boolean;
    url: string;
    optimizedUrl: string | null;
    thumbnailUrl: string | null;
  },
>(asset: T) {
  return {
    ...asset,
    publicUrl: asset.isPublished ? asset.optimizedUrl ?? asset.url : null,
    thumbnailPublicUrl: asset.isPublished
      ? asset.thumbnailUrl ?? asset.optimizedUrl ?? asset.url
      : null,
    originalPublicUrl: asset.isPublished ? asset.url : null,
  };
}

export async function createMedia(input: MediaUploadInput) {
  const isPublished = input.isPublished ?? true;
  const visibility = MediaAssetVisibility.PUBLIC;
  const validatedFile = await validateMediaFile(input.file);
  const normalizedOriginal = await normalizeOriginalMediaImage(validatedFile);

  await localMediaStorage.ensureBaseDirectories();

  const preparedFile = localMediaStorage.prepareFile({
    file: {
      ...validatedFile,
      buffer: normalizedOriginal.buffer,
      mimeType: normalizedOriginal.mimeType,
      extension: normalizedOriginal.extension,
      sizeBytes: normalizedOriginal.sizeBytes,
    },
    type: input.type,
    visibility,
  });
  const url = buildMediaPublicUrl(preparedFile.storagePath);
  const variantPayloads = await createMediaVariants(normalizedOriginal);
  const preparedVariants = variantPayloads.map((variant) =>
    localMediaStorage.prepareVariantFile({
      variant: variant.variant,
      source: preparedFile,
      buffer: variant.buffer,
      mimeType: variant.mimeType,
      extension: variant.extension,
      sizeBytes: variant.sizeBytes,
      width: variant.width,
      height: variant.height,
    }),
  );

  await localMediaStorage.writeFile({
    ...preparedFile,
    visibility,
  });
  await Promise.all(
    preparedVariants.map((variant) =>
      localMediaStorage.writeVariantFile({
        ...variant,
        visibility,
      }),
    ),
  );

  const optimizedVariant = preparedVariants.find((variant) => variant.variant === 'optimized') ?? null;
  const thumbnailVariant = preparedVariants.find((variant) => variant.variant === 'thumbnail') ?? null;

  try {
    const asset = await createMediaAsset({
      type: input.type,
      kind: legacyKindForType(input.type),
      visibility,
      storageProvider: 'LOCAL',
      originalFilename: validatedFile.originalFilename,
      fileName: preparedFile.storedFilename,
      storedFilename: preparedFile.storedFilename,
      mimeType: preparedFile.mimeType,
      extension: preparedFile.extension,
      sizeBytes: preparedFile.sizeBytes,
      size: preparedFile.sizeBytes,
      width: normalizedOriginal.width,
      height: normalizedOriginal.height,
      alt: normalizeMediaText(input.altText),
      altText: normalizeMediaText(input.altText),
      title: normalizeMediaText(input.title),
      storagePath: preparedFile.storagePath,
      url,
      optimizedStoragePath: optimizedVariant?.storagePath ?? null,
      optimizedUrl: optimizedVariant ? buildMediaPublicUrl(optimizedVariant.storagePath) : null,
      optimizedMimeType: optimizedVariant?.mimeType ?? null,
      optimizedWidth: optimizedVariant?.width ?? null,
      optimizedHeight: optimizedVariant?.height ?? null,
      optimizedSize: optimizedVariant?.sizeBytes ?? null,
      thumbnailStoragePath: thumbnailVariant?.storagePath ?? null,
      thumbnailUrl: thumbnailVariant ? buildMediaPublicUrl(thumbnailVariant.storagePath) : null,
      thumbnailMimeType: thumbnailVariant?.mimeType ?? null,
      thumbnailWidth: thumbnailVariant?.width ?? null,
      thumbnailHeight: thumbnailVariant?.height ?? null,
      thumbnailSize: thumbnailVariant?.sizeBytes ?? null,
      isPublished,
    });

    return withPublicUrl(asset);
  } catch (error) {
    await Promise.all([
      localMediaStorage.deleteFile({
        visibility,
        storagePath: preparedFile.storagePath,
        storedFilename: preparedFile.storedFilename,
        mimeType: preparedFile.mimeType,
        sizeBytes: preparedFile.sizeBytes,
      }),
      ...preparedVariants.map((variant) =>
        localMediaStorage.deleteFile({
          visibility,
          storagePath: variant.storagePath,
          storedFilename: variant.storedFilename,
          mimeType: variant.mimeType,
          sizeBytes: variant.sizeBytes,
        }),
      ),
    ]);

    throw error;
  }
}

export async function listMedia(type?: MediaType) {
  const assets = await listMediaAssets(type);
  return assets.map(withPublicUrl);
}

export async function listPublishedMedia(type?: MediaType) {
  const assets = await listPublicMediaAssets(type);
  return assets.map((asset) => ({
    ...asset,
    publicUrl: asset.optimizedUrl ?? asset.url,
    thumbnailPublicUrl: asset.thumbnailUrl ?? asset.optimizedUrl ?? asset.url,
    originalPublicUrl: asset.url,
  }));
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
    ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
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
  if (asset.optimizedStoragePath && asset.optimizedMimeType && asset.optimizedSize) {
    await localMediaStorage.deleteFile({
      visibility: asset.visibility,
      storagePath: asset.optimizedStoragePath,
      storedFilename: asset.optimizedStoragePath.split('/').pop() ?? asset.storedFilename,
      mimeType: asset.optimizedMimeType,
      sizeBytes: asset.optimizedSize,
    });
  }
  if (asset.thumbnailStoragePath && asset.thumbnailMimeType && asset.thumbnailSize) {
    await localMediaStorage.deleteFile({
      visibility: asset.visibility,
      storagePath: asset.thumbnailStoragePath,
      storedFilename: asset.thumbnailStoragePath.split('/').pop() ?? asset.storedFilename,
      mimeType: asset.thumbnailMimeType,
      sizeBytes: asset.thumbnailSize,
    });
  }

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
