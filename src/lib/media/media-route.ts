import { getPublicMediaAssetByPath } from '@/features/media/lib/media-asset-repository';

export const publicMediaStorageRoots = new Set([
  'certificates',
  'spaces',
  'contact',
  'portraits',
  'portraits-home',
  'portraits-about',
  'general',
  'references',
  'content',
  'images',
]);

export function resolveAssetVariant(
  asset: Awaited<ReturnType<typeof getPublicMediaAssetByPath>>,
  storagePath: string,
) {
  if (!asset) {
    return null;
  }

  if (
    asset.thumbnailStoragePath === storagePath &&
    asset.thumbnailMimeType &&
    asset.thumbnailSize
  ) {
    return {
      storagePath: asset.thumbnailStoragePath,
      mimeType: asset.thumbnailMimeType,
      size: asset.thumbnailSize,
    };
  }

  if (
    asset.optimizedStoragePath === storagePath &&
    asset.optimizedMimeType &&
    asset.optimizedSize
  ) {
    return {
      storagePath: asset.optimizedStoragePath,
      mimeType: asset.optimizedMimeType,
      size: asset.optimizedSize,
    };
  }

  return {
    storagePath: asset.storagePath,
    mimeType: asset.mimeType,
    size: asset.size,
  };
}
