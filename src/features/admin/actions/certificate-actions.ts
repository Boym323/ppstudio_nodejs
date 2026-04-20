'use server';

import { MediaAssetKind, MediaAssetVisibility } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireAdminSectionAccess } from '@/features/admin/lib/admin-guards';
import {
  deleteCertificateSchema,
  getCertificatesAdminPath,
  normalizeOptionalText,
  uploadCertificateSchema,
} from '@/features/admin/lib/admin-certificate-validation';
import { getMediaAssetById } from '@/features/media/lib/media-asset-repository';
import { removeMediaAsset, saveMediaAsset } from '@/features/media/lib/media-library';

function flashUrl(area: 'owner' | 'salon', flash: string) {
  const basePath = getCertificatesAdminPath(area);
  return `${basePath}?flash=${encodeURIComponent(flash)}`;
}

function revalidateCertificatePaths(area: 'owner' | 'salon') {
  for (const path of [getCertificatesAdminPath(area), '/admin', '/admin/provoz', '/o-mne', '/o-salonu']) {
    revalidatePath(path);
  }
}

function mapUploadErrorToFlash(error: unknown) {
  if (!(error instanceof Error)) {
    return 'certificate-upload-failed';
  }

  switch (error.message) {
    case 'MEDIA_FILE_MISSING':
      return 'certificate-upload-missing-file';
    case 'MEDIA_FILE_EMPTY':
      return 'certificate-upload-empty-file';
    case 'MEDIA_FILE_TOO_LARGE':
      return 'certificate-upload-too-large';
    case 'MEDIA_FILE_TYPE_UNSUPPORTED':
    case 'MEDIA_FILE_EXTENSION_UNSUPPORTED':
      return 'certificate-upload-invalid-type';
    default:
      return 'certificate-upload-failed';
  }
}

export async function uploadCertificateAction(formData: FormData) {
  const parsed = uploadCertificateSchema.safeParse({
    area: formData.get('area'),
    title: formData.get('title'),
    alt: formData.get('alt'),
  });

  if (!parsed.success) {
    redirect('/admin/certifikaty?flash=certificate-upload-invalid-payload');
  }

  await requireAdminSectionAccess(parsed.data.area, 'certifikaty');

  const file = formData.get('file');

  if (!(file instanceof File) || file.size <= 0) {
    redirect(flashUrl(parsed.data.area, 'certificate-upload-missing-file'));
  }

  try {
    await saveMediaAsset({
      file,
      kind: MediaAssetKind.CERTIFICATE,
      visibility: MediaAssetVisibility.PUBLIC,
      title: normalizeOptionalText(parsed.data.title),
      alt: normalizeOptionalText(parsed.data.alt),
    });
  } catch (error) {
    redirect(flashUrl(parsed.data.area, mapUploadErrorToFlash(error)));
  }

  revalidateCertificatePaths(parsed.data.area);
  redirect(flashUrl(parsed.data.area, 'certificate-upload-success'));
}

export async function deleteCertificateAction(formData: FormData) {
  const parsed = deleteCertificateSchema.safeParse({
    area: formData.get('area'),
    assetId: formData.get('assetId'),
  });

  if (!parsed.success) {
    redirect('/admin/certifikaty?flash=certificate-delete-invalid-payload');
  }

  await requireAdminSectionAccess(parsed.data.area, 'certifikaty');

  const asset = await getMediaAssetById(parsed.data.assetId);

  if (!asset || asset.kind !== MediaAssetKind.CERTIFICATE) {
    redirect(flashUrl(parsed.data.area, 'certificate-delete-not-found'));
  }

  await removeMediaAsset(asset.id);

  revalidateCertificatePaths(parsed.data.area);
  redirect(flashUrl(parsed.data.area, 'certificate-delete-success'));
}
