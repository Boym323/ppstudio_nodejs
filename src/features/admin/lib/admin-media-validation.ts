import { z } from 'zod';

import { type AdminArea } from '@/config/navigation';

export const adminAreaSchema = z.enum(['owner', 'salon']);
export const uploadMediaSchema = z.object({
  area: adminAreaSchema,
  title: z.string().trim().max(120, 'Titulek může mít maximálně 120 znaků.').optional(),
  altText: z.string().trim().max(160, 'Alt text může mít maximálně 160 znaků.').optional(),
});

export const updateMediaMetadataSchema = z.object({
  area: adminAreaSchema,
  assetId: z.cuid(),
  title: z.string().trim().max(120, 'Titulek může mít maximálně 120 znaků.').optional(),
  altText: z.string().trim().max(160, 'Alt text může mít maximálně 160 znaků.').optional(),
});

export const updateMediaPublicationSchema = z.object({
  area: adminAreaSchema,
  assetId: z.cuid(),
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

type MediaSearchParams = Record<string, string | string[] | undefined>;

export function getManagedCollectionCanonicalUrl(area: AdminArea, searchParams: MediaSearchParams) {
  const collection = typeof searchParams.collection === 'string' ? searchParams.collection : undefined;
  if (collection !== 'STUDIO_GALLERY' && collection !== 'CERTIFICATES') return null;

  if (!['q', 'usage', 'publication', 'page'].some((name) => name in searchParams)) return null;

  const query = new URLSearchParams({ collection });
  if (typeof searchParams.flash === 'string') query.set('flash', searchParams.flash);
  return `${getMediaAdminPath(area)}?${query}`;
}

export function getMediaRedirectUrl(area: AdminArea, returnTo: unknown, flash: string) {
  const fallback = getMediaAdminPath(area);

  if (typeof returnTo !== 'string' || !returnTo.startsWith('/') || returnTo.startsWith('//')) {
    return `${fallback}?${new URLSearchParams({ flash })}`;
  }

  try {
    const url = new URL(returnTo, 'http://media-return.invalid');
    if (url.origin !== 'http://media-return.invalid' || url.pathname !== fallback || url.hash) {
      return `${fallback}?${new URLSearchParams({ flash })}`;
    }

    url.searchParams.set('flash', flash);
    const canonicalUrl = getManagedCollectionCanonicalUrl(area, Object.fromEntries(url.searchParams));
    if (canonicalUrl) return canonicalUrl;
    return `${url.pathname}?${url.searchParams}`;
  } catch {
    return `${fallback}?${new URLSearchParams({ flash })}`;
  }
}

export function getAdminMediaPreviewUrl(area: AdminArea, assetId: string) {
  return `/api/admin/media/${area}/${assetId}/preview`;
}
