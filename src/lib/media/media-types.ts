import { MediaAssetVisibility, MediaType } from '@prisma/client';

export { MediaAssetVisibility, MediaType };

export type MediaUploadInput = {
  file: File;
  type: MediaType;
  visibility?: MediaAssetVisibility;
  isPublished?: boolean;
  altText?: string | null;
  title?: string | null;
};

export type ValidatedMediaFile = {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  originalFilename: string;
};

export type MediaImageMetadata = {
  width: number | null;
  height: number | null;
};

export type MediaVariantName = 'optimized' | 'thumbnail';

export type PreparedMediaFile = ValidatedMediaFile & {
  storedFilename: string;
  storagePath: string;
};

export type MediaVariantFile = {
  variant: MediaVariantName;
  buffer: Buffer;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  storedFilename: string;
  storagePath: string;
};

export type MediaFileRecord = {
  visibility: MediaAssetVisibility;
  storagePath: string;
  storedFilename: string;
  mimeType: string;
  sizeBytes: number;
};
