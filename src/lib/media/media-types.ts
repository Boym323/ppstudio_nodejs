import { MediaAssetKind, MediaAssetVisibility } from '@prisma/client';

export { MediaAssetKind, MediaAssetVisibility };

export type MediaUploadInput = {
  file: File;
  kind: MediaAssetKind;
  visibility?: MediaAssetVisibility;
  alt?: string | null;
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

export type PreparedMediaFile = ValidatedMediaFile & {
  storedFilename: string;
  storagePath: string;
};

export type MediaFileRecord = {
  visibility: MediaAssetVisibility;
  kind: MediaAssetKind;
  storagePath: string;
  storedFilename: string;
  mimeType: string;
  sizeBytes: number;
};
