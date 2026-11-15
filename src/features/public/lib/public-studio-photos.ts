import { promises as fs } from 'node:fs';
import path from 'node:path';

import { MediaCollectionType } from '@/generated/prisma/browser';

import { type PublicImageAsset } from '@/features/public/lib/public-media';
import {
  getPublicContactPhotoAsset,
  getPublicMediaCollectionItems,
} from '@/features/public/lib/public-media-relations';
import { getMediaStorageAdapter } from '@/lib/media/media-storage';
import { withPublicMediaCacheVersion } from '@/lib/media/public-media-url';

export type PublicStudioPhoto = PublicImageAsset;

const STUDIO_ALT_FALLBACK = 'Fotografie prostoru PP Studio';
const DEV_STUDIO_FALLBACK_DIR = path.join(process.cwd(), 'public/dev/studio');
const DEV_STUDIO_FALLBACK_BASE_PATH = '/dev/studio';
const SUPPORTED_DEV_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function mapStudioAsset(
  asset: NonNullable<Awaited<ReturnType<typeof getPublicContactPhotoAsset>>>,
  altTextOverride?: string | null,
): PublicStudioPhoto {
  return {
    id: asset.id,
    title: asset.title,
    altText: altTextOverride ?? asset.altText ?? STUDIO_ALT_FALLBACK,
    imageUrl: withPublicMediaCacheVersion(asset.optimizedUrl ?? asset.url),
    width: asset.optimizedWidth ?? asset.width,
    height: asset.optimizedHeight ?? asset.height,
    focalPointX: asset.focalPointX ?? 50,
    focalPointY: asset.focalPointY ?? 50,
  };
}

async function getDevelopmentFallbackStudioPhotos(): Promise<PublicStudioPhoto[]> {
  if (process.env.NODE_ENV !== 'development') {
    return [];
  }

  let files: string[];
  try {
    files = await fs.readdir(DEV_STUDIO_FALLBACK_DIR);
  } catch {
    return [];
  }

  const imageFiles = files
    .filter((file) => SUPPORTED_DEV_IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'cs'));

  return imageFiles.map((file, index) => ({
    id: `dev-studio-${index + 1}-${file}`,
    title: null,
    altText: STUDIO_ALT_FALLBACK,
    imageUrl: `${DEV_STUDIO_FALLBACK_BASE_PATH}/${encodeURIComponent(file)}`,
    width: null,
    height: null,
  }));
}

async function filterAvailableAssets<
  T extends {
    mediaAsset: NonNullable<Awaited<ReturnType<typeof getPublicContactPhotoAsset>>>;
  },
>(items: T[]) {
  const availableAssets = await Promise.all(
    items.map(async (item) => {
      const asset = item.mediaAsset;
      const storage = getMediaStorageAdapter(asset.storageProvider);
      if (asset.optimizedStoragePath && asset.optimizedUrl
        && await storage.fileExists(asset.visibility, asset.optimizedStoragePath)) {
        return item;
      }

      if (await storage.fileExists(asset.visibility, asset.storagePath)) {
        // URL i rozměry musí odpovídat souboru, jehož existenci jsme ověřili.
        return { ...item, mediaAsset: { ...asset, optimizedUrl: null, optimizedWidth: null, optimizedHeight: null } };
      }

      return null;
    }),
  );

  return availableAssets.filter((asset): asset is NonNullable<typeof asset> => asset !== null);
}

export async function getPublicStudioPhotos(): Promise<PublicStudioPhoto[]> {
  try {
    const items = await getPublicMediaCollectionItems(MediaCollectionType.STUDIO_GALLERY);
    const availableItems = await filterAvailableAssets(items);

    if (availableItems.length > 0) {
      return availableItems.map(({ altText, mediaAsset }) => mapStudioAsset(mediaAsset, altText));
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'development') {
      throw error;
    }
  }

  return getDevelopmentFallbackStudioPhotos();
}

export async function getPrimaryPublicContactPhoto(): Promise<PublicStudioPhoto | null> {
  try {
    const asset = await getPublicContactPhotoAsset();
    const availableItems = asset ? await filterAvailableAssets([{ mediaAsset: asset }]) : [];

    if (availableItems.length > 0) {
      return mapStudioAsset(availableItems[0].mediaAsset);
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'development') {
      throw error;
    }
  }

  return null;
}
