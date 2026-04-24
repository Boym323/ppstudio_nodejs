import sharp from 'sharp';

import type { MediaVariantName, ValidatedMediaFile } from '@/lib/media/media-types';

const pipelineMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function getOutputExtension(mimeType: string) {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return null;
  }
}

function applyEncoder(image: sharp.Sharp, mimeType: string) {
  switch (mimeType) {
    case 'image/jpeg':
      return image.jpeg({ quality: 82, mozjpeg: true });
    case 'image/png':
      return image.png({ compressionLevel: 9, palette: true, quality: 82 });
    case 'image/webp':
      return image.webp({ quality: 82 });
    default:
      return image;
  }
}

async function buildVariantBuffer(
  file: ValidatedMediaFile,
  variant: MediaVariantName,
  width: number,
) {
  const image = sharp(file.buffer, { animated: false }).rotate().resize({
    width,
    withoutEnlargement: true,
    fit: 'inside',
  });

  const encoded = applyEncoder(image, file.mimeType);
  const buffer = await encoded.toBuffer();
  const metadata = await sharp(buffer, { animated: false }).metadata();

  return {
    variant,
    buffer,
    mimeType: file.mimeType,
    extension: getOutputExtension(file.mimeType) ?? file.extension,
    sizeBytes: buffer.byteLength,
    width: metadata.width ?? null,
    height: metadata.height ?? null,
  };
}

export function supportsMediaVariants(mimeType: string) {
  return pipelineMimeTypes.has(mimeType);
}

export async function createMediaVariants(file: ValidatedMediaFile) {
  if (!supportsMediaVariants(file.mimeType)) {
    return [];
  }

  return Promise.all([
    buildVariantBuffer(file, 'optimized', 1920),
    buildVariantBuffer(file, 'thumbnail', 400),
  ]);
}
