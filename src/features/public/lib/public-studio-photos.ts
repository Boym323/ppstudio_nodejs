import { MediaType } from '@prisma/client';

import { getPublishedMediaLibraryByType } from '@/features/media/lib/media-library';

export type PublicStudioPhoto = {
  id: string;
  title: string | null;
  altText: string;
  imageUrl: string;
  width: number | null;
  height: number | null;
};

export async function getPublicStudioPhotos(): Promise<PublicStudioPhoto[]> {
  const assets = await getPublishedMediaLibraryByType(MediaType.SALON_PHOTO);

  return assets.map((asset, index) => ({
    id: asset.id,
    title: asset.title,
    altText: asset.altText ?? asset.title ?? `Fotografie studia PP Studio ${index + 1}`,
    imageUrl: asset.publicUrl,
    width: asset.width,
    height: asset.height,
  }));
}
