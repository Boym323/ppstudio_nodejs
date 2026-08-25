import { MediaCollectionType } from '@/generated/prisma/browser';

import { getPublicMediaCollectionItems } from '@/features/public/lib/public-media-relations';

export type PublicCertificate = {
  id: string;
  title: string | null;
  alt: string | null;
  imageUrl: string;
  width: number | null;
  height: number | null;
};

export async function getPublicCertificates(): Promise<PublicCertificate[]> {
  const items = await getPublicMediaCollectionItems(MediaCollectionType.CERTIFICATES);

  return items.map(({ altText, mediaAsset: asset }) => ({
    id: asset.id,
    title: asset.title,
    alt: altText ?? asset.altText,
    imageUrl: asset.optimizedUrl ?? asset.url,
    width: asset.optimizedWidth ?? asset.width,
    height: asset.optimizedHeight ?? asset.height,
  }));
}
