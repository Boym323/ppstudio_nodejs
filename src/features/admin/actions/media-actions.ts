'use server';

import { MediaType } from '@prisma/client';
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
import { createMedia, deleteMedia, updateMedia } from '@/features/media/lib/media-library';

function flashUrl(area: 'owner' | 'salon', flash: string) {
  const basePath = getMediaAdminPath(area);
  return `${basePath}?flash=${encodeURIComponent(flash)}`;
}

function revalidateMediaPaths(area: 'owner' | 'salon') {
  for (const path of [getMediaAdminPath(area), '/admin', '/admin/provoz', '/o-mne', '/o-salonu']) {
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
    type: formData.get('type') ?? MediaType.CERTIFICATE,
    title: formData.get('title'),
    altText: formData.get('altText'),
  });

  if (!parsed.success) {
    redirect('/admin/media?flash=media-upload-invalid-payload');
  }

  await requireAdminSectionAccess(parsed.data.area, 'media');

  const file = formData.get('file');

  if (!(file instanceof File) || file.size <= 0) {
    redirect(flashUrl(parsed.data.area, 'media-upload-missing-file'));
  }

  try {
    await createMedia({
      file,
      type: parsed.data.type,
      isPublished: true,
      title: normalizeOptionalText(parsed.data.title),
      altText: normalizeOptionalText(parsed.data.altText),
    });
  } catch (error) {
    redirect(flashUrl(parsed.data.area, mapUploadErrorToFlash(error)));
  }

  revalidateMediaPaths(parsed.data.area);
  redirect(flashUrl(parsed.data.area, 'media-upload-success'));
}

export async function updateMediaAction(formData: FormData) {
  const parsed = updateMediaSchema.safeParse({
    area: formData.get('area'),
    assetId: formData.get('assetId'),
    type: formData.get('type'),
    title: formData.get('title'),
    altText: formData.get('altText'),
    isPublished: formData.get('isPublished'),
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
  });

  revalidateMediaPaths(parsed.data.area);
  redirect(flashUrl(parsed.data.area, 'media-update-success'));
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
  await deleteMedia(parsed.data.assetId);

  revalidateMediaPaths(parsed.data.area);
  redirect(flashUrl(parsed.data.area, 'media-delete-success'));
}
