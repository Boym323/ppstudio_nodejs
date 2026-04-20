import path from 'node:path';

import { MediaAssetVisibility } from '@prisma/client';

import { getMediaVisibilityRoot } from '@/lib/media/media-config';

const safeSegmentPattern = /^[a-z0-9][a-z0-9-]*$/;
const safeFilenamePattern = /^[a-z0-9][a-z0-9-]*\.[a-z0-9]+$/;

function normalizeSegments(storagePath: string) {
  return storagePath.split('/').filter(Boolean);
}

export function assertSafeStoragePath(storagePath: string) {
  const segments = normalizeSegments(storagePath);

  if (segments.length < 4) {
    throw new Error('MEDIA_STORAGE_PATH_INVALID');
  }

  const filename = segments[segments.length - 1] ?? '';
  const directorySegments = segments.slice(0, -1);

  if (!safeFilenamePattern.test(filename)) {
    throw new Error('MEDIA_STORAGE_PATH_INVALID');
  }

  for (const segment of directorySegments) {
    if (!safeSegmentPattern.test(segment)) {
      throw new Error('MEDIA_STORAGE_PATH_INVALID');
    }
  }

  return segments;
}

export function resolveMediaAbsolutePath(
  visibility: MediaAssetVisibility,
  storagePath: string,
) {
  const normalizedPath = assertSafeStoragePath(storagePath).join(path.sep);
  const root = getMediaVisibilityRoot(visibility);
  const absolutePath = path.resolve(root, normalizedPath);

  if (!absolutePath.startsWith(`${root}${path.sep}`)) {
    throw new Error('MEDIA_STORAGE_PATH_INVALID');
  }

  return absolutePath;
}
