import { MediaType } from '@prisma/client';

import { getPublishedMediaLibraryByType } from '@/features/media/lib/media-library';

export type PublicImageAsset = {
  id: string;
  title: string | null;
  altText: string;
  imageUrl: string;
  width: number | null;
  height: number | null;
};

function mapPublicImageAsset(
  asset: Awaited<ReturnType<typeof getPublishedMediaLibraryByType>>[number],
  fallbackAltText: string,
) {
  return {
    id: asset.id,
    title: asset.title,
    altText: asset.altText ?? asset.title ?? fallbackAltText,
    imageUrl: asset.publicUrl,
    width: asset.optimizedWidth ?? asset.width,
    height: asset.optimizedHeight ?? asset.height,
  };
}

export async function getPublicImageAssetsByType(
  type: MediaType,
  fallbackAltText: string,
): Promise<PublicImageAsset[]> {
  const assets = await getPublishedMediaLibraryByType(type);

  return assets.map((asset, index) =>
    mapPublicImageAsset(asset, `${fallbackAltText} ${index + 1}`),
  );
}

export async function getPublicPortraits() {
  return getPublicImageAssetsByType(MediaType.PORTRAIT, 'Portrét PP Studio');
}

export async function getPrimaryPublicPortrait() {
  const portraits = await getPublicPortraits();
  return portraits[0] ?? null;
}

export async function getPublicHomePortraits() {
  return getPublicImageAssetsByType(MediaType.PORTRAIT_HOME, 'Portrét homepage PP Studio');
}

export async function getPublicAboutPortraits() {
  return getPublicImageAssetsByType(MediaType.PORTRAIT_ABOUT, 'Portrét O mně PP Studio');
}

export async function getPrimaryPublicHomePortrait() {
  const portraits = await getPublicHomePortraits();

  if (portraits.length > 0) {
    return portraits[0];
  }

  return getPrimaryPublicPortrait();
}

export async function getPrimaryPublicAboutPortrait() {
  const portraits = await getPublicAboutPortraits();

  if (portraits.length > 0) {
    return portraits[0];
  }

  return getPrimaryPublicPortrait();
}

export async function getPublicGeneralImages() {
  return getPublicImageAssetsByType(MediaType.GENERAL, 'Obecný obrázek PP Studio');
}
