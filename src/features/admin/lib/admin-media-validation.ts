import { z } from 'zod';

import { type AdminArea } from '@/config/navigation';

export const adminAreaSchema = z.enum(['owner', 'salon']);
export const uploadMediaSchema = z.object({
  area: adminAreaSchema,
  title: z.string().trim().max(120, 'Titulek může mít maximálně 120 znaků.').optional(),
  altText: z.string().trim().max(160, 'Alt text může mít maximálně 160 znaků.').optional(),
});

export const updateMediaSchema = z.object({
  area: adminAreaSchema,
  assetId: z.cuid(),
  title: z.string().trim().max(120, 'Titulek může mít maximálně 120 znaků.').optional(),
  altText: z.string().trim().max(160, 'Alt text může mít maximálně 160 znaků.').optional(),
  isPublished: z.enum(['true', 'false']).transform((value) => value === 'true'),
});

export const deleteMediaSchema = z.object({
  area: adminAreaSchema,
  assetId: z.cuid(),
});

export function normalizeOptionalText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

export function getMediaAdminPath(area: AdminArea) {
  return area === 'owner' ? '/admin/media' : '/admin/provoz/media';
}

export function getAdminMediaPreviewUrl(area: AdminArea, assetId: string) {
  return `/api/admin/media/${area}/${assetId}/preview`;
}
