import { mediaUploadPolicy } from '@/lib/media/media-config';
import type { ValidatedMediaFile } from '@/lib/media/media-types';

function normalizeFilename(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return 'upload';
  }

  return trimmed.split(/[\\/]+/).pop() ?? 'upload';
}

export async function validateMediaFile(file: File): Promise<ValidatedMediaFile> {
  if (!(file instanceof File)) {
    throw new Error('MEDIA_FILE_MISSING');
  }

  if (!file.name) {
    throw new Error('MEDIA_FILE_NAME_MISSING');
  }

  if (file.size <= 0) {
    throw new Error('MEDIA_FILE_EMPTY');
  }

  if (file.size > mediaUploadPolicy.maxFileSizeBytes) {
    throw new Error('MEDIA_FILE_TOO_LARGE');
  }

  const mimeType = file.type.trim().toLowerCase();
  const allowedExtensions = mediaUploadPolicy.allowedMimeTypes.get(mimeType);

  if (!allowedExtensions) {
    throw new Error('MEDIA_FILE_TYPE_UNSUPPORTED');
  }

  const originalFilename = normalizeFilename(file.name);
  const extension = originalFilename.split('.').pop()?.toLowerCase();

  if (!extension || !allowedExtensions.includes(extension)) {
    throw new Error('MEDIA_FILE_EXTENSION_UNSUPPORTED');
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return {
    buffer,
    mimeType,
    extension,
    sizeBytes: buffer.byteLength,
    originalFilename,
  };
}
