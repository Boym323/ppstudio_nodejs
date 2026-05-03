import { MediaType } from '@prisma/client';

import { getPublicMediaAssetByPath } from '@/features/media/lib/media-asset-repository';

export const publicMediaTypes = new Map<string, MediaType>([
  ['certificates', MediaType.CERTIFICATE],
  ['spaces', MediaType.SALON_PHOTO],
  ['contact', MediaType.CONTACT_PHOTO],
  ['portraits', MediaType.PORTRAIT],
  ['portraits-home', MediaType.PORTRAIT_HOME],
  ['portraits-about', MediaType.PORTRAIT_ABOUT],
  ['general', MediaType.GENERAL],
  ['references', MediaType.GENERAL],
  ['content', MediaType.GENERAL],
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
