import { promises as fs } from 'node:fs';
import path from 'node:path';

import { MediaType } from '@prisma/client';

import { type PublicImageAsset } from '@/features/public/lib/public-media';
import { getPublishedMediaLibraryByType } from '@/features/media/lib/media-library';
import { localMediaStorage } from '@/lib/media/local-media-storage';

export type PublicStudioPhoto = PublicImageAsset;

const STUDIO_ALT_FALLBACK = 'Fotografie prostoru PP Studio';
const DEV_STUDIO_FALLBACK_DIR = path.join(process.cwd(), 'public/dev/studio');
const DEV_STUDIO_FALLBACK_BASE_PATH = '/dev/studio';
const SUPPORTED_DEV_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function mapStudioAsset(
  asset: Awaited<ReturnType<typeof getPublishedMediaLibraryByType>>[number],
): PublicStudioPhoto {
  return {
    id: asset.id,
    title: asset.title,
    altText: asset.altText ?? STUDIO_ALT_FALLBACK,
    imageUrl: asset.publicUrl,
    width: asset.optimizedWidth ?? asset.width,
    height: asset.optimizedHeight ?? asset.height,
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

async function getAvailablePublishedImageAssets(type: MediaType) {
  const assets = await getPublishedMediaLibraryByType(type);
  const availableAssets = await Promise.all(
    assets.map(async (asset) => {
      const candidatePaths = [asset.optimizedStoragePath, asset.storagePath].filter(
        (candidate): candidate is string => Boolean(candidate),
      );

      for (const storagePath of candidatePaths) {
        const exists = await localMediaStorage.fileExists(asset.visibility, storagePath);
        if (exists) {
          return asset;
        }
      }

      return null;
    }),
  );

  return availableAssets.filter((asset): asset is NonNullable<typeof asset> => asset !== null);
}

export async function getPublicStudioPhotos(): Promise<PublicStudioPhoto[]> {
  try {
    const filteredAssets = await getAvailablePublishedImageAssets(MediaType.SALON_PHOTO);

    if (filteredAssets.length > 0) {
      return filteredAssets.map((asset) => mapStudioAsset(asset));
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
    const contactPhotos = await getAvailablePublishedImageAssets(MediaType.CONTACT_PHOTO);

    if (contactPhotos.length > 0) {
      return mapStudioAsset(contactPhotos[0]);
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'development') {
      throw error;
    }
  }

  return null;
}
