import sharp from 'sharp';

import type { MediaImageMetadata } from '@/lib/media/media-types';

export async function readImageMetadata(
  buffer: Buffer,
  mimeType: string,
): Promise<MediaImageMetadata> {
  if (!mimeType.startsWith('image/')) {
    return {
      width: null,
      height: null,
    };
  }

  const dimensions = await sharp(buffer, { animated: false }).metadata();

  return {
    width: dimensions.width ?? null,
    height: dimensions.height ?? null,
  };
}
