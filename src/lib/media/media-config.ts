import path from 'node:path';

import type { MediaAssetKind, MediaAssetVisibility } from '@prisma/client';

import { mediaStorageRoot } from '@/config/env';

export const MEDIA_PUBLIC_BASE_PATH = '/media';
export const MEDIA_TEMP_SEGMENT = 'temp';

export const mediaAssetKinds = ['CERTIFICATE', 'SPACE', 'REFERENCE', 'CONTENT'] as const;

export const mediaKindDirectoryMap = {
  CERTIFICATE: 'certificates',
  SPACE: 'spaces',
  REFERENCE: 'references',
  CONTENT: 'content',
} satisfies Record<MediaAssetKind, string>;

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

export function getMediaKindDirectory(kind: MediaAssetKind) {
  return mediaKindDirectoryMap[kind];
}

export function buildMediaStoragePath(input: {
  kind: MediaAssetKind;
  visibility: MediaAssetVisibility;
  storedFilename: string;
  createdAt: Date;
}) {
  const directory = getMediaKindDirectory(input.kind);
  const year = String(input.createdAt.getUTCFullYear());
  const month = String(input.createdAt.getUTCMonth() + 1).padStart(2, '0');

  return path.posix.join(directory, year, month, input.storedFilename);
}

export function buildMediaPublicUrl(storagePath: string) {
  return `${MEDIA_PUBLIC_BASE_PATH}/${storagePath}`;
}
