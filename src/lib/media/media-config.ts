import path from 'node:path';

import type { MediaAssetVisibility, MediaType } from '@/generated/prisma/browser';

import { mediaStorageRoot } from '@/config/env';

export const MEDIA_PUBLIC_BASE_PATH = '/media';
export const MEDIA_PUBLIC_SCOPE_SEGMENT = 'public';
export const MEDIA_TEMP_SEGMENT = 'temp';

export const mediaTypes = [
  'CERTIFICATE',
  'SALON_PHOTO',
  'CONTACT_PHOTO',
  'PORTRAIT',
  'PORTRAIT_HOME',
  'PORTRAIT_ABOUT',
  'GENERAL',
] as const;

export const mediaTypeDirectoryMap = {
  CERTIFICATE: 'certificates',
  SALON_PHOTO: 'spaces',
  CONTACT_PHOTO: 'contact',
  PORTRAIT: 'portraits',
  PORTRAIT_HOME: 'portraits-home',
  PORTRAIT_ABOUT: 'portraits-about',
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
  const year = String(input.createdAt.getUTCFullYear());
  const month = String(input.createdAt.getUTCMonth() + 1).padStart(2, '0');

  // Typ je legacy metadata, ne význam ani umístění nových souborů.
  // Stávající storagePath zůstávají beze změny; nové uploady jsou neutrální.
  return path.posix.join('images', year, month, input.storedFilename);
}

export function buildMediaPublicUrl(storagePath: string) {
  return `${MEDIA_PUBLIC_BASE_PATH}/${MEDIA_PUBLIC_SCOPE_SEGMENT}/${storagePath}`;
}
