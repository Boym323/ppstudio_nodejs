import { MediaType } from '@prisma/client';

import { getPublicImageAssetsByType, type PublicImageAsset } from '@/features/public/lib/public-media';

export type PublicStudioPhoto = PublicImageAsset;

export async function getPublicStudioPhotos(): Promise<PublicStudioPhoto[]> {
  return getPublicImageAssetsByType(MediaType.SALON_PHOTO, 'Fotografie studia PP Studio');
}
