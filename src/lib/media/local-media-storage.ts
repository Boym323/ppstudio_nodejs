import path from 'node:path';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';

import type { MediaAssetVisibility, MediaType } from '@prisma/client';

import {
  buildMediaStoragePath,
  getMediaStorageRoot,
  getMediaTempRoot,
  mediaVisibilities,
  mediaRootDirectoryMap,
} from '@/lib/media/media-config';
import { buildStoredFilename } from '@/lib/media/media-filename';
import { resolveMediaAbsolutePath } from '@/lib/media/media-path';
import type { MediaFileRecord, PreparedMediaFile, ValidatedMediaFile } from '@/lib/media/media-types';

export interface MediaStorageAdapter {
  prepareFile(input: {
    file: ValidatedMediaFile;
    type: MediaType;
    visibility: MediaAssetVisibility;
    createdAt?: Date;
  }): PreparedMediaFile;
  writeFile(file: PreparedMediaFile & { visibility: MediaAssetVisibility }): Promise<void>;
  deleteFile(file: MediaFileRecord): Promise<void>;
  readFile(visibility: MediaAssetVisibility, storagePath: string): Promise<Buffer>;
  ensureBaseDirectories(): Promise<void>;
  fileExists(visibility: MediaAssetVisibility, storagePath: string): Promise<boolean>;
}

class LocalMediaStorageAdapter implements MediaStorageAdapter {
  prepareFile(input: {
    file: ValidatedMediaFile;
    type: MediaType;
    visibility: MediaAssetVisibility;
    createdAt?: Date;
  }): PreparedMediaFile {
    const createdAt = input.createdAt ?? new Date();
    const storedFilename = buildStoredFilename(input.file.originalFilename, input.file.extension);
    const storagePath = buildMediaStoragePath({
      type: input.type,
      visibility: input.visibility,
      storedFilename,
      createdAt,
    });

    return {
      ...input.file,
      storedFilename,
      storagePath,
    };
  }

  async writeFile(file: PreparedMediaFile & { visibility: MediaAssetVisibility }) {
    const absolutePath = resolveMediaAbsolutePath(file.visibility, file.storagePath);
    const directoryPath = path.dirname(absolutePath);

    await mkdir(directoryPath, { recursive: true });
    await writeFile(absolutePath, file.buffer, { flag: 'wx' });
  }

  async deleteFile(file: MediaFileRecord) {
    const absolutePath = resolveMediaAbsolutePath(file.visibility, file.storagePath);
    await rm(absolutePath, { force: true });
  }

  async readFile(visibility: MediaAssetVisibility, storagePath: string) {
    const absolutePath = resolveMediaAbsolutePath(visibility, storagePath);
    return readFile(absolutePath);
  }

  async ensureBaseDirectories() {
    await Promise.all(
      [
        mkdir(getMediaStorageRoot(), { recursive: true }),
        mkdir(getMediaTempRoot(), { recursive: true }),
        ...mediaVisibilities.map((visibility) =>
          mkdir(path.join(/* turbopackIgnore: true */ getMediaStorageRoot(), mediaRootDirectoryMap[visibility]), {
            recursive: true,
          }),
        ),
      ],
    );
  }

  async fileExists(visibility: MediaAssetVisibility, storagePath: string) {
    try {
      const absolutePath = resolveMediaAbsolutePath(visibility, storagePath);
      await stat(absolutePath);
      return true;
    } catch {
      return false;
    }
  }
}

export const localMediaStorage = new LocalMediaStorageAdapter();
