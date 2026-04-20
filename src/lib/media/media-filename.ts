import { randomUUID } from 'node:crypto';

function slugifyFilenameBase(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export function buildStoredFilename(originalFilename: string, extension: string) {
  const dotIndex = originalFilename.lastIndexOf('.');
  const basename = dotIndex > 0 ? originalFilename.slice(0, dotIndex) : originalFilename;
  const safeBase = slugifyFilenameBase(basename) || 'media';
  const uniqueSuffix = randomUUID().replace(/-/g, '').slice(0, 12);

  return `${safeBase}-${uniqueSuffix}.${extension}`;
}
