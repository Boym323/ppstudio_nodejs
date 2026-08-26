'use server';

import { MediaCollectionType } from '@/generated/prisma/browser';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireAdminSectionAccess } from '@/features/admin/lib/admin-guards';
import {
  deleteMediaSchema,
  getMediaAdminPath,
  getMediaRedirectUrl,
  normalizeOptionalText,
  updateMediaMetadataSchema,
  updateMediaPublicationSchema,
  uploadMediaSchema,
} from '@/features/admin/lib/admin-media-validation';
import { prisma } from '@/lib/prisma';
import { createMedia, deleteMedia, replaceMediaAsset, updateMedia } from '@/features/media/lib/media-library';
import { moveMediaCollectionItem, saveMediaCollectionMembership } from '@/features/media/lib/media-collection-order';

function flashUrl(area: 'owner' | 'salon', returnTo: FormDataEntryValue | null, flash: string) {
  return getMediaRedirectUrl(area, returnTo, flash);
}

function revalidateMediaPaths(area: 'owner' | 'salon') {
  for (const path of [getMediaAdminPath(area), '/admin', '/admin/provoz', '/', '/kontakt', '/studio', '/o-mne', '/o-salonu']) {
    revalidatePath(path);
  }
}

function mapUploadErrorToFlash(error: unknown) {
  if (!(error instanceof Error)) {
    return 'media-upload-failed';
  }

  switch (error.message) {
    case 'MEDIA_FILE_MISSING':
      return 'media-upload-missing-file';
    case 'MEDIA_FILE_EMPTY':
      return 'media-upload-empty-file';
    case 'MEDIA_FILE_TOO_LARGE':
      return 'media-upload-too-large';
    case 'MEDIA_FILE_TYPE_UNSUPPORTED':
    case 'MEDIA_FILE_EXTENSION_UNSUPPORTED':
      return 'media-upload-invalid-type';
    default:
      return 'media-upload-failed';
  }
}

export async function uploadMediaAction(formData: FormData) {
  const parsed = uploadMediaSchema.safeParse({
    area: formData.get('area'),
    title: formData.get('title'),
    altText: formData.get('altText'),
  });

  if (!parsed.success) {
    redirect('/admin/media?flash=media-upload-invalid-payload');
  }

  await requireAdminSectionAccess(parsed.data.area, 'media');

  const file = formData.get('file');

  if (!(file instanceof File) || file.size <= 0) {
    redirect(flashUrl(parsed.data.area, formData.get('returnTo'), 'media-upload-missing-file'));
  }

  try {
    await createMedia({
      file,
      isPublished: true,
      title: normalizeOptionalText(parsed.data.title),
      altText: normalizeOptionalText(parsed.data.altText),
    });
  } catch (error) {
    redirect(flashUrl(parsed.data.area, formData.get('returnTo'), mapUploadErrorToFlash(error)));
  }

  revalidateMediaPaths(parsed.data.area);
  redirect(flashUrl(parsed.data.area, formData.get('returnTo'), 'media-upload-success'));
}

export async function replaceMediaAction(formData: FormData) {
  const area = formData.get('area');
  const assetId = formData.get('assetId');
  if ((area !== 'owner' && area !== 'salon') || typeof assetId !== 'string') redirect('/admin/media?flash=media-replace-invalid-payload');
  await requireAdminSectionAccess(area, 'media');
  const file = formData.get('file');
  if (!(file instanceof File) || file.size <= 0) redirect(flashUrl(area, formData.get('returnTo'), 'media-upload-missing-file'));
  try {
    const current = await prisma.mediaAsset.findUnique({ where: { id: assetId } });
    if (!current || current.deletionRequestedAt) redirect(flashUrl(area, formData.get('returnTo'), 'media-replace-invalid-payload'));
    await replaceMediaAsset(assetId, {
      file,
      isPublished: current.isPublished,
      title: current.title,
      altText: current.altText,
    });
  } catch (error) {
    redirect(flashUrl(area, formData.get('returnTo'), mapUploadErrorToFlash(error)));
  }
  revalidateMediaPaths(area);
  redirect(flashUrl(area, formData.get('returnTo'), 'media-replace-success'));
}

