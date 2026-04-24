import { MediaType } from '@prisma/client';
import { z } from 'zod';

import { type AdminArea } from '@/config/navigation';

export const adminAreaSchema = z.enum(['owner', 'salon']);
const mediaTypeValues = ['CERTIFICATE', 'SALON_PHOTO', 'PORTRAIT', 'GENERAL'] as const;
export const mediaTypeSchema = z.enum(mediaTypeValues);

export const mediaFilterSchema = z.union([mediaTypeSchema, z.literal('ALL')]).default('ALL');
export const mediaRedirectFilterSchema = mediaFilterSchema.optional();

export const uploadMediaSchema = z.object({
  area: adminAreaSchema,
  type: mediaTypeSchema.default(MediaType.CERTIFICATE),
  title: z.string().trim().max(120, 'Titulek může mít maximálně 120 znaků.').optional(),
  altText: z.string().trim().max(160, 'Alt text může mít maximálně 160 znaků.').optional(),
  redirectFilter: mediaRedirectFilterSchema,
});

export const updateMediaSchema = z.object({
  area: adminAreaSchema,
  assetId: z.cuid(),
  type: mediaTypeSchema,
  title: z.string().trim().max(120, 'Titulek může mít maximálně 120 znaků.').optional(),
  altText: z.string().trim().max(160, 'Alt text může mít maximálně 160 znaků.').optional(),
  isPublished: z.enum(['true', 'false']).transform((value) => value === 'true'),
  redirectFilter: mediaRedirectFilterSchema,
});

export const deleteMediaSchema = z.object({
  area: adminAreaSchema,
  assetId: z.cuid(),
  redirectFilter: mediaRedirectFilterSchema,
});

export function normalizeOptionalText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

export function getMediaAdminPath(area: AdminArea) {
  return area === 'owner' ? '/admin/media' : '/admin/provoz/media';
}

export function getMediaTypeLabel(type: MediaType) {
  switch (type) {
    case MediaType.CERTIFICATE:
      return 'Certifikáty';
    case MediaType.SALON_PHOTO:
      return 'Prostory';
    case MediaType.PORTRAIT:
      return 'Portréty';
    case MediaType.GENERAL:
      return 'Obecné';
  }
}

export function getMediaUsageLabel(type: MediaType) {
  switch (type) {
    case MediaType.CERTIFICATE:
      return 'Použito: O mně';
    case MediaType.SALON_PHOTO:
      return 'Použito: Studio a Kontakt';
    case MediaType.PORTRAIT:
      return 'Použito: O mně a homepage';
    case MediaType.GENERAL:
      return 'Použito: připraveno pro bannery';
  }
}

export function getMediaUsageSectionLabel(type: MediaType) {
  switch (type) {
    case MediaType.CERTIFICATE:
      return 'Sekce: Certifikace';
    case MediaType.SALON_PHOTO:
      return 'Sekce: Galerie prostor';
    case MediaType.PORTRAIT:
      return 'Sekce: Hero portrét';
    case MediaType.GENERAL:
      return 'Sekce: Obecné bloky';
  }
}
