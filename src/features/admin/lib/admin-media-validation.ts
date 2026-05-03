import { MediaType } from '@prisma/client';
import { z } from 'zod';

import { type AdminArea } from '@/config/navigation';

export const adminAreaSchema = z.enum(['owner', 'salon']);
export const contactPhotoMediaType = 'CONTACT_PHOTO';
export const visibleMediaTypeValues = [
  'CERTIFICATE',
  'SALON_PHOTO',
  'CONTACT_PHOTO',
  'PORTRAIT_HOME',
  'PORTRAIT_ABOUT',
] as const;
const mediaTypeValues = [
  ...visibleMediaTypeValues,
  'PORTRAIT',
  'GENERAL',
] as const;
export const mediaTypeSchema = z.enum(mediaTypeValues);
export const visibleMediaTypeSchema = z.enum(visibleMediaTypeValues);

export const mediaFilterSchema = z.union([visibleMediaTypeSchema, z.literal('ALL')]).default('ALL');
export const mediaRedirectFilterSchema = mediaFilterSchema.optional();
const mediaSortOrderSchema = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.coerce.number().int().min(0, 'Pořadí nesmí být záporné.').max(10000, 'Pořadí je příliš vysoké.').optional(),
);

export const uploadMediaSchema = z.object({
  area: adminAreaSchema,
  type: mediaTypeSchema.default(MediaType.CERTIFICATE),
  title: z.string().trim().max(120, 'Titulek může mít maximálně 120 znaků.').optional(),
  altText: z.string().trim().max(160, 'Alt text může mít maximálně 160 znaků.').optional(),
  sortOrder: mediaSortOrderSchema,
  redirectFilter: mediaRedirectFilterSchema,
});

export const updateMediaSchema = z.object({
  area: adminAreaSchema,
  assetId: z.cuid(),
  type: mediaTypeSchema,
  title: z.string().trim().max(120, 'Titulek může mít maximálně 120 znaků.').optional(),
  altText: z.string().trim().max(160, 'Alt text může mít maximálně 160 znaků.').optional(),
  sortOrder: mediaSortOrderSchema,
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
    case contactPhotoMediaType:
      return 'Kontakt';
    case MediaType.PORTRAIT:
      return 'Portréty';
    case MediaType.PORTRAIT_HOME:
      return 'Portrét: Homepage';
    case MediaType.PORTRAIT_ABOUT:
      return 'Portrét: O mně';
    case MediaType.GENERAL:
      return 'Obecné';
  }
}

export function getMediaUsageLabel(type: MediaType) {
  switch (type) {
    case MediaType.CERTIFICATE:
      return 'Použito: O mně';
    case MediaType.SALON_PHOTO:
      return 'Použito: Studio';
    case contactPhotoMediaType:
      return 'Použito: Kontakt';
    case MediaType.PORTRAIT:
      return 'Použito: O mně a homepage';
    case MediaType.PORTRAIT_HOME:
      return 'Použito: Homepage';
    case MediaType.PORTRAIT_ABOUT:
      return 'Použito: O mně';
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
    case contactPhotoMediaType:
      return 'Sekce: Hero kontaktu';
    case MediaType.PORTRAIT:
      return 'Sekce: Hero portrét';
    case MediaType.PORTRAIT_HOME:
      return 'Sekce: Homepage hero';
    case MediaType.PORTRAIT_ABOUT:
      return 'Sekce: O mně hero';
    case MediaType.GENERAL:
      return 'Sekce: Obecné bloky';
  }
}
