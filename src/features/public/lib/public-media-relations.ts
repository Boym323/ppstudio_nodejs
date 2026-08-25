import {
  MediaAssetVisibility,
  type MediaCollectionType,
} from '@/generated/prisma/client';

import { prisma } from '@/lib/prisma';
import { SITE_SETTINGS_ID } from '@/lib/site-settings';

export async function getPublicMediaCollectionItems(type: MediaCollectionType) {
  return prisma.mediaCollectionItem.findMany({
    where: {
      collection: { type },
      isVisible: true,
      mediaAsset: {
        is: {
          isPublished: true,
          visibility: MediaAssetVisibility.PUBLIC,
          deletionRequestedAt: null,
        },
      },
    },
    include: { mediaAsset: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });
}

type SingularPublicMediaRole =
  | 'contactPhotoMedia'
  | 'homePortraitMedia'
  | 'aboutPortraitMedia';

async function getPublicSiteSettingsMedia(role: SingularPublicMediaRole) {
  const settings = await prisma.siteSettings.findUnique({
    where: { id: SITE_SETTINGS_ID },
    select: {
      contactPhotoMedia: true,
      homePortraitMedia: true,
      aboutPortraitMedia: true,
    },
  });
  const asset = settings?.[role] ?? null;

  if (
    !asset
    || !asset.isPublished
    || asset.visibility !== MediaAssetVisibility.PUBLIC
    || asset.deletionRequestedAt !== null
  ) {
    return null;
  }

  return asset;
}

export function getPublicContactPhotoAsset() {
  return getPublicSiteSettingsMedia('contactPhotoMedia');
}

export function getPublicHomePortraitAsset() {
  return getPublicSiteSettingsMedia('homePortraitMedia');
}

export function getPublicAboutPortraitAsset() {
  return getPublicSiteSettingsMedia('aboutPortraitMedia');
}
