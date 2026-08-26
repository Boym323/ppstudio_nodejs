'use server';

import { revalidatePath } from 'next/cache';

import { type AdminArea } from '@/config/navigation';
import { requireAdminSectionAccess } from '@/features/admin/lib/admin-guards';
import {
  addReferenceMediaSchema,
  invalidReferenceMediaPayload,
  moveReferenceMediaSchema,
  removeReferenceMediaSchema,
  updateReferenceMediaSchema,
} from '@/features/admin/lib/reference-media-validation';
import { addReferenceMedia, moveReferenceMedia, removeReferenceMedia, updateReferenceMedia } from '@/features/media/lib/reference-collection';

async function authorize(area: AdminArea) {
  await requireAdminSectionAccess(area, 'media');
}

function revalidateReferences() {
  revalidatePath('/admin/media');
  revalidatePath('/admin/provoz/media');
}

export async function addReferenceMediaAction(formData: FormData) {
  const parsed = addReferenceMediaSchema.safeParse({
    area: formData.get('area'),
    mediaAssetId: formData.get('mediaAssetId'),
  });
  if (!parsed.success) invalidReferenceMediaPayload();
  await authorize(parsed.data.area);
  await addReferenceMedia(parsed.data.mediaAssetId);
  revalidateReferences();
}

export async function removeReferenceMediaAction(formData: FormData) {
  const parsed = removeReferenceMediaSchema.safeParse({ area: formData.get('area'), id: formData.get('id') });
  if (!parsed.success) invalidReferenceMediaPayload();
  await authorize(parsed.data.area);
  await removeReferenceMedia(parsed.data.id);
  revalidateReferences();
}

export async function moveReferenceMediaAction(formData: FormData) {
  const parsed = moveReferenceMediaSchema.safeParse({
    area: formData.get('area'),
    id: formData.get('id'),
    direction: formData.get('direction'),
  });
  if (!parsed.success) invalidReferenceMediaPayload();
  await authorize(parsed.data.area);
  await moveReferenceMedia(parsed.data.id, parsed.data.direction);
  revalidateReferences();
}

export async function updateReferenceMediaAction(formData: FormData) {
  const parsed = updateReferenceMediaSchema.safeParse({
    area: formData.get('area'),
    id: formData.get('id'),
    isVisible: formData.getAll('isVisible'),
    altText: formData.get('altText'),
    caption: formData.get('caption'),
  });
  if (!parsed.success) invalidReferenceMediaPayload();
  await authorize(parsed.data.area);
  await updateReferenceMedia(parsed.data.id, {
    isVisible: parsed.data.isVisible,
    altText: parsed.data.altText,
    caption: parsed.data.caption,
  });
  revalidateReferences();
}
