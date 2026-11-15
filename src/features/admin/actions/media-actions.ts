'use server';

import { z } from 'zod';
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
  for (const path of [getMediaAdminPath(area), '/admin', '/admin/provoz', '/', '/kontakt', '/studio', '/o-mne', '/o-salonu', '/sluzby', '/admin/sluzby', '/admin/provoz/sluzby', '/admin/nastaveni']) {
    revalidatePath(path);
  }
  revalidatePath('/sluzby/[slug]', 'page');
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
    isPublished: formData.get('isPublished') === 'true',
    collectionType: formData.get('collectionType') || undefined,
  });

  if (!parsed.success) {
    redirect('/admin/media?flash=media-upload-invalid-payload');
  }

  await requireAdminSectionAccess(parsed.data.area, 'media');

  const files = formData.getAll('files').filter((file): file is File => file instanceof File && file.size > 0);
  const legacyFile = formData.get('file');
  if (legacyFile instanceof File && legacyFile.size > 0) files.push(legacyFile);

  if (!files.length) {
    redirect(flashUrl(parsed.data.area, formData.get('returnTo'), 'media-upload-missing-file'));
  }
  if (files.length > 8) {
    redirect(flashUrl(parsed.data.area, formData.get('returnTo'), 'media-upload-too-many'));
  }

  const metadata = files.map((_, index) => uploadMediaSchema.safeParse({
    ...parsed.data,
    title: formData.get(`title.${index}`) ?? parsed.data.title,
    altText: formData.get(`altText.${index}`) ?? parsed.data.altText,
  }));
  if (metadata.some((item) => !item.success)) redirect(flashUrl(parsed.data.area, formData.get('returnTo'), 'media-upload-invalid-payload'));

  const uploadedIds: string[] = [];
  let failed = 0;
  let firstError: unknown;
  for (const [index, file] of files.entries()) {
    const item = metadata[index];
    if (!item.success) continue;
    try {
      const asset = await createMedia({
        file,
        isPublished: parsed.data.isPublished,
        title: normalizeOptionalText(item.data.title),
        altText: normalizeOptionalText(item.data.altText),
      }, parsed.data.isPublished ? parsed.data.collectionType : undefined);
      uploadedIds.push(asset.id);
    } catch (error) {
      failed += 1;
      firstError ??= error;
    }
  }
  if (!uploadedIds.length) redirect(flashUrl(parsed.data.area, formData.get('returnTo'), mapUploadErrorToFlash(firstError)));
  revalidateMediaPaths(parsed.data.area);
  const addedToCollection = parsed.data.collectionType && parsed.data.isPublished;
  const destination = addedToCollection
    ? `${getMediaAdminPath(parsed.data.area)}?collection=${parsed.data.collectionType}`
    : getMediaAdminPath(parsed.data.area);
  const flash = failed ? 'media-upload-partial' : addedToCollection ? 'media-upload-collection-success' : parsed.data.collectionType ? 'media-upload-collection-draft' : 'media-upload-success';
  const redirectUrl = new URL(flashUrl(parsed.data.area, destination, flash), 'http://media-return.invalid');
  redirectUrl.searchParams.set('uploaded', String(uploadedIds.length));
  redirectUrl.searchParams.set('failed', String(failed));
  redirectUrl.searchParams.set('new', uploadedIds.join(','));
  redirect(`${redirectUrl.pathname}?${redirectUrl.searchParams}`);
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
  if ((area !== 'owner' && area !== 'salon') || typeof assetId !== 'string' || !Object.values(MediaCollectionType).includes(collectionType as MediaCollectionType) || (action !== 'add' && action !== 'save' && action !== 'remove' && action !== 'move')) {
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
      const membership = await saveMediaCollectionMembership(
        tx,
        collection.id,
        assetId,
        isVisible,
        collectionType === MediaCollectionType.STUDIO_GALLERY || collectionType === MediaCollectionType.CERTIFICATES || collectionType === MediaCollectionType.REFERENCES
          ? { requirePublicAsset: true }
          : undefined,
      );
      if (!membership) redirect(flashUrl(area, formData.get('returnTo'), 'media-membership-asset-not-public'));
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
    focalPointX: formData.get('focalPointX'),
    focalPointY: formData.get('focalPointY'),
  });

  if (!parsed.success) {
    redirect('/admin/media?flash=media-update-invalid-payload');
  }

  await requireAdminSectionAccess(parsed.data.area, 'media');

  await updateMedia(parsed.data.assetId, {
    title: normalizeOptionalText(parsed.data.title),
    altText: normalizeOptionalText(parsed.data.altText),
    focalPointX: parsed.data.focalPointX,
    focalPointY: parsed.data.focalPointY,
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

const bulkMediaSchema = z.object({
  area: z.enum(['owner', 'salon']),
  assetIds: z.array(z.cuid()).min(1).max(48),
  operation: z.enum(['publish', 'unpublish', 'delete']),
  confirmed: z.literal('true'),
});

export async function bulkMediaAction(formData: FormData) {
  const parsed = bulkMediaSchema.safeParse({ area: formData.get('area'), assetIds: [...new Set(formData.getAll('assetId'))], operation: formData.get('operation'), confirmed: formData.get('confirmed') });
  if (!parsed.success) throw new Error('Neplatná hromadná akce médií. Obnovte stránku a vyberte soubory znovu.');
  const { area, assetIds, operation } = parsed.data;
  await requireAdminSectionAccess(area, 'media');
  let changed = 0;
  let skipped = 0;
  if (operation === 'delete') {
    // Každé smazání používá stejný transakční usage guard jako detail média.
    for (const id of assetIds) {
      try {
        await deleteMedia(id);
        changed += 1;
      } catch (error) {
        if (error instanceof Error && ['MEDIA_ASSET_IN_USE', 'MEDIA_ASSET_NOT_FOUND'].includes(error.message)) skipped += 1;
        else {
          revalidateMediaPaths(area);
          throw error;
        }
      }
    }
  } else {
    // Jediný atomický UPDATE, opakované odeslání je idempotentní.
    const result = await prisma.mediaAsset.updateMany({
      where: { id: { in: assetIds }, visibility: 'PUBLIC', deletionRequestedAt: null, isPublished: operation !== 'publish' },
      data: { isPublished: operation === 'publish' },
    });
    changed = result.count;
    skipped = assetIds.length - changed;
  }
  revalidateMediaPaths(area);
  const url = new URL(flashUrl(area, formData.get('returnTo'), 'media-bulk-success'), 'http://media-return.invalid');
  url.searchParams.set('changed', String(changed));
  url.searchParams.set('skipped', String(skipped));
  redirect(`${url.pathname}?${url.searchParams}`);
}
