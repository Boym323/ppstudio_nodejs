import { imageSize } from 'image-size';

import type { MediaImageMetadata } from '@/lib/media/media-types';

export function readImageMetadata(buffer: Buffer, mimeType: string): MediaImageMetadata {
  if (!mimeType.startsWith('image/')) {
    return {
      width: null,
      height: null,
    };
  }

  const dimensions = imageSize(buffer);

  return {
    width: dimensions.width ?? null,
    height: dimensions.height ?? null,
  };
}
