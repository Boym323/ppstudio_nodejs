import { MediaAssetKind, MediaAssetVisibility, MediaType } from '@/generated/prisma/browser';

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
  markMediaAssetForDeletion,
  updateMediaAsset,
} from './media-asset-repository';
import { getMediaAssetUsage } from './media-asset-usage';

export function normalizeMediaText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function legacyKindForType(type: MediaType) {
  switch (type) {
    case MediaType.CERTIFICATE:
      return MediaAssetKind.CERTIFICATE;
    case MediaType.SALON_PHOTO:
    case MediaType.CONTACT_PHOTO:
      return MediaAssetKind.SPACE;
    case MediaType.PORTRAIT:
    case MediaType.PORTRAIT_HOME:
    case MediaType.PORTRAIT_ABOUT:
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

type PreparedMediaUpload = {
  visibility: MediaAssetVisibility;
  preparedFile: Awaited<ReturnType<typeof localMediaStorage.prepareFile>>;
  preparedVariants: Awaited<ReturnType<typeof localMediaStorage.prepareVariantFile>>[];
  normalizedOriginal: Awaited<ReturnType<typeof normalizeOriginalMediaImage>>;
  validatedFile: Awaited<ReturnType<typeof validateMediaFile>>;
};

async function prepareAndWriteMediaUpload(input: MediaUploadInput): Promise<PreparedMediaUpload> {
  const visibility = MediaAssetVisibility.PUBLIC;
  const validatedFile = await validateMediaFile(input.file);
  const normalizedOriginal = await normalizeOriginalMediaImage(validatedFile);
  await localMediaStorage.ensureBaseDirectories();

  const preparedFile = localMediaStorage.prepareFile({
    file: { ...validatedFile, buffer: normalizedOriginal.buffer, mimeType: normalizedOriginal.mimeType, extension: normalizedOriginal.extension, sizeBytes: normalizedOriginal.sizeBytes },
    type: input.type,
    visibility,
  });
  const preparedVariants = (await createMediaVariants(normalizedOriginal)).map((variant) => localMediaStorage.prepareVariantFile({
    variant: variant.variant, source: preparedFile, buffer: variant.buffer, mimeType: variant.mimeType,
    extension: variant.extension, sizeBytes: variant.sizeBytes, width: variant.width, height: variant.height,
  }));

  try {
    await localMediaStorage.writeFile({ ...preparedFile, visibility });
    await Promise.all(preparedVariants.map((variant) => localMediaStorage.writeVariantFile({ ...variant, visibility })));
    return { visibility, preparedFile, preparedVariants, normalizedOriginal, validatedFile };
  } catch (error) {
    await removePreparedMediaFiles({ visibility, preparedFile, preparedVariants });
    throw error;
  }
}

async function removePreparedMediaFiles(prepared: Pick<PreparedMediaUpload, 'visibility' | 'preparedFile' | 'preparedVariants'>) {
  await Promise.all([
    localMediaStorage.deleteFile({ ...prepared.preparedFile, visibility: prepared.visibility }),
    ...prepared.preparedVariants.map((variant) => localMediaStorage.deleteFile({ ...variant, visibility: prepared.visibility })),
  ]);
}

function mediaAssetData(input: MediaUploadInput, prepared: PreparedMediaUpload) {
  const optimizedVariant = prepared.preparedVariants.find((variant) => variant.variant === 'optimized') ?? null;
  const thumbnailVariant = prepared.preparedVariants.find((variant) => variant.variant === 'thumbnail') ?? null;
  const { preparedFile, normalizedOriginal, validatedFile, visibility } = prepared;

  return {
    type: input.type, kind: legacyKindForType(input.type), visibility, storageProvider: 'LOCAL' as const,
    originalFilename: validatedFile.originalFilename, fileName: preparedFile.storedFilename, storedFilename: preparedFile.storedFilename,
    mimeType: preparedFile.mimeType, extension: preparedFile.extension, sizeBytes: preparedFile.sizeBytes, size: preparedFile.sizeBytes,
    width: normalizedOriginal.width, height: normalizedOriginal.height, alt: normalizeMediaText(input.altText), altText: normalizeMediaText(input.altText),
    title: normalizeMediaText(input.title), sortOrder: input.sortOrder ?? null, storagePath: preparedFile.storagePath,
    url: buildMediaPublicUrl(preparedFile.storagePath), optimizedStoragePath: optimizedVariant?.storagePath ?? null,
    optimizedUrl: optimizedVariant ? buildMediaPublicUrl(optimizedVariant.storagePath) : null, optimizedMimeType: optimizedVariant?.mimeType ?? null,
    optimizedWidth: optimizedVariant?.width ?? null, optimizedHeight: optimizedVariant?.height ?? null, optimizedSize: optimizedVariant?.sizeBytes ?? null,
    thumbnailStoragePath: thumbnailVariant?.storagePath ?? null, thumbnailUrl: thumbnailVariant ? buildMediaPublicUrl(thumbnailVariant.storagePath) : null,
    thumbnailMimeType: thumbnailVariant?.mimeType ?? null, thumbnailWidth: thumbnailVariant?.width ?? null,
    thumbnailHeight: thumbnailVariant?.height ?? null, thumbnailSize: thumbnailVariant?.sizeBytes ?? null, isPublished: input.isPublished ?? true,
  };
}

export async function createMedia(input: MediaUploadInput) {
  const prepared = await prepareAndWriteMediaUpload(input);

  try {
    const asset = await createMediaAsset(mediaAssetData(input, prepared));

    return withPublicUrl(asset);
  } catch (error) {
    await removePreparedMediaFiles(prepared);
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
    sortOrder?: number | null;
  },
) {
  const data = {
    ...(input.type ? { type: input.type, kind: legacyKindForType(input.type) } : {}),
    ...(input.title !== undefined ? { title: normalizeMediaText(input.title) } : {}),
    ...(input.altText !== undefined
      ? { altText: normalizeMediaText(input.altText), alt: normalizeMediaText(input.altText) }
      : {}),
    ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
    ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
  };

  const asset = await updateMediaAsset(id, data);
  return withPublicUrl(asset);
}

export async function deleteMedia(id: string) {
  const asset = await getMediaAssetById(id);

  if (!asset) {
    throw new Error('MEDIA_ASSET_NOT_FOUND');
  }

  const usage = await getMediaAssetUsage(asset.id);
  if (usage.isUsed) {
    throw new Error('MEDIA_ASSET_IN_USE');
  }

  await markMediaAssetForDeletion(asset.id);

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
  const currentAsset = await getMediaAssetById(id);
  if (!currentAsset) {
    throw new Error('MEDIA_ASSET_NOT_FOUND');
  }

  // Nové soubory se nejprve kompletně připraví mimo aktuální záznam. Selhání
  // uploadu nebo DB update proto nemůže odebrat dosavadní funkční asset.
  const prepared = await prepareAndWriteMediaUpload(input);

  let asset;
  try {
    asset = await updateMediaAsset(id, mediaAssetData(input, prepared));
  } catch (error) {
    await removePreparedMediaFiles(prepared);
    throw error;
  }

  // Po úspěšném přepnutí DB je nový asset funkční. Neúspěšný úklid starých
  // souborů proto ponechává pouze orphan kandidáta pro read-only audit.
  try {
    await removeStoredAssetFiles(currentAsset);
  } catch {
    // Záměrně bez rollbacku: rollback by mohl znefunkčnit právě nahrazený asset.
  }

  return withPublicUrl(asset);
}

async function removeStoredAssetFiles(asset: NonNullable<Awaited<ReturnType<typeof getMediaAssetById>>>) {
  await localMediaStorage.deleteFile({
    visibility: asset.visibility, storagePath: asset.storagePath, storedFilename: asset.storedFilename,
    mimeType: asset.mimeType, sizeBytes: asset.sizeBytes,
  });
  if (asset.optimizedStoragePath && asset.optimizedMimeType && asset.optimizedSize) {
    await localMediaStorage.deleteFile({
      visibility: asset.visibility, storagePath: asset.optimizedStoragePath,
      storedFilename: asset.optimizedStoragePath.split('/').pop() ?? asset.storedFilename,
      mimeType: asset.optimizedMimeType, sizeBytes: asset.optimizedSize,
    });
  }
  if (asset.thumbnailStoragePath && asset.thumbnailMimeType && asset.thumbnailSize) {
    await localMediaStorage.deleteFile({
      visibility: asset.visibility, storagePath: asset.thumbnailStoragePath,
      storedFilename: asset.thumbnailStoragePath.split('/').pop() ?? asset.storedFilename,
      mimeType: asset.thumbnailMimeType, sizeBytes: asset.thumbnailSize,
    });
  }
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
