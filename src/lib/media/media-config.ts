import path from 'node:path';

import type { MediaAssetVisibility, MediaType } from '@prisma/client';

import { mediaStorageRoot } from '@/config/env';

export const MEDIA_PUBLIC_BASE_PATH = '/media';
export const MEDIA_TEMP_SEGMENT = 'temp';

export const mediaTypes = ['CERTIFICATE', 'SALON_PHOTO', 'PORTRAIT', 'GENERAL'] as const;

export const mediaTypeDirectoryMap = {
  CERTIFICATE: 'certificates',
  SALON_PHOTO: 'spaces',
  PORTRAIT: 'portraits',
  GENERAL: 'general',
} satisfies Record<MediaType, string>;

export const mediaVisibilities = ['PUBLIC', 'PRIVATE'] as const;

export const mediaRootDirectoryMap = {
  PUBLIC: 'public',
  PRIVATE: 'private',
} satisfies Record<MediaAssetVisibility, string>;

export const mediaUploadPolicy = {
  maxFileSizeBytes: 8 * 1024 * 1024,
  allowedMimeTypes: new Map([
    ['image/jpeg', ['jpg', 'jpeg']],
    ['image/png', ['png']],
    ['image/webp', ['webp']],
    ['image/gif', ['gif']],
    ['image/svg+xml', ['svg']],
  ]),
};

export function getMediaStorageRoot() {
  return mediaStorageRoot;
}

export function getMediaVisibilityRoot(visibility: MediaAssetVisibility) {
  return path.join(/* turbopackIgnore: true */ getMediaStorageRoot(), mediaRootDirectoryMap[visibility]);
}

export function getMediaTempRoot() {
  return path.join(/* turbopackIgnore: true */ getMediaStorageRoot(), MEDIA_TEMP_SEGMENT);
}

export function getMediaTypeDirectory(type: MediaType) {
  return mediaTypeDirectoryMap[type];
}

export function buildMediaStoragePath(input: {
  type: MediaType;
  visibility: MediaAssetVisibility;
  storedFilename: string;
  createdAt: Date;
}) {
  const directory = getMediaTypeDirectory(input.type);
  const year = String(input.createdAt.getUTCFullYear());
  const month = String(input.createdAt.getUTCMonth() + 1).padStart(2, '0');

  return path.posix.join(directory, year, month, input.storedFilename);
}

export function buildMediaPublicUrl(storagePath: string) {
  return `${MEDIA_PUBLIC_BASE_PATH}/${storagePath}`;
}
