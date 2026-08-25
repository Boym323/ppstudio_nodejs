'use server';

import { revalidatePath } from 'next/cache';

import { type AdminArea } from '@/config/navigation';
import { requireAdminSectionAccess } from '@/features/admin/lib/admin-guards';
import { addReferenceMedia, moveReferenceMedia, removeReferenceMedia, updateReferenceMedia } from '@/features/media/lib/reference-collection';

function read(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

async function authorize(area: string) {
  if (area !== 'owner' && area !== 'salon') throw new Error('Neplatná administrační sekce.');
  await requireAdminSectionAccess(area as AdminArea, 'media');
  return area as AdminArea;
}

function revalidateReferences() {
  revalidatePath('/admin/media');
  revalidatePath('/admin/provoz/media');
}

export async function addReferenceMediaAction(formData: FormData) {
  await authorize(read(formData, 'area'));
  await addReferenceMedia(read(formData, 'mediaAssetId'));
  revalidateReferences();
}

export async function removeReferenceMediaAction(formData: FormData) {
  await authorize(read(formData, 'area'));
  await removeReferenceMedia(read(formData, 'id'));
  revalidateReferences();
}

export async function moveReferenceMediaAction(formData: FormData) {
  await authorize(read(formData, 'area'));
  const direction = read(formData, 'direction');
  if (direction !== 'up' && direction !== 'down') throw new Error('Neplatný směr pořadí.');
  await moveReferenceMedia(read(formData, 'id'), direction);
  revalidateReferences();
}

export async function updateReferenceMediaAction(formData: FormData) {
  await authorize(read(formData, 'area'));
  const optional = (key: string) => {
    const value = read(formData, key).trim();
    return value || null;
  };
  await updateReferenceMedia(read(formData, 'id'), {
    isVisible: read(formData, 'isVisible') === 'true',
    altText: optional('altText'),
    caption: optional('caption'),
  });
  revalidateReferences();
}
