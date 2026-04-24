import sharp from 'sharp';

import type {
  MediaVariantName,
  PreparedImageBuffer,
  ValidatedMediaFile,
} from '@/lib/media/media-types';

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

function applyEncoder(image: sharp.Sharp, mimeType: string, quality: number) {
  switch (mimeType) {
    case 'image/jpeg':
      return image.jpeg({ quality, mozjpeg: true });
    case 'image/png':
      return image.png({ compressionLevel: 9 });
    case 'image/webp':
      return image.webp({ quality });
    default:
      return image;
  }
}

async function buildImageBuffer(input: {
  buffer: Buffer;
  mimeType: string;
  width?: number;
  quality: number;
}): Promise<PreparedImageBuffer> {
  const image = sharp(input.buffer, { animated: false }).rotate();

  if (input.width) {
    image.resize({
      width: input.width,
      withoutEnlargement: true,
      fit: 'inside',
    });
  }

  const encoded = applyEncoder(image, input.mimeType, input.quality);
  const buffer = await encoded.toBuffer();
  const metadata = await sharp(buffer, { animated: false }).metadata();

  return {
    buffer,
    mimeType: input.mimeType,
    extension: getOutputExtension(input.mimeType) ?? 'bin',
    sizeBytes: buffer.byteLength,
    width: metadata.width ?? null,
    height: metadata.height ?? null,
  };
}

async function buildVariantBuffer(
  file: PreparedImageBuffer,
  variant: MediaVariantName,
  width: number,
) {
  const rendered = await buildImageBuffer({
    buffer: file.buffer,
    mimeType: file.mimeType,
    width,
    quality: 80,
  });

  return {
    variant,
    ...rendered,
  };
}

export function supportsMediaVariants(mimeType: string) {
  return pipelineMimeTypes.has(mimeType);
}

export async function normalizeOriginalMediaImage(
  file: ValidatedMediaFile,
): Promise<PreparedImageBuffer> {
  if (!supportsMediaVariants(file.mimeType)) {
    return {
      buffer: file.buffer,
      mimeType: file.mimeType,
      extension: file.extension,
      sizeBytes: file.sizeBytes,
      width: null,
      height: null,
    };
  }

  return buildImageBuffer({
    buffer: file.buffer,
    mimeType: file.mimeType,
    quality: 100,
  });
}

export async function createMediaVariants(file: PreparedImageBuffer) {
  if (!supportsMediaVariants(file.mimeType)) {
    return [];
  }

  return Promise.all([
    buildVariantBuffer(file, 'optimized', 1920),
    buildVariantBuffer(file, 'thumbnail', 400),
  ]);
}
