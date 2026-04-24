import { randomBytes } from 'node:crypto';

function buildMediaFileKey() {
  return randomBytes(8).toString('hex').slice(0, 12);
}

export function buildStoredFilename(extension: string) {
  return `${buildMediaFileKey()}-original.${extension}`;
}

export function buildVariantStoredFilename(storedFilename: string, variant: string, extension: string) {
  const dotIndex = storedFilename.lastIndexOf('.');
  const basename = dotIndex > 0 ? storedFilename.slice(0, dotIndex) : storedFilename;
  const baseWithoutOriginal = basename.endsWith('-original')
    ? basename.slice(0, -'-original'.length)
    : basename;

  return `${baseWithoutOriginal}-${variant}.${extension}`;
}
