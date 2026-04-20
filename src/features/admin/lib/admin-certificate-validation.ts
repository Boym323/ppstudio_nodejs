import { z } from 'zod';

import { type AdminArea } from '@/config/navigation';

export const adminAreaSchema = z.enum(['owner', 'salon']);

export const uploadCertificateSchema = z.object({
  area: adminAreaSchema,
  title: z.string().trim().max(120, 'Titulek může mít maximálně 120 znaků.').optional(),
  alt: z.string().trim().max(160, 'Alt text může mít maximálně 160 znaků.').optional(),
});

export const deleteCertificateSchema = z.object({
  area: adminAreaSchema,
  assetId: z.cuid(),
});

export function normalizeOptionalText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

export function getCertificatesAdminPath(area: AdminArea) {
  return area === 'owner' ? '/admin/certifikaty' : '/admin/provoz/certifikaty';
}
