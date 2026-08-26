import { MediaAssetVisibility, MediaStorageProvider } from '@/generated/prisma/browser';

import { buildMediaPublicUrl } from '@/lib/media/media-config';
import { getMediaStorageAdapter } from '@/lib/media/media-storage';
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
  storageProvider: MediaStorageProvider;
  visibility: MediaAssetVisibility;
  preparedFile: ReturnType<ReturnType<typeof getMediaStorageAdapter>['prepareFile']>;
  preparedVariants: ReturnType<ReturnType<typeof getMediaStorageAdapter>['prepareVariantFile']>[];
  normalizedOriginal: Awaited<ReturnType<typeof normalizeOriginalMediaImage>>;
  validatedFile: Awaited<ReturnType<typeof validateMediaFile>>;
};

async function prepareAndWriteMediaUpload(input: MediaUploadInput): Promise<PreparedMediaUpload> {
  const visibility = MediaAssetVisibility.PUBLIC;
  const storageProvider = MediaStorageProvider.LOCAL;
  const storage = getMediaStorageAdapter(storageProvider);
  const validatedFile = await validateMediaFile(input.file);
  const normalizedOriginal = await normalizeOriginalMediaImage(validatedFile);
  await storage.ensureBaseDirectories();

  const preparedFile = storage.prepareFile({
    file: { ...validatedFile, buffer: normalizedOriginal.buffer, mimeType: normalizedOriginal.mimeType, extension: normalizedOriginal.extension, sizeBytes: normalizedOriginal.sizeBytes },
    visibility,
  });
  const preparedVariants = (await createMediaVariants(normalizedOriginal)).map((variant) => storage.prepareVariantFile({
    variant: variant.variant, source: preparedFile, buffer: variant.buffer, mimeType: variant.mimeType,
    extension: variant.extension, sizeBytes: variant.sizeBytes, width: variant.width, height: variant.height,
  }));

  try {
    await storage.writeFile({ ...preparedFile, visibility });
    await Promise.all(preparedVariants.map((variant) => storage.writeVariantFile({ ...variant, visibility })));
    return { storageProvider, visibility, preparedFile, preparedVariants, normalizedOriginal, validatedFile };
  } catch (error) {
    await removePreparedMediaFiles({ storageProvider, visibility, preparedFile, preparedVariants });
    throw error;
  }
}

async function removePreparedMediaFiles(prepared: Pick<PreparedMediaUpload, 'storageProvider' | 'visibility' | 'preparedFile' | 'preparedVariants'>) {
  const storage = getMediaStorageAdapter(prepared.storageProvider);
  await Promise.all([
    storage.deleteFile({ ...prepared.preparedFile, visibility: prepared.visibility }),
    ...prepared.preparedVariants.map((variant) => storage.deleteFile({ ...variant, visibility: prepared.visibility })),
  ]);
}

function mediaAssetData(input: MediaUploadInput, prepared: PreparedMediaUpload) {
  const optimizedVariant = prepared.preparedVariants.find((variant) => variant.variant === 'optimized') ?? null;
  const thumbnailVariant = prepared.preparedVariants.find((variant) => variant.variant === 'thumbnail') ?? null;
  const { preparedFile, normalizedOriginal, validatedFile, visibility, storageProvider } = prepared;

  return {
    visibility, storageProvider,
    originalFilename: validatedFile.originalFilename, fileName: preparedFile.storedFilename,
    mimeType: preparedFile.mimeType, extension: preparedFile.extension, size: preparedFile.sizeBytes,
    width: normalizedOriginal.width, height: normalizedOriginal.height, altText: normalizeMediaText(input.altText),
    title: normalizeMediaText(input.title), storagePath: preparedFile.storagePath,
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

export async function listMedia() {
  const assets = await listMediaAssets();
  return assets.map(withPublicUrl);
}

export async function listPublishedMedia() {
  const assets = await listPublicMediaAssets();
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
    title?: string | null;
    altText?: string | null;
    isPublished?: boolean;
  },
) {
  const data = {
    ...(input.title !== undefined ? { title: normalizeMediaText(input.title) } : {}),
    ...(input.altText !== undefined
      ? { altText: normalizeMediaText(input.altText) }
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

  const usage = await getMediaAssetUsage(asset.id);
  if (usage.isUsed) {
    throw new Error('MEDIA_ASSET_IN_USE');
  }

  await markMediaAssetForDeletion(asset.id);

  const storage = getMediaStorageAdapter(asset.storageProvider);
  await storage.deleteFile({
    visibility: asset.visibility,
    storagePath: asset.storagePath,
    storedFilename: asset.fileName,
    mimeType: asset.mimeType,
    sizeBytes: asset.size,
  });
  if (asset.optimizedStoragePath && asset.optimizedMimeType && asset.optimizedSize) {
    await storage.deleteFile({
      visibility: asset.visibility,
      storagePath: asset.optimizedStoragePath,
      storedFilename: asset.optimizedStoragePath.split('/').pop() ?? asset.fileName,
      mimeType: asset.optimizedMimeType,
      sizeBytes: asset.optimizedSize,
    });
  }
  if (asset.thumbnailStoragePath && asset.thumbnailMimeType && asset.thumbnailSize) {
    await storage.deleteFile({
      visibility: asset.visibility,
      storagePath: asset.thumbnailStoragePath,
      storedFilename: asset.thumbnailStoragePath.split('/').pop() ?? asset.fileName,
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
  const storage = getMediaStorageAdapter(asset.storageProvider);
  await storage.deleteFile({
    visibility: asset.visibility, storagePath: asset.storagePath, storedFilename: asset.fileName,
    mimeType: asset.mimeType, sizeBytes: asset.size,
  });
  if (asset.optimizedStoragePath && asset.optimizedMimeType && asset.optimizedSize) {
    await storage.deleteFile({
      visibility: asset.visibility, storagePath: asset.optimizedStoragePath,
      storedFilename: asset.optimizedStoragePath.split('/').pop() ?? asset.fileName,
      mimeType: asset.optimizedMimeType, sizeBytes: asset.optimizedSize,
    });
  }
  if (asset.thumbnailStoragePath && asset.thumbnailMimeType && asset.thumbnailSize) {
    await storage.deleteFile({
      visibility: asset.visibility, storagePath: asset.thumbnailStoragePath,
      storedFilename: asset.thumbnailStoragePath.split('/').pop() ?? asset.fileName,
      mimeType: asset.thumbnailMimeType, sizeBytes: asset.thumbnailSize,
    });
  }
}

export async function ensureMediaStorageReady() {
  await getMediaStorageAdapter(MediaStorageProvider.LOCAL).ensureBaseDirectories();
}
