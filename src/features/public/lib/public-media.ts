import {
  getPublicAboutPortraitAsset,
  getPublicHomePortraitAsset,
} from '@/features/public/lib/public-media-relations';

export type PublicImageAsset = {
  id: string;
  title: string | null;
  altText: string;
  imageUrl: string;
  width: number | null;
  height: number | null;
};

function mapPublicImageAsset(
  asset: NonNullable<Awaited<ReturnType<typeof getPublicHomePortraitAsset>>>,
  fallbackAltText: string,
): PublicImageAsset {
  return {
    id: asset.id,
    title: asset.title,
    altText: asset.altText ?? asset.title ?? fallbackAltText,
    imageUrl: asset.optimizedUrl ?? asset.url,
    width: asset.optimizedWidth ?? asset.width,
    height: asset.optimizedHeight ?? asset.height,
  };
}

export async function getPublicHomePortraits() {
  const asset = await getPublicHomePortraitAsset();
  return asset ? [mapPublicImageAsset(asset, 'Portrét homepage PP Studio')] : [];
}

export async function getPublicAboutPortraits() {
  const asset = await getPublicAboutPortraitAsset();
  return asset ? [mapPublicImageAsset(asset, 'Portrét O mně PP Studio')] : [];
}

export async function getPrimaryPublicHomePortrait() {
  const portraits = await getPublicHomePortraits();

  return portraits[0] ?? null;
}

export async function getPrimaryPublicAboutPortrait() {
  const portraits = await getPublicAboutPortraits();

  return portraits[0] ?? null;
}
