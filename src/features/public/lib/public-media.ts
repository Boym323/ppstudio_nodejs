import {
  getPublicAboutPortraitAsset,
  getPublicHomePortraitAsset,
} from '@/features/public/lib/public-media-relations';
import { withPublicMediaCacheVersion } from '@/lib/media/public-media-url';

export type PublicImageAsset = {
  id: string;
  title: string | null;
  altText: string;
  imageUrl: string;
  width: number | null;
  height: number | null;
  focalPointX?: number;
  focalPointY?: number;
};

function mapPublicImageAsset(
  asset: NonNullable<Awaited<ReturnType<typeof getPublicHomePortraitAsset>>>,
  fallbackAltText: string,
): PublicImageAsset {
  return {
    id: asset.id,
    title: asset.title,
    altText: asset.altText ?? asset.title ?? fallbackAltText,
    imageUrl: withPublicMediaCacheVersion(asset.optimizedUrl ?? asset.url),
    width: asset.optimizedWidth ?? asset.width,
    height: asset.optimizedHeight ?? asset.height,
    focalPointX: asset.focalPointX ?? 50,
    focalPointY: asset.focalPointY ?? 50,
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