export async function updateMediaCollectionMembershipAction(formData: FormData) {
  const area = formData.get('area');
  const assetId = formData.get('assetId');
  const collectionType = formData.get('collectionType');
  const action = formData.get('action');
  if ((area !== 'owner' && area !== 'salon') || typeof assetId !== 'string' || !Object.values(MediaCollectionType).includes(collectionType as MediaCollectionType)) {
    redirect('/admin/media?flash=media-membership-invalid-payload');
  }
  await requireAdminSectionAccess(area, 'media');
  const collection = await prisma.mediaCollection.upsert({
    where: { type: collectionType as MediaCollectionType }, create: { type: collectionType as MediaCollectionType }, update: {},
  });
  if (action === 'remove') {
    await prisma.mediaCollectionItem.deleteMany({ where: { collectionId: collection.id, mediaAssetId: assetId } });
  } else if (action === 'move') {
    const direction = formData.get('direction');
    if ((collectionType !== MediaCollectionType.STUDIO_GALLERY && collectionType !== MediaCollectionType.CERTIFICATES) || (direction !== 'up' && direction !== 'down')) {
      redirect(flashUrl(area, formData.get('returnTo'), 'media-membership-invalid-payload'));
    }
    await prisma.$transaction(async (tx) => {
      const membership = await tx.mediaCollectionItem.findUnique({
        where: { collectionId_mediaAssetId: { collectionId: collection.id, mediaAssetId: assetId } },
        select: { id: true },
      });
      if (membership) await moveMediaCollectionItem(tx, collection.id, membership.id, direction);
    });
  } else {
    const isVisible = formData.get('isVisible') !== 'false';
    await prisma.$transaction(async (tx) => {
      await saveMediaCollectionMembership(tx, collection.id, assetId, isVisible);
    });
  }
  revalidateMediaPaths(area);
  redirect(flashUrl(area, formData.get('returnTo'), 'media-membership-success'));
}

export async function updateMediaMetadataAction(formData: FormData) {
  const parsed = updateMediaMetadataSchema.safeParse({
    area: formData.get('area'),
    assetId: formData.get('assetId'),
    title: formData.get('title'),
    altText: formData.get('altText'),
  });

  if (!parsed.success) {
    redirect('/admin/media?flash=media-update-invalid-payload');
  }

  await requireAdminSectionAccess(parsed.data.area, 'media');

  await updateMedia(parsed.data.assetId, {
    title: normalizeOptionalText(parsed.data.title),
    altText: normalizeOptionalText(parsed.data.altText),
  });

  revalidateMediaPaths(parsed.data.area);
  redirect(flashUrl(parsed.data.area, formData.get('returnTo'), 'media-update-success'));
}

export async function updateMediaPublicationAction(formData: FormData) {
  const parsed = updateMediaPublicationSchema.safeParse({
    area: formData.get('area'),
    assetId: formData.get('assetId'),
    isPublished: formData.get('isPublished'),
  });

  if (!parsed.success) {
    redirect('/admin/media?flash=media-update-invalid-payload');
  }

  await requireAdminSectionAccess(parsed.data.area, 'media');

  await updateMedia(parsed.data.assetId, {
    isPublished: parsed.data.isPublished,
  });

  revalidateMediaPaths(parsed.data.area);
  redirect(flashUrl(parsed.data.area, formData.get('returnTo'), 'media-update-success'));
}

export async function deleteMediaAction(formData: FormData) {
  const parsed = deleteMediaSchema.safeParse({
    area: formData.get('area'),
    assetId: formData.get('assetId'),
  });

  if (!parsed.success) {
    redirect('/admin/media?flash=media-delete-invalid-payload');
  }

  await requireAdminSectionAccess(parsed.data.area, 'media');
  try {
    await deleteMedia(parsed.data.assetId);
  } catch (error) {
    if (error instanceof Error && error.message === 'MEDIA_ASSET_IN_USE') {
      redirect(flashUrl(parsed.data.area, formData.get('returnTo'), 'media-delete-in-use'));
    }
    throw error;
  }

  revalidateMediaPaths(parsed.data.area);
  redirect(flashUrl(parsed.data.area, formData.get('returnTo'), 'media-delete-success'));
}
