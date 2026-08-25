'use server';

import { MediaCollectionType, MediaType } from '@/generated/prisma/browser';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireAdminSectionAccess } from '@/features/admin/lib/admin-guards';
import {
  deleteMediaSchema,
  getMediaAdminPath,
  normalizeOptionalText,
  updateMediaSchema,
  uploadMediaSchema,
} from '@/features/admin/lib/admin-media-validation';
import { prisma } from '@/lib/prisma';
import { createMedia, deleteMedia, replaceMediaAsset, updateMedia } from '@/features/media/lib/media-library';

function flashUrl(area: 'owner' | 'salon', flash: string, redirectFilter?: 'ALL' | MediaType) {
  const basePath = getMediaAdminPath(area);
  const searchParams = new URLSearchParams({ flash });

  if (redirectFilter && redirectFilter !== 'ALL') {
    searchParams.set('type', redirectFilter);
  }

  return `${basePath}?${searchParams.toString()}`;
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
    type: MediaType.GENERAL,
    title: formData.get('title'),
    altText: formData.get('altText'),
    sortOrder: formData.get('sortOrder'),
    redirectFilter: formData.get('redirectFilter') || undefined,
  });

  if (!parsed.success) {
    redirect('/admin/media?flash=media-upload-invalid-payload');
  }

  await requireAdminSectionAccess(parsed.data.area, 'media');

  const file = formData.get('file');

  if (!(file instanceof File) || file.size <= 0) {
    redirect(flashUrl(parsed.data.area, 'media-upload-missing-file', parsed.data.redirectFilter));
  }

  try {
    await createMedia({
      file,
      type: parsed.data.type,
      isPublished: true,
      title: normalizeOptionalText(parsed.data.title),
      altText: normalizeOptionalText(parsed.data.altText),
      sortOrder: parsed.data.sortOrder ?? null,
    });
  } catch (error) {
    redirect(flashUrl(parsed.data.area, mapUploadErrorToFlash(error), parsed.data.redirectFilter));
  }

  revalidateMediaPaths(parsed.data.area);
  redirect(flashUrl(parsed.data.area, 'media-upload-success', parsed.data.redirectFilter));
}

export async function replaceMediaAction(formData: FormData) {
  const area = formData.get('area');
  const assetId = formData.get('assetId');
  if ((area !== 'owner' && area !== 'salon') || typeof assetId !== 'string') redirect('/admin/media?flash=media-replace-invalid-payload');
  await requireAdminSectionAccess(area, 'media');
  const file = formData.get('file');
  if (!(file instanceof File) || file.size <= 0) redirect(flashUrl(area, 'media-upload-missing-file'));
  try {
    const current = await prisma.mediaAsset.findUnique({ where: { id: assetId } });
    if (!current || current.deletionRequestedAt) redirect(flashUrl(area, 'media-replace-invalid-payload'));
    await replaceMediaAsset(assetId, {
      file,
      type: current.type,
      isPublished: current.isPublished,
      title: current.title,
      altText: current.altText,
      sortOrder: current.sortOrder,
    });
  } catch (error) {
    redirect(flashUrl(area, mapUploadErrorToFlash(error)));
  }
  revalidateMediaPaths(area);
  redirect(flashUrl(area, 'media-replace-success'));
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
  } else {
    const sortOrder = Number(formData.get('sortOrder'));
    const isVisible = formData.get('isVisible') !== 'false';
    const last = await prisma.mediaCollectionItem.aggregate({ where: { collectionId: collection.id }, _max: { sortOrder: true } });
    await prisma.mediaCollectionItem.upsert({
      where: { collectionId_mediaAssetId: { collectionId: collection.id, mediaAssetId: assetId } },
      create: { collectionId: collection.id, mediaAssetId: assetId, isVisible, sortOrder: Number.isInteger(sortOrder) && sortOrder >= 0 ? sortOrder : (last._max.sortOrder ?? -1) + 1 },
      update: { isVisible, ...(Number.isInteger(sortOrder) && sortOrder >= 0 ? { sortOrder } : {}) },
    });
  }
  revalidateMediaPaths(area);
  redirect(flashUrl(area, 'media-membership-success'));
}

export async function updateMediaAction(formData: FormData) {
  const parsed = updateMediaSchema.safeParse({
    area: formData.get('area'),
    assetId: formData.get('assetId'),
    type: formData.get('type'),
    title: formData.get('title'),
    altText: formData.get('altText'),
    sortOrder: formData.get('sortOrder'),
    isPublished: formData.get('isPublished'),
    redirectFilter: formData.get('redirectFilter') || undefined,
  });

  if (!parsed.success) {
    redirect('/admin/media?flash=media-update-invalid-payload');
  }

  await requireAdminSectionAccess(parsed.data.area, 'media');

  await updateMedia(parsed.data.assetId, {
    type: parsed.data.type,
    title: normalizeOptionalText(parsed.data.title),
    altText: normalizeOptionalText(parsed.data.altText),
    isPublished: parsed.data.isPublished,
    sortOrder: parsed.data.sortOrder ?? null,
  });

  revalidateMediaPaths(parsed.data.area);
  redirect(flashUrl(parsed.data.area, 'media-update-success', parsed.data.redirectFilter));
}

export async function deleteMediaAction(formData: FormData) {
  const parsed = deleteMediaSchema.safeParse({
    area: formData.get('area'),
    assetId: formData.get('assetId'),
    redirectFilter: formData.get('redirectFilter') || undefined,
  });

  if (!parsed.success) {
    redirect('/admin/media?flash=media-delete-invalid-payload');
  }

  await requireAdminSectionAccess(parsed.data.area, 'media');
  try {
    await deleteMedia(parsed.data.assetId);
  } catch (error) {
    if (error instanceof Error && error.message === 'MEDIA_ASSET_IN_USE') {
      redirect(flashUrl(parsed.data.area, 'media-delete-in-use', parsed.data.redirectFilter));
    }
    throw error;
  }

  revalidateMediaPaths(parsed.data.area);
  redirect(flashUrl(parsed.data.area, 'media-delete-success', parsed.data.redirectFilter));
}
