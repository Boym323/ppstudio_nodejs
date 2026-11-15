import type { AdminArea } from '@/config/navigation';

export const mediaLocations = [
  { value: 'HOME', label: 'Úvodní stránka' },
  { value: 'ABOUT', label: 'O mně' },
  { value: 'CONTACT', label: 'Kontakt' },
  { value: 'SERVICES', label: 'Služby' },
  { value: 'STUDIO_GALLERY', label: 'Studio' },
  { value: 'CERTIFICATES', label: 'Certifikáty' },
  { value: 'REFERENCES', label: 'Reference' },
] as const;

export type MediaUsageReference = { source: string; recordId: string; field: string; serviceId?: string };

export function mediaUsageLabel(reference: MediaUsageReference) {
  if (reference.source === 'MediaCollectionItem') {
    return mediaLocations.find(({ value }) => value === reference.field)?.label ?? 'Kolekce médií';
  }
  if (reference.source === 'ServiceMedia') {
    const [role, ...parts] = reference.field.split(':');
    parts.pop(); // Poslední část je slug, název služby může obsahovat dvojtečku.
    return `${parts.join(':')} · ${role === 'HERO' ? 'hlavní fotografie' : 'galerie'}`;
  }
  return ({ contactPhotoMediaId: 'Kontakt · fotografie', homePortraitMediaId: 'Úvodní stránka · portrét', aboutPortraitMediaId: 'O mně · portrét', voucherPdfLogoMediaId: 'Dřívější logo voucherů · evidovaná vazba' } as Record<string, string>)[reference.field] ?? 'Nastavení webu';
}

export function mediaUsageHref(area: AdminArea, reference: MediaUsageReference) {
  const base = area === 'owner' ? '/admin' : '/admin/provoz';
  if (reference.source === 'MediaCollectionItem') return `${base}/media?collection=${encodeURIComponent(reference.field)}`;
  if (reference.source === 'ServiceMedia' && reference.serviceId) return `${base}/sluzby?view=photos&serviceId=${encodeURIComponent(reference.serviceId)}`;
  if (area === 'owner' && ['contactPhotoMediaId', 'homePortraitMediaId', 'aboutPortraitMediaId'].includes(reference.field)) return `/admin/nastaveni#${reference.field}`;
  return null;
}

export function hasCroppedMediaPlacement(references: MediaUsageReference[], memberships: Array<{ type: string; isVisible: boolean }>) {
  return references.some((reference) =>
    reference.source === 'ServiceMedia' ||
    ['contactPhotoMediaId', 'homePortraitMediaId', 'aboutPortraitMediaId'].includes(reference.field) ||
    (reference.source === 'MediaCollectionItem' && reference.field === 'STUDIO_GALLERY' && memberships.some((membership) => membership.type === 'STUDIO_GALLERY' && membership.isVisible)),
  );
}
